"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, ChevronLeft, Phone, AlertTriangle, HeartPulse, ClipboardList,
  CalendarClock, UserPlus, Users, X,
} from "lucide-react";
import { arDateShort as AR_DATE } from "@/lib/ar-format";

export type DocPatient = {
  id: string;
  name: string;
  phone: string | null;
  /** visits with THIS doctor */
  visits: number;
  last: string | null;
  /** next booked appointment with anyone in the clinic */
  next: string | null;
  allergies: string[];
  chronic: string[];
  /** items still outstanding on an accepted plan */
  openPlanItems: number;
  mine: boolean;
};

type Scope = "mine" | "attention" | "all";

const fmt = (iso: string | null) => (iso ? AR_DATE.format(new Date(iso)) : "—");
const daysSince = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

/** The doctor's patient list.

    It used to be built purely from this doctor's own appointments, so a doctor
    with an empty diary saw an empty page even though the clinic was full — and
    covering a colleague, or looking up the patient phoning about yesterday,
    was impossible. The clinic's whole list is searchable now; "مرضاي" is a
    filter on it rather than the only thing that exists.

    Each row carries what decides whether to open the file: allergies, chronic
    conditions, unfinished treatment, and how long since they were last seen. */
export function PatientSearch({ patients }: { patients: DocPatient[] }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("mine");

  /* "Needs attention" is the list worth working from: unfinished treatment and
     no upcoming appointment, or not seen in six months. */
  const needsAttention = (p: DocPatient) => {
    const gap = daysSince(p.last);
    return (p.openPlanItems > 0 && !p.next) || (gap !== null && gap >= 180);
  };

  const counts = useMemo(() => ({
    mine: patients.filter((p) => p.mine).length,
    attention: patients.filter(needsAttention).length,
    all: patients.length,
  }), [patients]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return patients
      .filter((p) => {
        if (scope === "mine" && !p.mine) return false;
        if (scope === "attention" && !needsAttention(p)) return false;
        if (term && !`${p.name} ${p.phone ?? ""}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
  }, [patients, q, scope]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ["mine", "مرضاي", Users],
          ["attention", "بحاجة متابعة", AlertTriangle],
          ["all", "كل العيادة", UserPlus],
        ] as [Scope, string, typeof Users][]).map(([k, label, Icon]) => {
          const on = scope === k;
          const n = counts[k];
          return (
            <button key={k} onClick={() => setScope(k)}
              className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
              style={{
                background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                color: on ? "var(--accent-1)" : k === "attention" && n > 0 ? "#fbbf24" : "var(--text-3)",
              }}>
              <Icon className="w-3.5 h-3.5" />
              {label}<span className="ltr-nums text-[11px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
          style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المريض أو رقمه — في كل العيادة" style={{ paddingInlineStart: 34 }} />
        {q && (
          <button onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineEnd: 12 }}>
            <X className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-16">
          <Users className="w-7 h-7" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {q ? "لا مريض يطابق البحث"
              : scope === "mine" ? "لم تعالج أي مريض بعد — جرّب «كل العيادة»"
              : scope === "attention" ? "لا مريض يحتاج متابعة ✓"
              : "لا مرضى في العيادة بعد"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {rows.map((p, i) => {
            const gap = daysSince(p.last);
            const stale = gap !== null && gap >= 180;
            return (
              <Link key={p.id} href={`/doctor/patients/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] flex-wrap"
                style={{ borderTop: i ? "1px solid var(--hairline-2)" : "none" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 text-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {p.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white truncate">{p.name}</span>
                    {p.allergies.length > 0 && (
                      <span className="badge badge-bad" title={p.allergies.join("، ")}>
                        <AlertTriangle className="w-3 h-3" /> حساسية
                      </span>
                    )}
                    {p.chronic.length > 0 && (
                      <span className="badge" title={p.chronic.join("، ")}
                        style={{ background: "rgba(56,189,248,0.1)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.22)" }}>
                        <HeartPulse className="w-3 h-3" /> مزمن
                      </span>
                    )}
                    {p.openPlanItems > 0 && (
                      <span className="badge" title="إجراءات لم تُنفَّذ في خطة معتمدة"
                        style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.22)" }}>
                        <ClipboardList className="w-3 h-3" /> <span className="ltr-nums">{p.openPlanItems}</span> إجراء معلّق
                      </span>
                    )}
                    {!p.mine && (
                      <span className="text-[9.5px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-4)" }}>
                        ليس من مرضاك
                      </span>
                    )}
                  </div>
                  {p.phone && (
                    <div className="text-xs flex items-center gap-1 ltr-nums mt-0.5" style={{ color: "var(--text-4)" }}>
                      <Phone className="w-3 h-3" /> {p.phone}
                    </div>
                  )}
                </div>

                <div className="text-center shrink-0 w-14">
                  <div className="text-sm font-bold ltr-nums" style={{ color: p.visits > 0 ? "var(--accent-1)" : "var(--text-4)" }}>
                    {p.visits}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-4)" }}>زيارة معك</div>
                </div>

                <div className="text-end shrink-0 hidden sm:block" style={{ minWidth: 96 }}>
                  <div className="text-[10px]" style={{ color: "var(--text-4)" }}>آخر زيارة</div>
                  <div className="text-xs ltr-nums" style={{ color: stale ? "#fbbf24" : "var(--text-2)" }}>
                    {fmt(p.last)}
                  </div>
                </div>

                {p.next ? (
                  <span className="flex items-center gap-1 text-[11px] shrink-0" style={{ color: "var(--accent-1)" }}>
                    <CalendarClock className="w-3 h-3" /> {fmt(p.next)}
                  </span>
                ) : (
                  <span className="text-[11px] shrink-0" style={{ color: "var(--text-4)" }}>لا موعد قادم</span>
                )}

                <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
