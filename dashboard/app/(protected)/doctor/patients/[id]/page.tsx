import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AddNoteForm } from "@/components/doctor/add-note-form";
import { RecordVitalsForm } from "@/components/doctor/record-vitals-form";
import { ArrowRight, Phone, Cake, NotebookPen, Activity, Lock, CalendarDays } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "مجدول", color: "#94A3B8" }, confirmed: { label: "مؤكد", color: "#5dd9cb" },
  checked_in: { label: "حضَر", color: "#38bdf8" }, in_progress: { label: "جارٍ", color: "#fbbf24" },
  completed: { label: "مكتمل", color: "#34D399" }, cancelled: { label: "ملغي", color: "#94A3B8" }, no_show: { label: "لم يحضر", color: "#F87171" },
};

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob); const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}
const dt = (iso: string) => new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
const d = (iso: string) => new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export default async function PatientFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const { data: patient } = await supabase
    .from("patients").select("id, name, phone, dob")
    .eq("id", id).eq("clinic_id", claims.clinic_id).single();
  if (!patient) notFound();

  const [{ data: vitals }, { data: notes }, { data: appts }] = await Promise.all([
    supabase.from("patient_vitals").select("*").eq("patient_id", id).order("recorded_at", { ascending: false }).limit(10),
    supabase.from("patient_notes").select("id, note_text, is_private, created_at, doctor_id").eq("patient_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("appointments").select("id, slot_time, status, services(name_ar)").eq("patient_id", id).is("deleted_at", null).order("slot_time", { ascending: false }).limit(15),
  ]);

  const v = vitals ?? []; const latest = v[0];
  const noteList = notes ?? [];
  const apptList = appts ?? [];

  // author names
  const docIds = [...new Set(noteList.map((n) => n.doctor_id).filter(Boolean))];
  const nameMap: Record<string, string> = {};
  if (docIds.length) {
    const { data: staff } = await supabase.from("tawd_staff_users").select("id, name").in("id", docIds);
    for (const s of staff ?? []) nameMap[s.id] = s.name;
  }

  const vitalCard = (label: string, val: unknown, unit = "") =>
    val !== null && val !== undefined ? (
      <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>{label}</div>
        <div className="text-base font-bold text-white ltr-nums">{String(val)}<span className="text-[10px] font-normal mr-1" style={{ color: "rgba(148,163,184,0.5)" }}>{unit}</span></div>
      </div>
    ) : null;

  const a = age(patient.dob);

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/doctor/patients" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لمرضاي
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(6,14,30,0.92) 60%)", border: "1px solid rgba(45,212,191,0.2)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
          {patient.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white truncate">{patient.name}</h2>
          <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
            {patient.phone && <span className="flex items-center gap-1 ltr-nums"><Phone className="w-3 h-3" /> {patient.phone}</span>}
            {a !== null && <span className="flex items-center gap-1"><Cake className="w-3 h-3" /> {a} سنة</span>}
          </div>
        </div>
      </div>

      {/* Latest vitals */}
      {latest && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm"><Activity className="w-4 h-4" style={{ color: "#5dd9cb" }} /> أحدث العلامات الحيوية <span className="text-[10px] font-normal" style={{ color: "rgba(148,163,184,0.45)" }}>· {dt(latest.recorded_at)}</span></h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {vitalCard("الوزن", latest.weight_kg, "كجم")}
            {vitalCard("الطول", latest.height_cm, "سم")}
            {vitalCard("BMI", latest.bmi)}
            {vitalCard("الضغط", latest.blood_pressure_systolic && latest.blood_pressure_diastolic ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}` : null)}
            {vitalCard("النبض", latest.pulse_bpm, "bpm")}
            {vitalCard("الحرارة", latest.temperature_c, "°م")}
            {vitalCard("الأكسجين", latest.oxygen_saturation, "%")}
          </div>
        </div>
      )}

      {/* Action forms */}
      <div className="grid lg:grid-cols-2 gap-4">
        <AddNoteForm patientId={id} />
        <RecordVitalsForm patientId={id} />
      </div>

      {/* Clinical notes timeline */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm"><NotebookPen className="w-4 h-4" style={{ color: "#5dd9cb" }} /> الملاحظات السريرية</h3>
        {noteList.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "rgba(148,163,184,0.45)" }}>لا ملاحظات بعد</p>
        ) : (
          <div className="space-y-3">
            {noteList.map((n) => (
              <div key={n.id} className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "rgba(226,232,240,0.9)", lineHeight: 1.7 }}>{n.note_text}</p>
                <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: "rgba(148,163,184,0.45)" }}>
                  <span>{nameMap[n.doctor_id] ? `د. ${nameMap[n.doctor_id]}` : "الطبيب"}</span>
                  <span>·</span><span>{dt(n.created_at)}</span>
                  {n.is_private && <span className="flex items-center gap-0.5" style={{ color: "#38bdf8" }}><Lock className="w-2.5 h-2.5" /> خاصة</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment history */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm"><CalendarDays className="w-4 h-4" style={{ color: "#5dd9cb" }} /> سجل المواعيد</h3>
        {apptList.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "rgba(148,163,184,0.45)" }}>لا مواعيد</p>
        ) : (
          <div className="space-y-1.5">
            {apptList.map((ap) => {
              const st = STATUS[ap.status] ?? STATUS.scheduled;
              return (
                <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="text-xs ltr-nums shrink-0" style={{ color: "rgba(148,163,184,0.6)" }}>{d(ap.slot_time)}</span>
                  <span className="flex-1 text-xs truncate" style={{ color: "rgba(226,232,240,0.85)" }}>{(ap.services as unknown as { name_ar: string } | null)?.name_ar ?? "—"}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${st.color}1a`, color: st.color }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
