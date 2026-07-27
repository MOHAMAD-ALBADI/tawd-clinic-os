"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight, ChevronLeft, CalendarPlus, AlertTriangle, Circle,
} from "lucide-react";

export type CalAppt = {
  id: string;
  slotTime: string;
  durationMinutes: number;
  status: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  service: string | null;
  hasAllergy: boolean;
};

export type CalDoctor = { id: string; label: string };
/** working window per doctor per weekday, minutes from midnight Muscat */
export type CalShift = { doctorId: string; weekday: number; startMin: number; endMin: number };

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const STATUS_COLOUR: Record<string, string> = {
  scheduled: "#a1a1aa", confirmed: "#5b93ff", checked_in: "#fbbf24",
  in_progress: "#34d399", completed: "#34d399", cancelled: "#52525b", no_show: "#f87171",
};

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Minutes-from-midnight in Muscat for an instant. */
function muscatMinutes(iso: string) {
  const d = new Date(new Date(iso).getTime() + 4 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function muscatDayKey(iso: string) {
  return new Date(new Date(iso).getTime() + 4 * 3600_000).toISOString().slice(0, 10);
}
function addDays(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

/** The week, by doctor, with the gaps visible.

    A list of today answers "who is next". It cannot answer the question the
    desk is asked twenty times a day — "when can the doctor see me?" — which
    needs the shape of the week and, more than the appointments, the holes
    between them. Empty working time is drawn as clickable space: click it and
    the booking form opens on that doctor at that minute. */
export function WeekCalendar({
  appts, doctors, shifts, startKey, todayKey, loadedFrom, loadedTo,
}: {
  appts: CalAppt[]; doctors: CalDoctor[]; shifts: CalShift[];
  startKey: string; todayKey: string;
  /** the range actually fetched — paging past it must not look like an empty week */
  loadedFrom: string; loadedTo: string;
}) {
  const [weekStart, setWeekStart] = useState(startKey);
  const [doctorFilter, setDoctorFilter] = useState<string>("");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  /* Outside the fetched window the grid would render empty, which reads as "no
     appointments" rather than "not loaded" — the difference between an empty
     clinic and a lie. */
  const outOfRange = days[0] < loadedFrom || days[6] > loadedTo;
  const shown = doctorFilter ? doctors.filter((d) => d.id === doctorFilter) : doctors;

  /* The rendered hour range covers every shift in the week plus anything booked
     outside it — an appointment placed off-hours must still be visible. */
  const { fromMin, toMin } = useMemo(() => {
    let lo = 24 * 60, hi = 0;
    for (const s of shifts) { lo = Math.min(lo, s.startMin); hi = Math.max(hi, s.endMin); }
    for (const a of appts) {
      const m = muscatMinutes(a.slotTime);
      lo = Math.min(lo, m); hi = Math.max(hi, m + a.durationMinutes);
    }
    if (hi <= lo) { lo = 9 * 60; hi = 18 * 60; }
    return { fromMin: Math.floor(lo / 60) * 60, toMin: Math.ceil(hi / 60) * 60 };
  }, [shifts, appts]);

  const span = Math.max(60, toMin - fromMin);
  const PX_PER_MIN = 1.15;
  const height = span * PX_PER_MIN;
  const hours = Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => fromMin + i * 60);

  const byDayDoctor = useMemo(() => {
    const m = new Map<string, CalAppt[]>();
    for (const a of appts) {
      const k = `${muscatDayKey(a.slotTime)}|${a.doctorId}`;
      const l = m.get(k) ?? [];
      l.push(a);
      m.set(k, l);
    }
    return m;
  }, [appts]);

  const shiftFor = (doctorId: string, key: string) =>
    shifts.find((s) => s.doctorId === doctorId && s.weekday === weekdayOf(key)) ?? null;

  const weekLabel = new Intl.DateTimeFormat("ar-u-nu-latn", { day: "numeric", month: "long" });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronRight className="w-4 h-4" /> الأسبوع السابق
        </button>
        <button className="btn-ghost" onClick={() => setWeekStart(startKey)}>هذا الأسبوع</button>
        <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          الأسبوع التالي <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[12.5px] font-bold text-white ms-2">
          {weekLabel.format(new Date(`${days[0]}T12:00:00Z`))} — {weekLabel.format(new Date(`${days[6]}T12:00:00Z`))}
        </span>

        {doctors.length > 1 && (
          <select className="field ms-auto" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
            style={{ width: "auto", minWidth: 150, cursor: "pointer" }}>
            <option value="">كل الأطباء</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        )}
      </div>

      {outOfRange && (
        <div className="flex items-center gap-2 text-[12.5px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          هذا الأسبوع خارج النطاق المحمَّل — قد لا تظهر كل المواعيد. ارجع لـ«هذا الأسبوع».
        </div>
      )}

      <div className="panel overflow-x-auto" style={{ padding: "1rem" }}>
        <div className="flex gap-2" style={{ minWidth: 900 }}>
          {/* hour gutter */}
          <div className="shrink-0" style={{ width: 44, paddingTop: 30 }}>
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <span key={h} className="absolute text-[10px] ltr-nums"
                  style={{ top: (h - fromMin) * PX_PER_MIN - 6, color: "var(--text-4)" }}>
                  {hhmm(h)}
                </span>
              ))}
            </div>
          </div>

          {days.map((key) => {
            const isToday = key === todayKey;
            return (
              <div key={key} className="flex-1" style={{ minWidth: 108 }}>
                <div className="text-center mb-1.5">
                  <p className="text-[11.5px] font-bold" style={{ color: isToday ? "var(--accent-1)" : "var(--text-2)" }}>
                    {DAYS[weekdayOf(key)]}
                  </p>
                  <p className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>{key.slice(5)}</p>
                </div>

                <div className="flex gap-1">
                  {shown.map((doc) => {
                    const shift = shiftFor(doc.id, key);
                    const list = byDayDoctor.get(`${key}|${doc.id}`) ?? [];
                    return (
                      <div key={doc.id} className="relative flex-1 rounded-lg overflow-hidden"
                        style={{
                          height,
                          background: isToday ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
                          border: "1px solid var(--hairline-2)",
                        }}
                        title={doc.label}>
                        {/* hour lines */}
                        {hours.map((h) => (
                          <div key={h} className="absolute w-full"
                            style={{ top: (h - fromMin) * PX_PER_MIN, height: 1, background: "rgba(255,255,255,0.045)" }} />
                        ))}

                        {/* working window — clickable empty time */}
                        {shift ? (
                          <Link
                            href={`/reception/book?doctor=${doc.id}&date=${key}`}
                            className="absolute block transition-colors hover:bg-white/[0.04]"
                            title={`${doc.label} — ${hhmm(shift.startMin)} إلى ${hhmm(shift.endMin)} · اضغط للحجز`}
                            style={{
                              top: (shift.startMin - fromMin) * PX_PER_MIN,
                              height: (shift.endMin - shift.startMin) * PX_PER_MIN,
                              insetInlineStart: 0, insetInlineEnd: 0,
                              background: "rgb(var(--accent-1-rgb) / 0.045)",
                              borderTop: "1px solid rgb(var(--accent-1-rgb) / 0.15)",
                              borderBottom: "1px solid rgb(var(--accent-1-rgb) / 0.15)",
                            }} />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[9.5px]" style={{ color: "var(--text-4)" }}>إجازة</span>
                          </div>
                        )}

                        {list.map((a) => {
                          const top = (muscatMinutes(a.slotTime) - fromMin) * PX_PER_MIN;
                          const h = Math.max(16, a.durationMinutes * PX_PER_MIN - 2);
                          const c = STATUS_COLOUR[a.status] ?? "#a1a1aa";
                          const dim = ["cancelled", "no_show"].includes(a.status);
                          return (
                            <Link key={a.id} href={`/reception/patients/${a.patientId}`}
                              className="absolute rounded px-1 py-0.5 overflow-hidden"
                              title={`${a.patientName} · ${a.service ?? ""} · ${doc.label}`}
                              style={{
                                top, height: h, insetInlineStart: 2, insetInlineEnd: 2,
                                background: `${c}22`,
                                borderInlineStart: `2px solid ${c}`,
                                opacity: dim ? 0.5 : 1,
                                textDecoration: dim ? "line-through" : undefined,
                              }}>
                              <p className="text-[9.5px] font-bold text-white truncate leading-tight">
                                {a.hasAllergy && <AlertTriangle className="w-2.5 h-2.5 inline" style={{ color: "#fda4b4" }} />}
                                {a.patientName}
                              </p>
                              {h > 26 && (
                                <p className="text-[9px] truncate leading-tight" style={{ color: "var(--text-3)" }}>
                                  {a.service ?? ""}
                                </p>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[10.5px]" style={{ color: "var(--text-4)" }}>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ background: "rgb(var(--accent-1-rgb) / 0.12)", border: "1px solid rgb(var(--accent-1-rgb) / 0.3)" }} />
          وقت متاح — اضغط للحجز
        </span>
        {Object.entries({ confirmed: "مؤكد", checked_in: "وصل", completed: "مكتمل", no_show: "لم يحضر" }).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1">
            <Circle className="w-2 h-2" style={{ fill: STATUS_COLOUR[k], color: STATUS_COLOUR[k] }} /> {l}
          </span>
        ))}
        {shown.length > 1 && <span className="ms-auto">كل عمود يوم — والأعمدة الداخلية أطباء</span>}
      </div>

      <Link href="/reception/book" className="btn-primary">
        <CalendarPlus className="w-4 h-4" /> حجز موعد
      </Link>
    </div>
  );
}
