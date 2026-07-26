import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { getDoctorDay, fmtTime, fmtDay, type DayAppt, type DoctorTask } from "@/lib/doctor-day";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import {
  Stethoscope, ChevronLeft, AlertTriangle, NotebookPen, Clock, Timer,
  ClipboardCheck, FileWarning, CalendarClock, Activity, HeartPulse, CalendarPlus,
} from "lucide-react";

export const metadata = { title: "جدولي اليوم — طود" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "مجدول",      color: "#a1a1aa" },
  confirmed:   { label: "مؤكد",       color: "#e4e4e7" },
  checked_in:  { label: "ينتظر",      color: "#fbbf24" },
  in_progress: { label: "جارٍ الكشف", color: "var(--accent-1)" },
  completed:   { label: "مكتمل",      color: "#34d399" },
  cancelled:   { label: "ملغي",       color: "#71717a" },
  no_show:     { label: "لم يحضر",    color: "#fda4b4" },
};

const TASK_ICON: Record<DoctorTask["kind"], typeof FileWarning> = {
  undocumented: NotebookPen,
  unsigned_rx: FileWarning,
  stalled_plan: ClipboardCheck,
  running_late: CalendarClock,
};

export default async function DoctorTodayPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const day = await getDoctorDay(claims.sub, claims.clinic_id);
  const { appts, tasks, focus, focusIsLive } = day;
  const hours = Math.floor(day.bookedMinutes / 60);
  const mins = day.bookedMinutes % 60;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">TODAY</p>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">جدولي اليوم</h1>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>{fmtDay(new Date().toISOString())}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Stat label="متبقٍ" value={day.remaining} lead />
          {day.waiting > 0 && <Stat label="ينتظر الآن" value={day.waiting} warn />}
          <Stat label="مكتمل" value={day.done} />
          <Stat label="على الكرسي" value={day.bookedMinutes ? `${hours}:${String(mins).padStart(2, "0")}` : "—"} />
          <Stat label="هذا الشهر" value={day.monthDone} />
        </div>
      </div>

      {/* ══ what needs doing ══
          The half a timetable cannot show. Research on clinical dashboards is
          unanimous that this — pending documentation, unsigned orders, overdue
          follow-up — is what a doctor opens the screen for; the schedule they
          already know. */}
      {tasks.length > 0 && (
        <div className="panel" style={{ padding: "1.25rem", borderColor: tasks.some((t) => t.urgent) ? "rgba(251,191,36,0.3)" : undefined }}>
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <div className="section-title">
              <ClipboardCheck className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
              <h2>يحتاج إجراء منك</h2>
            </div>
            <span className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>{tasks.length}</span>
          </div>
          <p className="text-[11px] mb-3" style={{ color: "var(--text-4)" }}>
            توثيق ناقص، وصفات بلا توقيع، خطط متوقفة، ومرضى تأخّروا
          </p>
          <div className="space-y-1.5">
            {tasks.slice(0, 8).map((t, i) => {
              const Icon = TASK_ICON[t.kind];
              return (
                <Link key={i} href={t.href}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${t.urgent ? "rgba(251,191,36,0.24)" : "var(--hairline)"}`,
                  }}>
                  <Icon className="w-4 h-4 shrink-0" style={{ color: t.urgent ? "#fbbf24" : "var(--text-3)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{t.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t.detail}</p>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-4)" }} />
                </Link>
              );
            })}
            {tasks.length > 8 && (
              <p className="text-[11px] pt-1" style={{ color: "var(--text-4)" }}>
                و<span className="ltr-nums">{tasks.length - 8}</span> بنداً آخر
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ the patient in front of you ══ */}
      {focus ? (
        <div className="panel-feature relative overflow-hidden" style={{ padding: "1.5rem 1.75rem" }}>
          <div className="flex items-center gap-2 mb-4">
            <TawdBarsGlyph size={12} />
            <p className="eyebrow">{focusIsLive ? "الكشف الجاري الآن" : "المريض التالي"}</p>
            {focusIsLive && <span className="live-dot" />}
            {!focusIsLive && focus.waitingMinutes !== null && (
              <span className="badge" style={{
                background: focus.waitingMinutes >= 20 ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)",
                color: focus.waitingMinutes >= 20 ? "#fda4b4" : "#fbbf24",
                border: "1px solid rgba(251,191,36,0.22)",
              }}>
                <Timer className="w-3 h-3" /> ينتظر منذ {focus.waitingMinutes} دقيقة
              </span>
            )}
          </div>

          <div className="flex items-center gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 text-white"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {focus.patientName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-bold text-white">{focus.patientName}</h3>
                {/* Allergies and chronic conditions are the two things that
                    change what you may safely do, so they sit on the patient's
                    name and not three clicks inside the file. */}
                {focus.allergies.length > 0 && (
                  <span className="badge badge-bad">
                    <AlertTriangle className="w-3 h-3" /> حساسية: {focus.allergies.slice(0, 3).join("، ")}
                  </span>
                )}
                {focus.chronic.length > 0 && (
                  <span className="badge" style={{ background: "rgba(56,189,248,0.1)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.22)" }}>
                    <HeartPulse className="w-3 h-3" /> {focus.chronic.slice(0, 2).join("، ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap" style={{ color: "var(--text-3)" }}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="ltr-nums font-bold" style={{ color: "var(--text-1)" }}>{fmtTime(focus.slotTime)}</span>
                </span>
                {focus.service && <span>{focus.service}</span>}
                <span className="flex items-center gap-1">
                  <NotebookPen className="w-3 h-3" />
                  {focus.visitsBefore > 0 ? `${focus.visitsBefore} زيارة سابقة` : "أول زيارة"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Link href={`/doctor/exam/${focus.id}`} className="btn-primary">
                <Stethoscope className="w-4 h-4" />
                {focusIsLive ? "متابعة الكشف" : "ابدأ الكشف"}
              </Link>
              <Link href={`/doctor/patients/${focus.patientId}`} className="btn-ghost">الملف الكامل</Link>
            </div>
          </div>
        </div>
      ) : appts.length > 0 ? (
        <div className="panel flex items-center gap-3" style={{ padding: "1.25rem 1.5rem" }}>
          <span className="badge badge-ok">انتهى يومك ✓</span>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>أنجزت كل مواعيد اليوم</p>
        </div>
      ) : null}

      {/* ══ the day ══ */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="section-title">
            <TawdBarsGlyph size={13} />
            <h2>مرضى اليوم</h2>
          </div>
          <Link href="/doctor/appointments" className="btn-ghost">
            كل مواعيدي <ChevronLeft className="w-3 h-3" />
          </Link>
        </div>

        {appts.length === 0 ? (
          /* An empty day is not an error and should not look like one. It should
             say what can be done with the time. */
          <div className="text-center py-10">
            <Stethoscope className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
            <p className="text-sm font-bold text-white mb-1">لا مواعيد اليوم</p>
            <p className="text-[12px] mb-5" style={{ color: "var(--text-4)" }}>
              وقت مناسب لإكمال التوثيق الناقص أو مراجعة خطط العلاج المتوقفة
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Link href="/doctor/patients" className="btn-ghost">مرضاي</Link>
              <Link href="/doctor/treatment-plans" className="btn-ghost">خطط العلاج</Link>
              <Link href="/doctor/schedule" className="btn-ghost">
                <CalendarPlus className="w-3.5 h-3.5" /> دوامي
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {appts.map((a) => <Row key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, lead, warn }: { label: string; value: number | string; lead?: boolean; warn?: boolean }) {
  return (
    <div className="pill">
      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="text-[14px] font-black ltr-nums"
        style={{ color: warn ? "#fbbf24" : lead ? "var(--accent-1)" : "#ffffff" }}>
        {value}
      </span>
    </div>
  );
}

function Row({ a }: { a: DayAppt }) {
  const st = STATUS[a.status] ?? STATUS.scheduled;
  const active = a.status === "in_progress";
  const waiting = a.status === "checked_in";

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-wrap"
      style={{
        background: active ? "rgb(var(--accent-1-rgb) / 0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${active ? "rgb(var(--accent-1-rgb) / 0.2)" : waiting ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.05)"}`,
      }}>
      <span className="text-sm font-bold ltr-nums w-16 shrink-0 text-white">{fmtTime(a.slotTime)}</span>

      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
        {a.patientName.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/doctor/patients/${a.patientId}`} className="font-semibold text-sm text-white hover:underline truncate">
            {a.patientName}
          </Link>
          {a.allergies.length > 0 && (
            <span title={`حساسية: ${a.allergies.join("، ")}`}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#fda4b4" }} />
            </span>
          )}
          {a.chronic.length > 0 && (
            <span title={`أمراض مزمنة: ${a.chronic.join("، ")}`}>
              <HeartPulse className="w-3.5 h-3.5 shrink-0" style={{ color: "#7dd3fc" }} />
            </span>
          )}
          {a.visitsBefore === 0 && (
            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgb(var(--accent-1-rgb) / 0.12)", color: "var(--accent-1)" }}>
              أول زيارة
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--text-4)" }}>
          {a.service ?? "—"}
          {a.durationMinutes ? <span className="ltr-nums"> · {a.durationMinutes} د</span> : null}
        </span>
      </div>

      {waiting && a.waitingMinutes !== null && (
        <span className="flex items-center gap-1 text-[11px] font-bold ltr-nums shrink-0"
          style={{ color: a.waitingMinutes >= 20 ? "#fda4b4" : "#fbbf24" }}>
          <Timer className="w-3 h-3" /> {a.waitingMinutes} د
        </span>
      )}

      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1.5"
        style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}>
        <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
        {st.label}
      </span>

      {["checked_in", "in_progress"].includes(a.status) && (
        <Link href={`/doctor/exam/${a.id}`}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)", color: "var(--accent-1)" }}>
          <Activity className="w-3 h-3 inline ms-1" />الكشف
        </Link>
      )}
      <AppointmentActions id={a.id} status={a.status} />
      <Link href={`/doctor/patients/${a.patientId}`} className="text-[11px] flex items-center gap-0.5 shrink-0"
        style={{ color: "var(--text-4)" }}>
        الملف <ChevronLeft className="w-3 h-3" />
      </Link>
    </div>
  );
}
