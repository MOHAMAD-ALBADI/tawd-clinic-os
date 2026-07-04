import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExamForm } from "@/components/doctor/exam-form";
import { RecordVitalsForm } from "@/components/doctor/record-vitals-form";
import { ArrowRight, AlertTriangle, HeartPulse, NotebookPen, Clock } from "lucide-react";

export const metadata = { title: "وضع الكشف — طود" };

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
const fmtDT = (iso: string) =>
  new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

export default async function ExamPage({ params }: { params: Promise<{ apptId: string }> }) {
  const { apptId } = await params;
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, slot_time, status, patient_id, patients(name, phone, dob), services(name_ar)")
    .eq("id", apptId)
    .eq("doctor_id", claims.sub)
    .is("deleted_at", null)
    .single();
  if (!appt) notFound();

  /* auto-start the exam when entering */
  if (["scheduled", "confirmed", "checked_in"].includes(appt.status)) {
    await supabase
      .from("appointments")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", apptId)
      .eq("doctor_id", claims.sub);
  }

  const pid = appt.patient_id;
  const [{ data: history }, { data: vitals }, { data: notes }] = await Promise.all([
    supabase.from("medical_histories").select("blood_type, allergies, chronic_diseases, current_medications, notes").eq("patient_id", pid).maybeSingle(),
    supabase.from("patient_vitals").select("weight_kg, bmi, blood_pressure_systolic, blood_pressure_diastolic, pulse_bpm, recorded_at").eq("patient_id", pid).order("recorded_at", { ascending: false }).limit(1),
    supabase.from("patient_notes").select("note_text, created_at").eq("patient_id", pid).order("created_at", { ascending: false }).limit(3),
  ]);

  const patient = appt.patients as unknown as { name: string; phone: string | null; dob: string | null } | null;
  const name = patient?.name ?? "مريض";
  const allergies = (history?.allergies as string[] | null) ?? [];
  const chronic = (history?.chronic_diseases as string[] | null) ?? [];
  const meds = (history?.current_medications as string[] | null) ?? [];
  const latestVitals = (vitals ?? [])[0];

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/doctor" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لجدولي
      </Link>

      {/* exam header */}
      <div className="panel-feature flex items-center gap-4 flex-wrap" style={{ padding: "1.25rem 1.5rem" }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 text-white"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-white">{name}</h2>
            <span className="badge badge-brand">
              <span className="live-dot" style={{ width: 4, height: 4 }} />
              كشف جارٍ
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-3)" }}>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> <span className="ltr-nums">{fmtTime(appt.slot_time)}</span>
            </span>
            <span>{(appt.services as unknown as { name_ar: string } | null)?.name_ar ?? ""}</span>
          </div>
        </div>
        <Link href={`/doctor/patients/${pid}`} className="btn-ghost shrink-0">الملف الكامل</Link>
      </div>

      {/* allergy alarm — impossible to miss */}
      {allergies.length > 0 && (
        <div
          className="rounded-2xl flex items-center gap-3 px-4 py-3"
          style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)" }}
        >
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "#fda4b4" }} />
          <p className="text-sm font-bold" style={{ color: "#fda4b4" }}>
            حساسية: {allergies.join("، ")}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* main: the exam note */}
        <div className="lg:col-span-3 space-y-4">
          <ExamForm patientId={pid} appointmentId={apptId} />
          <RecordVitalsForm patientId={pid} />
        </div>

        {/* side: what the doctor needs at a glance */}
        <div className="lg:col-span-2 space-y-4">
          {/* medical snapshot */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
              <HeartPulse className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
              نبذة طبية
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-3)" }}>فصيلة الدم</span>
                <span className="font-bold ltr-nums text-white">
                  {history?.blood_type && history.blood_type !== "unknown" ? history.blood_type : "—"}
                </span>
              </div>
              <div>
                <p style={{ color: "var(--text-3)" }} className="mb-1">أمراض مزمنة</p>
                <p style={{ color: "var(--text-1)" }}>{chronic.length ? chronic.join("، ") : "لا يوجد"}</p>
              </div>
              <div>
                <p style={{ color: "var(--text-3)" }} className="mb-1">أدوية حالية</p>
                <p style={{ color: "var(--text-1)" }}>{meds.length ? meds.join("، ") : "لا يوجد"}</p>
              </div>
              {latestVitals && (
                <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <p style={{ color: "var(--text-3)" }} className="mb-1.5">آخر قراءة ({fmtDT(latestVitals.recorded_at)})</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 ltr-nums" style={{ color: "var(--text-1)" }}>
                    {latestVitals.weight_kg != null && <span>وزن {latestVitals.weight_kg}</span>}
                    {latestVitals.bmi != null && <span>BMI {latestVitals.bmi}</span>}
                    {latestVitals.blood_pressure_systolic != null && (
                      <span>ضغط {latestVitals.blood_pressure_systolic}/{latestVitals.blood_pressure_diastolic}</span>
                    )}
                    {latestVitals.pulse_bpm != null && <span>نبض {latestVitals.pulse_bpm}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* last notes */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
              <NotebookPen className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
              آخر الملاحظات
            </h3>
            {(notes ?? []).length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-4)" }}>لا ملاحظات سابقة — أول زيارة موثقة</p>
            ) : (
              <div className="space-y-2.5">
                {(notes ?? []).map((n, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[11px] whitespace-pre-wrap line-clamp-4" style={{ color: "var(--text-2)", lineHeight: 1.7 }}>
                      {n.note_text}
                    </p>
                    <p className="text-[10px] mt-1.5" style={{ color: "var(--text-4)" }}>{fmtDT(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
