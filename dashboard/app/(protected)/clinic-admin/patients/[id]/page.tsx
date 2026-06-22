import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ArrowRight, Phone, Mail, Star, Calendar, Clock,
  User, FileText, CheckCircle2, XCircle, AlertCircle,
  Banknote, Activity,
} from "lucide-react";

export const metadata = { title: "ملف المريض — طود" };

const APPT_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  scheduled:   { label: "مجدول",     color: "#5dd9cb", bg: "rgba(20,184,166,0.1)",  border: "rgba(20,184,166,0.2)"  },
  confirmed:   { label: "مؤكد",      color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.2)"  },
  checked_in:  { label: "حضر",       color: "#2dd4bf", bg: "rgba(20,184,166,0.1)",  border: "rgba(20,184,166,0.2)"  },
  in_progress: { label: "جارٍ",      color: "#38bdf8", bg: "rgba(56,189,248,0.1)",   border: "rgba(56,189,248,0.2)"   },
  completed:   { label: "مكتمل",     color: "#34D399", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.2)"  },
  cancelled:   { label: "ملغي",      color: "#64748B", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.15)" },
  no_show:     { label: "لم يحضر",   color: "#F87171", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.15)"  },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  paid:      { label: "مدفوعة",  color: "#34D399" },
  partial:   { label: "جزئي",    color: "#2dd4bf" },
  sent:      { label: "مرسلة",   color: "#5dd9cb" },
  draft:     { label: "مسودة",   color: "#94A3B8" },
  overdue:   { label: "متأخرة",  color: "#F87171" },
  cancelled: { label: "ملغاة",   color: "#64748B" },
  refunded:  { label: "مستردة",  color: "#38bdf8" },
};

function genderAr(g?: string | null) {
  if (g === "male")   return "ذكر";
  if (g === "female") return "أنثى";
  return null;
}

function age(dob?: string | null) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

type Appt = {
  id: string;
  slot_time: string;
  duration_minutes: number;
  status: string;
  type: string;
  notes: string | null;
  tawd_staff_users: { name: string; name_ar: string | null } | null;
  services: { name: string; name_ar: string | null } | null;
};

type Invoice = {
  id: string;
  total: number;
  vat_amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
};

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const [{ data: patient }, { data: apptData }, { data: invoiceData }] =
    await Promise.all([
      supabase
        .from("patients")
        .select("id, name, name_ar, phone, email, dob, gender, nationality, national_id, loyalty_points, source_channel, created_at")
        .eq("id", id)
        .eq("clinic_id", claims.clinic_id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("appointments")
        .select("id, slot_time, duration_minutes, status, type, notes, tawd_staff_users!doctor_id(name, name_ar), services!service_id(name, name_ar)")
        .eq("patient_id", id)
        .eq("clinic_id", claims.clinic_id)
        .is("deleted_at", null)
        .order("slot_time", { ascending: false })
        .limit(50),
      supabase
        .from("invoices")
        .select("id, total, vat_amount, status, due_date, created_at")
        .eq("patient_id", id)
        .eq("clinic_id", claims.clinic_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (!patient) notFound();

  const appts    = (apptData ?? []) as unknown as Appt[];
  const invoices = (invoiceData ?? []) as Invoice[];
  const patientAge = age(patient.dob);

  const completed  = appts.filter((a) => a.status === "completed").length;
  const cancelled  = appts.filter((a) => a.status === "cancelled").length;
  const noShow     = appts.filter((a) => a.status === "no_show").length;
  const totalPaid  = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0);

  const displayName = patient.name_ar ?? patient.name;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back + Header */}
      <div>
        <Link
          href="/clinic-admin/patients"
          className="inline-flex items-center gap-1.5 text-sm mb-3"
          style={{ color: "rgba(148,163,184,0.6)" }}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          المرضى
        </Link>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0"
            style={{ background: "rgba(20,184,166,0.15)", color: "#5dd9cb", border: "1px solid rgba(20,184,166,0.25)" }}
          >
            {displayName.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{displayName}</h2>
            {patient.name_ar && patient.name !== patient.name_ar && (
              <p className="text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>{patient.name}</p>
            )}
            <div className="flex items-center gap-3 mt-1">
              {patient.phone && (
                <span className="text-sm flex items-center gap-1 ltr-nums" style={{ color: "rgba(148,163,184,0.65)" }}>
                  <Phone className="w-3 h-3" /> {patient.phone}
                </span>
              )}
              {patient.loyalty_points > 0 && (
                <span className="text-sm flex items-center gap-1 font-semibold ltr-nums" style={{ color: "#2dd4bf" }}>
                  <Star className="w-3 h-3 fill-amber-400" /> {patient.loyalty_points} نقطة
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "المواعيد",     value: appts.length, color: "#5dd9cb", Icon: Calendar },
          { label: "مكتملة",      value: completed,    color: "#34D399", Icon: CheckCircle2 },
          { label: "ملغاة",       value: cancelled,    color: "#94A3B8", Icon: XCircle },
          { label: "لم يحضر",    value: noShow,       color: "#F87171", Icon: AlertCircle },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3.5 flex items-center gap-3"
            style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <s.Icon className="w-4 h-4 shrink-0" style={{ color: s.color }} />
            <div>
              <p className="text-lg font-black ltr-nums" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.5)" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout: demographics + revenue */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Demographics */}
        <div className="rounded-2xl p-5 space-y-3"
          style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
          <h3 className="font-bold text-white flex items-center gap-2 mb-4">
            <User className="w-4 h-4" style={{ color: "#14b8a6" }} />
            البيانات الشخصية
          </h3>
          {[
            { label: "العمر",        value: patientAge ? `${patientAge} سنة` : null },
            { label: "تاريخ الميلاد", value: patient.dob ? new Date(patient.dob).toLocaleDateString("ar-SA") : null },
            { label: "الجنس",        value: genderAr(patient.gender) },
            { label: "الجنسية",      value: patient.nationality },
            { label: "الهوية الوطنية", value: patient.national_id },
            { label: "البريد",        value: patient.email },
            { label: "مصدر التسجيل", value: patient.source_channel },
            { label: "تاريخ التسجيل", value: new Date(patient.created_at).toLocaleDateString("ar-SA") },
          ]
            .filter((r) => r.value)
            .map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span style={{ color: "rgba(148,163,184,0.5)" }}>{row.label}</span>
                <span className="font-semibold text-white ltr-nums">{row.value}</span>
              </div>
            ))}
        </div>

        {/* Financial summary */}
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
          <h3 className="font-bold text-white flex items-center gap-2 mb-4">
            <Banknote className="w-4 h-4" style={{ color: "#14b8a6" }} />
            الملخص المالي
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>إجمالي الفواتير</span>
              <span className="font-bold ltr-nums" style={{ color: "#2dd4bf" }}>{invoices.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>مجموع المدفوع</span>
              <span className="font-bold ltr-nums" style={{ color: "#34D399" }}>
                {totalPaid.toLocaleString("ar-SA")} ر.ع
              </span>
            </div>
            {invoices.slice(0, 4).map((inv) => {
              const s = INV_STATUS[inv.status] ?? INV_STATUS.draft;
              return (
                <div key={inv.id} className="flex items-center justify-between text-sm py-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "rgba(148,163,184,0.55)" }}>
                    {new Date(inv.created_at).toLocaleDateString("ar-SA")}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold ltr-nums" style={{ color: "#2dd4bf" }}>
                      {inv.total?.toLocaleString("ar-SA")} ر.ع
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                  </div>
                </div>
              );
            })}
            {invoices.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: "rgba(148,163,184,0.3)" }}>لا توجد فواتير</p>
            )}
          </div>
        </div>
      </div>

      {/* Appointment history */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "#14b8a6" }} />
            سجل المواعيد
          </h3>
          <span className="text-[11px] px-2.5 py-1 rounded-full ltr-nums"
            style={{ background: "rgba(20,184,166,0.1)", color: "#5dd9cb", border: "1px solid rgba(20,184,166,0.2)" }}>
            {appts.length} موعد
          </span>
        </div>

        {appts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Calendar className="w-8 h-8" style={{ color: "rgba(148,163,184,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(148,163,184,0.4)" }}>لا توجد مواعيد مسجّلة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  {["التاريخ والوقت", "الطبيب", "الخدمة", "المدة", "الحالة"].map((h) => (
                    <th key={h} className="text-right py-3 px-5 text-[12px] font-semibold"
                      style={{ color: "rgba(148,163,184,0.5)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appts.map((appt, i) => {
                  const s = APPT_STATUS[appt.status] ?? APPT_STATUS.scheduled;
                  const doctor = appt.tawd_staff_users;
                  const service = appt.services;
                  return (
                    <tr key={appt.id}
                      style={{ borderBottom: i < appts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                      <td className="py-3.5 px-5">
                        <div>
                          <p className="font-semibold text-white ltr-nums">
                            {new Date(appt.slot_time).toLocaleDateString("ar-SA")}
                          </p>
                          <p className="text-[11px] mt-0.5 ltr-nums flex items-center gap-1"
                            style={{ color: "rgba(148,163,184,0.5)" }}>
                            <Clock className="w-3 h-3" />
                            {new Date(appt.slot_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-medium text-white">
                          {doctor ? (doctor.name_ar ?? doctor.name) : "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span style={{ color: "rgba(148,163,184,0.7)" }}>
                          {service ? (service.name_ar ?? service.name) : "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="ltr-nums text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
                          {appt.duration_minutes} د
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center text-[11px] px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
