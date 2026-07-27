"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Phone, CalendarPlus, AlertTriangle, HeartPulse, Coins, X,
  UserPlus, ChevronLeft, CalendarClock,
} from "lucide-react";
import { arDateShort } from "@/lib/ar-format";

export type DirectoryPatient = {
  id: string;
  name: string;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  lastVisit: string | null;
  nextAppt: string | null;
  balance: number;
  allergies: string[];
  chronic: string[];
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmt = (iso: string | null) => (iso ? arDateShort.format(new Date(iso)) : "—");

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}

type Filter = "all" | "owing" | "no_next" | "new";

/** The directory the front desk did not have.

    Reception could open today's list and a booking form and nothing else — so
    "the patient on the phone asking when their next appointment is" had no
    answer without going through the manager's dashboard. This is the lookup:
    who they are, what they owe, when they were last in, what is booked, and the
    two clinical flags that matter at a desk. */
export function PatientDirectory({
  patients, capped,
}: { patients: DirectoryPatient[]; capped: boolean }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => ({
    all: patients.length,
    owing: patients.filter((p) => p.balance > 0).length,
    no_next: patients.filter((p) => !p.nextAppt && p.lastVisit).length,
    new: patients.filter((p) => !p.lastVisit).length,
  }), [patients]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return patients
      .filter((p) => {
        if (filter === "owing" && p.balance <= 0) return false;
        if (filter === "no_next" && (p.nextAppt || !p.lastVisit)) return false;
        if (filter === "new" && p.lastVisit) return false;
        if (term && !`${p.name} ${p.phone ?? ""}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""))
      .slice(0, 300);
  }, [patients, q, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ["all", "الكل"], ["owing", "عليهم مستحقات"],
          ["no_next", "بلا موعد قادم"], ["new", "لم يزوروا بعد"],
        ] as [Filter, string][]).map(([k, label]) => {
          const on = filter === k;
          const n = counts[k];
          return (
            <button key={k} onClick={() => setFilter(k)}
              className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
              style={{
                background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                color: on ? "var(--accent-1)" : k === "owing" && n > 0 ? "#fbbf24" : "var(--text-3)",
              }}>
              {label}<span className="ltr-nums text-[11px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
          style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder="ابحث بالاسم أو الرقم — المريض على الهاتف الآن" style={{ paddingInlineStart: 34 }} />
        {q && (
          <button onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineEnd: 12 }}>
            <X className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
          </button>
        )}
      </div>

      {/* Search runs over the rows the server sent. If it had to stop short,
          "no results" would be a lie for anyone past the cut — so the screen
          says so instead of pretending the patient does not exist. */}
      {capped && (
        <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          عدد المرضى تجاوز حد التحميل — البحث هنا يغطي الأحدث فقط. إن لم تجد أحدهم فهو موجود ولم يُحمَّل.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-14">
          <UserPlus className="w-7 h-7" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {q ? `لا مريض باسم أو رقم «${q}»` : "لا مرضى في هذا التصنيف"}
          </p>
          {q && (
            <Link href="/reception/book" className="btn-primary">
              <UserPlus className="w-4 h-4" /> سجّل مريضاً جديداً
            </Link>
          )}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {rows.map((p, i) => {
            const a = age(p.dob);
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{ borderTop: i ? "1px solid var(--hairline-2)" : "none" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 text-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {p.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/reception/patients/${p.id}`} className="text-[13px] font-bold text-white hover:underline truncate">
                      {p.name}
                    </Link>
                    {a !== null && (
                      <span className="text-[10.5px] ltr-nums" style={{ color: "var(--text-4)" }}>{a} سنة</span>
                    )}
                    {/* Two flags a desk must see: what could harm them, and what
                        they owe. Everything else is the doctor's business. */}
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
                    {p.balance > 0 && (
                      <span className="badge" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.22)" }}>
                        <Coins className="w-3 h-3" /> <span className="ltr-nums">{omr(p.balance)}</span> ر.ع
                      </span>
                    )}
                  </div>
                  {p.phone && (
                    <p className="text-[11px] flex items-center gap-1 ltr-nums mt-0.5" style={{ color: "var(--text-4)" }}>
                      <Phone className="w-3 h-3" /> {p.phone}
                    </p>
                  )}
                </div>

                <div className="text-end shrink-0 hidden sm:block" style={{ minWidth: 88 }}>
                  <p className="text-[10px]" style={{ color: "var(--text-4)" }}>آخر زيارة</p>
                  <p className="text-[11.5px] ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(p.lastVisit)}</p>
                </div>

                {p.nextAppt ? (
                  <span className="flex items-center gap-1 text-[11px] shrink-0" style={{ color: "var(--accent-1)" }}>
                    <CalendarClock className="w-3 h-3" /> {fmt(p.nextAppt)}
                  </span>
                ) : (
                  <span className="text-[11px] shrink-0" style={{ color: "var(--text-4)" }}>بلا موعد</span>
                )}

                {p.phone && (
                  <a href={`tel:${p.phone}`} className="btn-ghost" title="اتصال">
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
                <Link href={`/reception/book?patient=${p.id}`} className="btn-ghost" title="حجز موعد">
                  <CalendarPlus className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
                </Link>
                <Link href={`/reception/patients/${p.id}`} className="shrink-0">
                  <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-4)" }} />
                </Link>
              </div>
            );
          })}
          {patients.length > rows.length && rows.length === 300 && (
            <p className="text-[11px] px-4 py-3" style={{ color: "var(--text-4)" }}>
              تُعرض أول ٣٠٠ نتيجة — ابحث بالاسم لتضييق القائمة
            </p>
          )}
        </div>
      )}
    </div>
  );
}
