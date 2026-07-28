import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { CheckinButton } from "@/components/reception/checkin-button";
import { WaitingRoom, type QueueEntry } from "@/components/reception/waiting-room";
import { WalkinDialog } from "@/components/reception/walkin-dialog";
import { EmergencyAlerts } from "@/components/dashboard/emergency-alerts";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { arDayDate, arTime } from "@/lib/ar-format";
import { loadOpenReceivables, owedByPatient } from "@/lib/receivables";
import {
  CalendarPlus, ClipboardList, Hourglass, AlertTriangle, HeartPulse, Coins,
  PhoneCall, ChevronLeft, Users,
} from "lucide-react";

export const metadata = { title: "لوحة الاستقبال — طود" };

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "مجدول",  color: "#a1a1aa" },
  confirmed:   { label: "مؤكد",   color: "#e4e4e7" },
  checked_in:  { label: "وصل",    color: "var(--accent-1)" },
  in_progress: { label: "جارٍ",   color: "var(--accent-1)" },
  completed:   { label: "مكتمل",  color: "var(--accent-1)" },
  cancelled:   { label: "ملغي",   color: "#71717a" },
  no_show:     { label: "لم يحضر", color: "#fda4b4" },
};

const fmtTime = (iso: string) => arTime.format(new Date(iso));
const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const relMin = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `منذ ${m} د` : `منذ ${Math.round(m / 60)} س`;
};

export default async function ReceptionPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  /* Muscat is UTC+4, so the UTC day drops everything before 04:00 local. */
  const today = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
  const dayFrom = `${today}T00:00:00+04:00`;
  const dayTo = `${today}T23:59:59+04:00`;

  const [apptsRes, queueRes, alertsRes, waitlistRes, doctorsRes, servicesRes, patientsRes] = await Promise.all([
    sb.from("appointments")
      .select("id, slot_time, status, patient_id, patients!patient_id(name, phone), services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar, name)")
      .eq("clinic_id", claims.clinic_id)
      .gte("slot_time", dayFrom).lte("slot_time", dayTo)
      .is("deleted_at", null).order("slot_time"),
    sb.from("waiting_queue")
      .select("id, queue_position, status, check_in_at, patients!patient_id(name), appointments!appt_id(services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar, name))")
      .eq("clinic_id", claims.clinic_id)
      .in("status", ["waiting", "called", "in_room"])
      .gte("check_in_at", dayFrom)
      /* queue_position is assigned read-max-then-increment with no lock, so two
         receptionists checking patients in at the same moment can land on the
         same number. Rather than add locking for a clinic that mostly runs one
         front desk, arrival time breaks the tie — whoever actually got here
         first is ahead, which is what the waiting room already believes. */
      .order("queue_position")
      .order("check_in_at"),
    sb.from("sura_alerts")
      .select("id, kind, phone, patient_name, message, created_at")
      .eq("clinic_id", claims.clinic_id).in("kind", ["emergency", "complaint"]).eq("status", "open")
      .order("created_at", { ascending: false }).limit(10),
    sb.from("appointment_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", claims.clinic_id).eq("status", "waiting"),
    sb.from("tawd_staff_users").select("id, name, name_ar")
      .eq("clinic_id", claims.clinic_id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null),
    sb.from("services").select("id, name_ar").eq("clinic_id", claims.clinic_id).eq("is_active", true).order("name_ar"),
    sb.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", claims.clinic_id).is("deleted_at", null),
  ]);

  const appts = apptsRes.data ?? [];

  /* Allergies and money owed, for the people actually coming in today. The
     desk hands out forms and takes payment; both were invisible here. */
  const todayPatientIds = [...new Set(appts.map((a) => a.patient_id as string).filter(Boolean))];
  const [histRes, dueRes] = await Promise.all([
    todayPatientIds.length
      ? sb.from("medical_histories").select("patient_id, allergies, chronic_diseases").in("patient_id", todayPatientIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    loadOpenReceivables(sb, claims.clinic_id, { patientIds: todayPatientIds }),
  ]);
  const allergyOf = new Map<string, string[]>();
  const chronicOf = new Map<string, string[]>();
  for (const h of histRes.data ?? []) {
    const pid = h.patient_id as string;
    const al = (h.allergies as string[] | null) ?? [];
    const ch = (h.chronic_diseases as string[] | null) ?? [];
    if (al.length) allergyOf.set(pid, al);
    if (ch.length) chronicOf.set(pid, ch);
  }
  /* Net of what they have already paid and of any credit note — the desk asks
     the patient for this figure out loud, so it had better be the real one. */
  const owedOf = owedByPatient(dueRes);

  const doctors = (doctorsRes.data ?? []).map((d) => ({ id: d.id, label: (d.name_ar ?? d.name) as string }));
  const services = (servicesRes.data ?? []).map((s) => ({ id: s.id, label: s.name_ar as string }));

  const queue: QueueEntry[] = (queueRes.data ?? []).map((q) => {
    const appt = q.appointments as unknown as {
      services?: { name_ar?: string } | null;
      tawd_staff_users?: { name_ar?: string; name?: string } | null;
    } | null;
    return {
      id: q.id,
      position: q.queue_position,
      status: q.status,
      patientName: (q.patients as unknown as { name?: string } | null)?.name ?? "مريض",
      serviceName: appt?.services?.name_ar ?? null,
      doctorName: appt?.tawd_staff_users?.name_ar ?? appt?.tawd_staff_users?.name ?? null,
      waitingSince: relMin(q.check_in_at),
    };
  });

  const relTime = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 1 ? "الآن" : h < 24 ? `منذ ${h} ساعة` : `منذ ${Math.floor(h / 24)} يوم`;
  };
  const alerts = (alertsRes.data ?? []).map((a) => ({
    id: a.id, kind: a.kind ?? "emergency", phone: a.phone ?? null,
    patientName: a.patient_name ?? null, message: a.message ?? null, ago: relTime(a.created_at),
  }));

  const upcoming = appts.filter((a) => ["scheduled", "confirmed"].includes(a.status));
  const inClinic = appts.filter((a) => ["checked_in", "in_progress"].includes(a.status)).length;
  const completed = appts.filter((a) => a.status === "completed").length;
  const next = upcoming.find((a) => new Date(a.slot_time) > new Date()) ?? upcoming[0] ?? null;

  /* Booked, the time has gone, still not through the door. Fifteen minutes is
     when a desk picks up the phone rather than assuming traffic. */
  const late = appts
    .filter((a) => ["scheduled", "confirmed"].includes(a.status as string))
    .map((a) => ({ a, mins: Math.floor((Date.now() - new Date(a.slot_time as string).getTime()) / 60_000) }))
    .filter((x) => x.mins >= 15)
    .sort((x, y) => y.mins - x.mins);

  const todayAr = arDayDate.format(new Date());

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <EmergencyAlerts alerts={alerts} />

      {/* ══ command strip ══ */}
      <div className="panel-feature relative overflow-hidden" style={{ padding: "1.5rem 1.75rem" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>{todayAr}</p>
            <h1 className="text-xl font-bold text-white mt-1">لوحة الاستقبال</h1>
            {next ? (
              <p className="text-[12px] mt-1.5" style={{ color: "var(--text-3)" }}>
                القادم: <span className="font-bold text-white">{(next.patients as unknown as { name?: string } | null)?.name ?? "مريض"}</span>
                {" · "}
                <span className="ltr-nums font-bold" style={{ color: "var(--accent-1)" }}>{fmtTime(next.slot_time)}</span>
              </p>
            ) : (
              <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>لا مواعيد قادمة اليوم</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/reception/book" className="btn-primary">
              <CalendarPlus className="w-4 h-4" />
              حجز موعد
            </Link>
            <WalkinDialog services={services} doctors={doctors} />
            <Link href="/reception/patients" className="btn-ghost">
              <Users className="w-3.5 h-3.5" /> بحث عن مريض
            </Link>
            <Link href="/reception/followups" className="btn-ghost">
              <PhoneCall className="w-3.5 h-3.5" /> المتابعة
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-5 mt-5 flex-wrap">
          {[
            { l: "مواعيد اليوم", v: appts.length },
            { l: "بانتظار الوصول", v: upcoming.length },
            { l: "داخل العيادة", v: inClinic },
            { l: "مكتمل", v: completed },
            { l: "قائمة انتظار الحجز", v: waitlistRes.count ?? 0 },
          ].map((s, i) => (
            <div key={s.l} className="flex items-baseline gap-2">
              {i > 0 && <span className="w-px h-4 -ms-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />}
              <span className="text-lg font-bold ltr-nums text-white">{s.v}</span>
              <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {late.length > 0 && (
        <div className="panel" style={{ padding: "1.1rem 1.25rem", borderColor: "rgba(251,191,36,0.3)" }}>
          <div className="section-title mb-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
            <h2>تأخّروا عن موعدهم</h2>
          </div>
          <div className="space-y-1.5">
            {late.slice(0, 5).map(({ a, mins }) => {
              const p = a.patients as unknown as { name?: string; phone?: string } | null;
              return (
                <div key={a.id} className="flex items-center gap-3 px-3.5 py-2 rounded-xl flex-wrap"
                  style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <span className="text-[12.5px] font-bold text-white">{p?.name ?? "مريض"}</span>
                  <span className="text-[11px] ltr-nums" style={{ color: "#fbbf24" }}>متأخر {mins} دقيقة</span>
                  {p?.phone && (
                    <>
                      <span className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>{p.phone}</span>
                      <a href={`tel:${p.phone}`} className="btn-ghost ms-auto" title="اتصال">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ main grid ══ */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* today board */}
        <div className="col-span-12 lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>مواعيد اليوم</h2>
            <span className="live-dot" />
          </div>

          {appts.length === 0 ? (
            <div className="text-center py-14">
              <ClipboardList className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
              <p className="text-sm" style={{ color: "var(--text-3)" }}>لا مواعيد اليوم</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {appts.map((a) => {
                const st = STATUS[a.status] ?? STATUS.scheduled;
                const p = a.patients as unknown as { name?: string; phone?: string } | null;
                const svcName = (a.services as unknown as { name_ar?: string } | null)?.name_ar ?? "";
                const doc = a.tawd_staff_users as unknown as { name_ar?: string; name?: string } | null;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <span className="text-[13px] font-bold ltr-nums w-16 shrink-0 text-white">{fmtTime(a.slot_time)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/reception/patients/${a.patient_id}`}
                          className="text-[13px] font-bold text-white truncate hover:underline">
                          {p?.name ?? "مريض"}
                        </Link>
                        {/* The two things a desk acts on: what could harm them,
                            and what they owe before they walk back out. */}
                        {(allergyOf.get(a.patient_id as string) ?? []).length > 0 && (
                          <span title={`حساسية: ${(allergyOf.get(a.patient_id as string) ?? []).join("، ")}`}>
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
                          </span>
                        )}
                        {(chronicOf.get(a.patient_id as string) ?? []).length > 0 && (
                          <span title={`مزمن: ${(chronicOf.get(a.patient_id as string) ?? []).join("، ")}`}>
                            <HeartPulse className="w-3.5 h-3.5" style={{ color: "#7dd3fc" }} />
                          </span>
                        )}
                        {(owedOf.get(a.patient_id as string) ?? 0) > 0 && (
                          <span className="badge" title="مستحق عليه — اطلبه عند الحضور"
                            style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.22)" }}>
                            <Coins className="w-3 h-3" />
                            <span className="ltr-nums">{omr(owedOf.get(a.patient_id as string) ?? 0)}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
                        {svcName}{doc ? ` · ${doc.name_ar ?? doc.name}` : ""}
                        {p?.phone ? ` · ${p.phone}` : ""}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                      style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}
                    >
                      <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                      {st.label}
                    </span>
                    {["scheduled", "confirmed"].includes(a.status) && (
                      <CheckinButton appointmentId={a.id} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* waiting room */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <WaitingRoom entries={queue} />

          <div className="panel flex items-center gap-3" style={{ padding: "1rem 1.25rem" }}>
            <Hourglass className="w-4 h-4 shrink-0" style={{ color: "var(--text-3)" }} />
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
              <span className="font-bold text-white ltr-nums">{waitlistRes.count ?? 0}</span> في قائمة انتظار الحجز —
              عند أي إلغاء سُرى تعرض الموعد عليهم تلقائياً.{" "}
              <Link href="/reception/followups" className="underline" style={{ color: "var(--accent-1)" }}>
                افتح المتابعة <ChevronLeft className="w-3 h-3 inline" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
