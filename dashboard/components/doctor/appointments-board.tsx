"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Calendar, ChevronLeft, AlertTriangle, HeartPulse, Stethoscope,
  Timer, X,
} from "lucide-react";
import { AppointmentActions } from "@/components/doctor/appointment-actions";

export type ApptRow = {
  id: string;
  slotTime: string;
  status: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  service: string | null;
  durationMinutes: number | null;
  allergies: string[];
  chronic: string[];
};

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "مجدول",      color: "#a1a1aa" },
  confirmed:   { label: "مؤكد",       color: "#e4e4e7" },
  checked_in:  { label: "ينتظر",      color: "#fbbf24" },
  in_progress: { label: "جارٍ الكشف", color: "var(--accent-1)" },
  completed:   { label: "مكتمل",      color: "#34d399" },
  cancelled:   { label: "ملغي",       color: "#71717a" },
  no_show:     { label: "لم يحضر",    color: "#fda4b4" },
};

const AR_TIME = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true });
const AR_DAY = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long" });
const KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Muscat", year: "numeric", month: "2-digit", day: "2-digit" });

type Range = "today" | "upcoming" | "past" | "all";

/** The doctor's own diary, with the controls a diary needs.

    It used to be a flat list of everything from today forward: no way back to
    last week's visit you wanted to re-read, no way to find a patient by name,
    no way to see only the ones who never showed. A list you cannot interrogate
    is a printout. */
export function AppointmentsBoard({ rows, todayKey }: { rows: ApptRow[]; todayKey: string }) {
  const [range, setRange] = useState<Range>("today");
  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [service, setService] = useState<string>("");

  const services = useMemo(
    () => [...new Set(rows.map((r) => r.service).filter(Boolean) as string[])].sort(),
    [rows],
  );

  const inRange = (r: ApptRow) => {
    const k = KEY.format(new Date(r.slotTime));
    if (range === "today") return k === todayKey;
    if (range === "upcoming") return k > todayKey;
    if (range === "past") return k < todayKey;
    return true;
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!inRange(r)) return false;
      if (statuses.length && !statuses.includes(r.status)) return false;
      if (service && r.service !== service) return false;
      if (term && !`${r.patientName} ${r.patientPhone ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, range, q, statuses, service, todayKey]);

  /* Past reads newest-first — you are looking for the visit that just happened.
     Future reads soonest-first, because that is the order you will live it. */
  const ordered = useMemo(() => {
    const c = [...filtered];
    c.sort((a, b) => range === "past"
      ? b.slotTime.localeCompare(a.slotTime)
      : a.slotTime.localeCompare(b.slotTime));
    return c;
  }, [filtered, range]);

  const groups = useMemo(() => {
    const m = new Map<string, ApptRow[]>();
    for (const r of ordered) {
      const k = KEY.format(new Date(r.slotTime));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()];
  }, [ordered]);

  const counts = useMemo(() => ({
    today: rows.filter((r) => KEY.format(new Date(r.slotTime)) === todayKey).length,
    upcoming: rows.filter((r) => KEY.format(new Date(r.slotTime)) > todayKey).length,
    past: rows.filter((r) => KEY.format(new Date(r.slotTime)) < todayKey).length,
    all: rows.length,
  }), [rows, todayKey]);

  /* Outcome summary for whatever is on screen — the number a doctor checks
     after filtering to "past 90 days" is how many of them actually turned up. */
  const summary = useMemo(() => {
    const done = ordered.filter((r) => r.status === "completed").length;
    const missed = ordered.filter((r) => r.status === "no_show").length;
    const cancelled = ordered.filter((r) => r.status === "cancelled").length;
    const closed = done + missed + cancelled;
    return { done, missed, cancelled, rate: closed ? Math.round((done / closed) * 100) : null };
  }, [ordered]);

  const toggleStatus = (s: string) =>
    setStatuses((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const dirty = q || statuses.length > 0 || service;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([["today", "اليوم"], ["upcoming", "القادمة"], ["past", "السابقة"], ["all", "الكل"]] as [Range, string][])
          .map(([k, label]) => {
            const on = range === k;
            return (
              <button key={k} onClick={() => setRange(k)}
                className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
                style={{
                  background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                  color: on ? "var(--accent-1)" : "var(--text-3)",
                }}>
                {label}<span className="ltr-nums text-[11px] opacity-70">{counts[k]}</span>
              </button>
            );
          })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المريض أو رقمه…" style={{ paddingInlineStart: 34 }} />
        </div>
        {services.length > 1 && (
          <select className="field" value={service} onChange={(e) => setService(e.target.value)}
            style={{ width: "auto", minWidth: 150, cursor: "pointer" }}>
            <option value="">كل الخدمات</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {dirty && (
          <button className="btn-ghost" onClick={() => { setQ(""); setStatuses([]); setService(""); }}>
            <X className="w-3.5 h-3.5" /> مسح
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.entries(STATUS).map(([k, v]) => {
          const on = statuses.includes(k);
          return (
            <button key={k} onClick={() => toggleStatus(k)}
              className="flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                background: on ? `${v.color}1f` : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? `${v.color}55` : "var(--hairline)"}`,
                color: on ? v.color : "var(--text-4)",
              }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} />
              {v.label}
            </button>
          );
        })}
      </div>

      {ordered.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap px-3.5 py-2.5 rounded-xl text-[12px]"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
          <span style={{ color: "var(--text-3)" }}>
            <span className="font-black ltr-nums text-white">{ordered.length}</span> موعد
          </span>
          <span style={{ color: "#34d399" }}><span className="font-black ltr-nums">{summary.done}</span> مكتمل</span>
          {summary.missed > 0 && <span style={{ color: "#fda4b4" }}><span className="font-black ltr-nums">{summary.missed}</span> غياب</span>}
          {summary.cancelled > 0 && <span style={{ color: "var(--text-4)" }}><span className="font-black ltr-nums">{summary.cancelled}</span> إلغاء</span>}
          {summary.rate !== null && (
            <span className="ms-auto" style={{ color: "var(--text-3)" }}>
              معدل الحضور <span className="font-black ltr-nums" style={{ color: summary.rate >= 85 ? "#34d399" : "#fbbf24" }}>{summary.rate}%</span>
            </span>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-16">
          <Calendar className="w-7 h-7" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {dirty ? "لا موعد يطابق البحث" : range === "past" ? "لا مواعيد سابقة" : "لا مواعيد في هذه الفترة"}
          </p>
        </div>
      ) : (
        groups.map(([k, list]) => (
          <div key={k}>
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <h3 className="text-xs font-bold" style={{ color: k === todayKey ? "var(--accent-1)" : "var(--text-3)" }}>
                {k === todayKey ? "اليوم · " : ""}{AR_DAY.format(new Date(list[0].slotTime))}
              </h3>
              <span className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>{list.length}</span>
            </div>
            <div className="panel overflow-hidden">
              {list.map((a, i) => {
                const st = STATUS[a.status] ?? STATUS.scheduled;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                    style={{ borderTop: i ? "1px solid var(--hairline-2)" : "none" }}>
                    <span className="text-sm font-bold ltr-nums w-16 shrink-0" style={{ color: "var(--accent-1)" }}>
                      {AR_TIME.format(new Date(a.slotTime))}
                    </span>
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
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-4)" }}>
                        {a.service ?? "—"}
                        {a.durationMinutes ? <span className="ltr-nums"> · {a.durationMinutes} د</span> : null}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1.5"
                      style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}>
                      <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                      {st.label}
                    </span>
                    {["checked_in", "in_progress"].includes(a.status) && (
                      <Link href={`/doctor/exam/${a.id}`} className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                        style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)", color: "var(--accent-1)" }}>
                        <Stethoscope className="w-3 h-3 inline ms-1" />الكشف
                      </Link>
                    )}
                    <AppointmentActions id={a.id} status={a.status} />
                    <Link href={`/doctor/patients/${a.patientId}`} className="text-[11px] flex items-center gap-0.5 shrink-0"
                      style={{ color: "var(--text-4)" }}>
                      الملف <ChevronLeft className="w-3 h-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {range === "past" && counts.past > 0 && (
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-4)" }}>
          <Timer className="w-3 h-3" /> تُعرض مواعيد آخر ٩٠ يوماً
        </p>
      )}
    </div>
  );
}
