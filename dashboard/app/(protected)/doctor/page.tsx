import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { Stethoscope, ChevronLeft, AlertTriangle, NotebookPen, Clock } from "lucide-react";

export const metadata = { title: "جدولي اليوم — طود" };

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "مجدول",      color: "#a1a1aa" },
  confirmed:   { label: "مؤكد",       color: "#e4e4e7" },
  checked_in:  { label: "حضَر",       color: "#5dd9cb" },
  in_progress: { label: "جارٍ الكشف", color: "#2dd4bf" },
  completed:   { label: "مكتمل",      color: "#5dd9cb" },
  cancelled:   { label: "ملغي",       color: "#71717a" },
  no_show:     { label: "لم يحضر",    color: "#fda4b4" },
};

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

type J = { name: string } | null;

export default async function DoctorTodayPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${today.slice(0, 7)}-01T00:00:00`;

  const [{ data }, { data: monthAppts }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, slot_time, status, patient_id, patients(name), services(name_ar)")
      .eq("doctor_id", claims.sub)
      .is("deleted_at", null)
      .gte("slot_time", `${today}T00:00:00`)
      .lte("slot_time", `${today}T23:59:59`)
      .order("slot_time"),
    supabase
      .from("appointments")
      .select("status")
      .eq("doctor_id", claims.sub)
      .is("deleted_at", null)
      .gte("slot_time", monthStart)
      .limit(1000),
  ]);

  const appts = data ?? [];
  const completed  = appts.filter((a) => a.status === "completed").length;
  const remaining  = appts.filter((a) => ["scheduled", "confirmed", "checked_in"].includes(a.status)).length;
  const inProgress = appts.filter((a) => a.status === "in_progress");
  const monthDone  = (monthAppts ?? []).filter((a) => a.status === "completed").length;

  /* medical red-flags for today's patients */
  const patientIds = [...new Set(appts.map((a) => a.patient_id).filter(Boolean))];
  const flagMap: Record<string, string[]> = {};
  if (patientIds.length) {
    const { data: hist } = await supabase
      .from("medical_histories")
      .select("patient_id, allergies")
      .in("patient_id", patientIds);
    for (const h of hist ?? []) {
      const al = (h.allergies as string[] | null) ?? [];
      if (al.length) flagMap[h.patient_id] = al;
    }
  }

  /* the hero: current exam, otherwise next waiting patient */
  const current = inProgress[0] ?? null;
  const next =
    current ??
    appts.find((a) => ["checked_in", "confirmed", "scheduled"].includes(a.status)) ??
    null;
  const nextName = next ? ((next.patients as unknown as J)?.name ?? "مريض") : null;
  const nextSvc  = next ? ((next.services as unknown as { name_ar: string } | null)?.name_ar ?? "") : "";
  const nextFlags = next ? (flagMap[next.patient_id] ?? []) : [];

  /* previous visits count for the hero patient */
  let prevVisits = 0;
  if (next) {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", next.patient_id)
      .eq("status", "completed")
      .is("deleted_at", null);
    prevVisits = count ?? 0;
  }

  const todayAr = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* header strip */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">جدولي اليوم</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{todayAr}</p>
        </div>
        <div className="flex items-center gap-4">
          {[
            { l: "اليوم", v: appts.length },
            { l: "مكتمل", v: completed },
            { l: "متبقٍ", v: remaining },
            { l: "هذا الشهر", v: monthDone },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-lg font-bold ltr-nums text-white leading-none">{s.v}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-4)" }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ NEXT PATIENT hero ══ */}
      {next ? (
        <div className="panel-feature relative overflow-hidden" style={{ padding: "1.5rem 1.75rem" }}>
          <div className="flex items-center gap-2 mb-4">
            <TawdBarsGlyph size={12} />
            <p className="eyebrow">{current ? "الكشف الجاري الآن" : "المريض التالي"}</p>
            {current && <span className="live-dot" />}
          </div>

          <div className="flex items-center gap-5 flex-wrap">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 text-white"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              {nextName!.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-bold text-white">{nextName}</h3>
                {nextFlags.length > 0 && (
                  <span className="badge badge-bad">
                    <AlertTriangle className="w-3 h-3" />
                    حساسية: {nextFlags.slice(0, 3).join("، ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap" style={{ color: "var(--text-3)" }}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="ltr-nums font-bold" style={{ color: "var(--text-1)" }}>{fmtTime(next.slot_time)}</span>
                </span>
                {nextSvc && <span>{nextSvc}</span>}
                <span className="flex items-center gap-1">
                  <NotebookPen className="w-3 h-3" />
                  {prevVisits > 0 ? `${prevVisits} زيارة سابقة` : "أول زيارة"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/doctor/exam/${next.id}`} className="btn-primary">
                <Stethoscope className="w-4 h-4" />
                {current ? "متابعة الكشف" : "ابدأ الكشف"}
              </Link>
              <Link href={`/doctor/patients/${next.patient_id}`} className="btn-ghost">
                الملف الكامل
              </Link>
            </div>
          </div>
        </div>
      ) : (
        appts.length > 0 && (
          <div className="panel flex items-center gap-3" style={{ padding: "1.25rem 1.5rem" }}>
            <span className="badge badge-brand">انتهى يومك ✓</span>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>أنجزت كل مواعيد اليوم</p>
          </div>
        )
      )}

      {/* ══ today list ══ */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="section-title mb-4">
          <TawdBarsGlyph size={13} />
          <h2>مرضى اليوم</h2>
        </div>

        {appts.length === 0 ? (
          <div className="text-center py-12">
            <Stethoscope className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
            <p className="text-sm" style={{ color: "var(--text-3)" }}>لا مواعيد اليوم</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {appts.map((a) => {
              const st = STATUS[a.status] ?? STATUS.scheduled;
              const name = (a.patients as unknown as J)?.name ?? "مجهول";
              const svc = (a.services as unknown as { name_ar: string } | null)?.name_ar ?? "";
              const flags = flagMap[a.patient_id] ?? [];
              const active = a.status === "in_progress";
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl flex-wrap"
                  style={{
                    background: active ? "rgba(45,212,191,0.05)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? "rgba(45,212,191,0.2)" : "rgba(255,255,255,0.05)"}`,
                  }}
                >
                  <span className="text-sm font-bold ltr-nums w-16 shrink-0 text-white">{fmtTime(a.slot_time)}</span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/doctor/patients/${a.patient_id}`} className="font-semibold text-sm text-white hover:underline truncate">
                        {name}
                      </Link>
                      {flags.length > 0 && (
                        <span title={`حساسية: ${flags.join("، ")}`}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#fda4b4" }} />
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-4)" }}>{svc}</span>
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1.5"
                    style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                    {st.label}
                  </span>
                  {["checked_in", "in_progress"].includes(a.status) && (
                    <Link
                      href={`/doctor/exam/${a.id}`}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                      style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.2)", color: "#5dd9cb" }}
                    >
                      الكشف
                    </Link>
                  )}
                  <AppointmentActions id={a.id} status={a.status} />
                  <Link href={`/doctor/patients/${a.patient_id}`} className="text-[11px] flex items-center gap-0.5 shrink-0" style={{ color: "var(--text-4)" }}>
                    الملف <ChevronLeft className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
