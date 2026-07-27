import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { arDate, arDateTime } from "@/lib/ar-format";
import {
  ArrowRight, Phone, Cake, CalendarPlus, AlertTriangle, HeartPulse, Coins,
  MessageCircle, CalendarClock,
} from "lucide-react";

export const metadata = { title: "ملف المريض — طود" };
export const dynamic = "force-dynamic";

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "مجدول", color: "#a1a1aa" }, confirmed: { label: "مؤكد", color: "#e4e4e7" },
  checked_in: { label: "وصل", color: "#fbbf24" }, in_progress: { label: "جارٍ", color: "var(--accent-1)" },
  completed: { label: "مكتمل", color: "#34d399" }, cancelled: { label: "ملغي", color: "#71717a" },
  no_show: { label: "لم يحضر", color: "#fda4b4" },
};

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}

/* The desk's view of a patient — not the doctor's.

   Contact details, what they owe, what they have booked and what they missed.
   Deliberately no clinical notes: reception needs to know a patient is allergic
   to penicillin before they hand them a form, and does not need to read their
   examination findings to do this job. */
export default async function ReceptionPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const { data: patient } = await sb.from("patients")
    .select("id, name, phone, email, dob, gender, national_id, created_at, source_channel")
    .eq("id", id).eq("clinic_id", claims.clinic_id).maybeSingle();
  if (!patient) notFound();

  const [{ data: appts }, { data: hist }, { data: invoices }] = await Promise.all([
    sb.from("appointments")
      .select("id, slot_time, status, services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar, name)")
      .eq("patient_id", id).is("deleted_at", null).order("slot_time", { ascending: false }).limit(30),
    sb.from("medical_histories").select("allergies, chronic_diseases, blood_type").eq("patient_id", id).maybeSingle(),
    sb.from("invoices").select("id, invoice_number, total, status, created_at")
      .eq("patient_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
  ]);

  const allergies = (hist?.allergies as string[] | null) ?? [];
  const chronic = (hist?.chronic_diseases as string[] | null) ?? [];
  const owed = (invoices ?? [])
    .filter((i) => ["sent", "overdue", "partially_paid"].includes(i.status as string))
    .reduce((s, i) => s + Number(i.total ?? 0), 0);

  const now = new Date().toISOString();
  const upcoming = (appts ?? []).filter((a) => (a.slot_time as string) >= now && !["cancelled", "no_show"].includes(a.status as string));
  const past = (appts ?? []).filter((a) => !upcoming.includes(a));
  const a = age(patient.dob as string | null);
  const digits = String(patient.phone ?? "").replace(/\D/g, "");

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/reception/patients" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للمرضى
      </Link>

      <div className="panel-feature" style={{ padding: "1.5rem 1.75rem" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 text-white"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {String(patient.name).charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{patient.name as string}</h1>
                {allergies.length > 0 && (
                  <span className="badge badge-bad">
                    <AlertTriangle className="w-3 h-3" /> حساسية: {allergies.join("، ")}
                  </span>
                )}
                {chronic.length > 0 && (
                  <span className="badge" style={{ background: "rgba(56,189,248,0.1)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.22)" }}>
                    <HeartPulse className="w-3 h-3" /> {chronic.join("، ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[12px] flex-wrap" style={{ color: "var(--text-3)" }}>
                {patient.phone && <span className="flex items-center gap-1 ltr-nums"><Phone className="w-3 h-3" /> {patient.phone as string}</span>}
                {a !== null && <span className="flex items-center gap-1"><Cake className="w-3 h-3" /> <span className="ltr-nums">{a}</span> سنة</span>}
                {hist?.blood_type && <span>فصيلة {hist.blood_type as string}</span>}
                <span>مسجَّل منذ {arDate.format(new Date(patient.created_at as string))}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {digits && (
              <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="btn-ghost">
                <MessageCircle className="w-3.5 h-3.5" style={{ color: "#25d366" }} /> واتساب
              </a>
            )}
            <Link href={`/reception/book?patient=${patient.id}`} className="btn-primary">
              <CalendarPlus className="w-4 h-4" /> حجز موعد
            </Link>
          </div>
        </div>

        {owed > 0 && (
          <div className="flex items-center gap-2 mt-4 px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)" }}>
            <Coins className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
            <span className="text-[12.5px]" style={{ color: "#fbbf24" }}>
              مستحق عليه <span className="font-black ltr-nums">{omr(owed)}</span> ر.ع — اطلبه عند الحضور
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <CalendarClock className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>المواعيد</h2>
          </div>

          {upcoming.length > 0 && (
            <>
              <p className="eyebrow mb-2">قادمة</p>
              <div className="space-y-1.5 mb-4">
                {upcoming.map((ap) => <ApptRow key={ap.id as string} a={ap} />)}
              </div>
            </>
          )}

          {past.length === 0 && upcoming.length === 0 ? (
            <p className="text-[12px] text-center py-8" style={{ color: "var(--text-4)" }}>
              لم يزر العيادة بعد
            </p>
          ) : past.length > 0 && (
            <>
              <p className="eyebrow mb-2">السجل</p>
              <div className="space-y-1.5">
                {past.map((ap) => <ApptRow key={ap.id as string} a={ap} />)}
              </div>
            </>
          )}
        </div>

        <div className="col-span-12 lg:col-span-5 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <Coins className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>الفواتير</h2>
          </div>
          {(invoices ?? []).length === 0 ? (
            <p className="text-[12px] text-center py-8" style={{ color: "var(--text-4)" }}>لا فواتير</p>
          ) : (
            <div className="space-y-1.5">
              {(invoices ?? []).map((inv) => {
                const unpaid = ["sent", "overdue", "partially_paid"].includes(inv.status as string);
                return (
                  <div key={inv.id as string} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                    <span className="text-[12px] font-bold ltr-nums text-white">{inv.invoice_number as string}</span>
                    <span className="text-[10.5px]" style={{ color: "var(--text-4)" }}>
                      {arDate.format(new Date(inv.created_at as string))}
                    </span>
                    <span className="text-[12.5px] font-black ltr-nums ms-auto"
                      style={{ color: unpaid ? "#fbbf24" : "#34d399" }}>
                      {omr(Number(inv.total ?? 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ApptRow({ a }: { a: Record<string, unknown> }) {
  const st = STATUS[a.status as string] ?? STATUS.scheduled;
  const svc = (a.services as { name_ar?: string } | null)?.name_ar ?? "—";
  const doc = a.tawd_staff_users as { name_ar?: string; name?: string } | null;
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
      <span className="text-[12px] ltr-nums shrink-0" style={{ color: "var(--text-2)" }}>
        {arDateTime.format(new Date(a.slot_time as string))}
      </span>
      <span className="text-[12px] flex-1 min-w-0 truncate" style={{ color: "var(--text-3)" }}>
        {svc}{doc ? ` · ${doc.name_ar ?? doc.name}` : ""}
      </span>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
        style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40` }}>
        {st.label}
      </span>
    </div>
  );
}
