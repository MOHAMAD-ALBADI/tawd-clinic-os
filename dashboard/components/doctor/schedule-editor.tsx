"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock, Plane, Save, Trash2, CheckCircle2, AlertTriangle, Copy, Timer,
} from "lucide-react";
import { saveWeeklySchedule, requestLeave, cancelLeave, type WeekDayInput } from "@/app/actions/doctor";
import { arDayDate, fromDateOnly } from "@/lib/ar-format";

const DAYS: { key: WeekDayInput["day"]; label: string }[] = [
  { key: "sunday",    label: "الأحد" },
  { key: "monday",    label: "الإثنين" },
  { key: "tuesday",   label: "الثلاثاء" },
  { key: "wednesday", label: "الأربعاء" },
  { key: "thursday",  label: "الخميس" },
  { key: "friday",    label: "الجمعة" },
  { key: "saturday",  label: "السبت" },
];

export type ScheduleRow = { day_of_week: string; start_time: string; end_time: string };
export type LeaveRow = { id: string; holiday_date: string; name_ar: string | null };

export function ScheduleEditor({
  schedule,
  leaves,
}: {
  schedule: ScheduleRow[];
  leaves: LeaveRow[];
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();

  const initial = DAYS.map((d) => {
    const row = schedule.find((s) => s.day_of_week === d.key);
    return {
      day: d.key,
      active: !!row,
      start: row ? row.start_time.slice(0, 5) : "09:00",
      end: row ? row.end_time.slice(0, 5) : "18:00",
    };
  });
  const [days, setDays] = useState<WeekDayInput[]>(initial);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [saved, setSaved] = useState(false);

  /* This schedule is what Sura books against, so a silent failure here means
     patients get offered hours the doctor is not working. The error has to be
     on the page next to the schedule, not in a dialog that disappears. */
  const [err, setErr] = useState<string | null>(null);

  const patch = (i: number, p: Partial<WeekDayInput>) =>
    setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...p } : d)));

  function saveSchedule() {
    setErr(null);
    startSave(async () => {
      try {
        await saveWeeklySchedule(days);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "تعذّر حفظ الدوام");
      }
    });
  }

  function addLeave() {
    if (!leaveDate) { setErr("اختر تاريخ الإجازة أولاً"); return; }
    setErr(null);
    startSave(async () => {
      try {
        await requestLeave(leaveDate, leaveReason);
        setLeaveDate(""); setLeaveReason("");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "تعذّر تسجيل الإجازة");
      }
    });
  }

  function removeLeave(id: string) {
    setErr(null);
    startSave(async () => {
      try { await cancelLeave(id); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : "تعذّر إلغاء الإجازة"); }
    });
  }

  /* Latin digits, like the date picker directly above it and like every other
     number in the product. This used to render ٢٧ beside a field showing 27. */
  const fmtDate = (d: string) => arDayDate.format(fromDateOnly(d));

  /* Most doctors work the same hours most days; typing them seven times is the
     kind of chore that makes people leave the schedule wrong. */
  function copyToAllActive(from: WeekDayInput) {
    setDays((prev) => prev.map((d) => (d.active ? { ...d, start: from.start, end: from.end } : d)));
  }

  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const weeklyMinutes = days
    .filter((d) => d.active)
    .reduce((sum, d) => sum + Math.max(0, minutes(d.end) - minutes(d.start)), 0);
  const activeDays = days.filter((d) => d.active).length;
  const invalid = days.filter((d) => d.active && minutes(d.end) <= minutes(d.start));

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      {err && (
        <div className="lg:col-span-2 flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {/* weekly hours */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
          <CalendarClock className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          دوامي الأسبوعي
        </h3>
        <p className="text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
          سُرى تحجز مواعيدك حسب هذا الجدول تلقائياً
        </p>

        {/* What the schedule adds up to. A doctor setting hours is deciding how
            much of their week the clinic may sell, and the total was nowhere. */}
        <div className="flex items-center gap-4 flex-wrap mb-3 px-3.5 py-2.5 rounded-xl text-[12px]"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
            <Timer className="w-3.5 h-3.5" />
            <span className="font-black ltr-nums text-white">
              {Math.floor(weeklyMinutes / 60)}:{String(weeklyMinutes % 60).padStart(2, "0")}
            </span> ساعة أسبوعياً
          </span>
          <span style={{ color: "var(--text-3)" }}>
            <span className="font-black ltr-nums text-white">{activeDays}</span> أيام عمل
          </span>
        </div>

        {/* A doctor with no working day is invisible to booking — the most
            consequential state on this page and it used to say nothing. */}
        {activeDays === 0 && (
          <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl mb-3"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24" }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            لا يوم عمل مفعّل — لن تعرض سُرى ولا صفحة الحجز أي موعد لك
          </div>
        )}
        {invalid.length > 0 && (
          <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl mb-3"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            وقت الانتهاء قبل البداية في {invalid.length} يوم — صحّحه قبل الحفظ
          </div>
        )}

        <div className="space-y-1.5">
          {days.map((d, i) => {
            const label = DAYS.find((x) => x.key === d.day)!.label;
            return (
              <div
                key={d.day}
                className="flex items-center gap-3 px-3 py-2 rounded-xl flex-wrap"
                style={{
                  background: d.active ? "rgb(var(--accent-1-rgb) / 0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${d.active ? "rgb(var(--accent-1-rgb) / 0.16)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                <button
                  onClick={() => patch(i, { active: !d.active })}
                  className="w-9 h-5 rounded-full relative transition-colors shrink-0"
                  style={{ background: d.active ? "var(--accent-2)" : "rgba(255,255,255,0.12)" }}
                  aria-label={`تفعيل ${label}`}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ insetInlineStart: d.active ? "calc(100% - 1.125rem)" : "0.125rem" }}
                  />
                </button>
                <span className="text-[13px] font-semibold w-16" style={{ color: d.active ? "#fff" : "var(--text-4)" }}>
                  {label}
                </span>
                {d.active ? (
                  <>
                    <div className="flex items-center gap-1.5 ltr-nums" dir="ltr">
                      <input
                        type="time" value={d.start}
                        onChange={(e) => patch(i, { start: e.target.value })}
                        className="field" style={{ width: 96, padding: "0.3rem 0.5rem", fontSize: 12 }}
                      />
                      <span style={{ color: "var(--text-4)" }}>→</span>
                      <input
                        type="time" value={d.end}
                        onChange={(e) => patch(i, { end: e.target.value })}
                        className="field" style={{ width: 96, padding: "0.3rem 0.5rem", fontSize: 12 }}
                      />
                    </div>
                    <button type="button" onClick={() => copyToAllActive(d)} title="طبّق هذه الأوقات على كل أيام عملك"
                      className="btn-ghost ms-auto" style={{ padding: "0.25rem 0.5rem" }}>
                      <Copy className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <span className="text-[11px]" style={{ color: "var(--text-4)" }}>إجازة أسبوعية</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={saveSchedule}
          disabled={saving || invalid.length > 0}
          className="btn-primary w-full mt-4"
          style={saved ? { background: "linear-gradient(135deg, #34d399, #10b981)", borderColor: "rgba(52,211,153,0.5)" } : undefined}
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "تم حفظ الدوام ✓" : saving ? "جارٍ الحفظ…" : "حفظ الدوام"}
        </button>
      </div>

      {/* leaves */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
          <Plane className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          إجازاتي
        </h3>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-3)" }}>
          أيام محددة لن تحجز سُرى فيها أي موعد لك
        </p>

        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            type="date"
            value={leaveDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setLeaveDate(e.target.value)}
            className="field ltr-nums" style={{ width: 150 }}
          />
          <input
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
            placeholder="السبب (اختياري)"
            className="field flex-1" style={{ minWidth: 120 }}
          />
          <button onClick={addLeave} disabled={saving} className="btn-ghost">إضافة</button>
        </div>

        {leaves.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--text-4)" }}>
            لا إجازات قادمة
          </p>
        ) : (
          <div className="space-y-1.5">
            {leaves.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-[13px] font-semibold text-white flex-1">{fmtDate(l.holiday_date)}</span>
                <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{l.name_ar}</span>
                <button
                  onClick={() => removeLeave(l.id)}
                  disabled={saving}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(244,63,94,0.08)", color: "#fda4b4" }}
                  aria-label="حذف الإجازة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
