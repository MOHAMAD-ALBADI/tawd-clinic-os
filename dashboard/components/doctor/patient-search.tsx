"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, Phone } from "lucide-react";

export type DocPatient = { id: string; name: string; phone: string | null; visits: number; last: string | null };

export function PatientSearch({ patients }: { patients: DocPatient[] }) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? patients.filter((p) => p.name.includes(q.trim()) || (p.phone ?? "").includes(q.trim()))
    : patients;

  const lastAr = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

  return (
    <>
      <div className="relative">
        <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3" style={{ color: "rgba(148,163,184,0.5)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المريض أو الجوال..."
          style={{ width: "100%", background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(226,232,240,0.92)", borderRadius: 12, padding: "0.7rem 0.85rem 0.7rem 0.85rem", paddingInlineStart: "2.4rem", fontSize: 13, outline: "none" }} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: "rgba(148,163,184,0.5)" }}>لا نتائج</p>
        ) : (
          filtered.map((p, i) => (
            <Link key={p.id} href={`/doctor/patients/${p.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03]"
              style={{ borderTop: i ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>{p.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white truncate">{p.name}</div>
                {p.phone && <div className="text-xs flex items-center gap-1 ltr-nums" style={{ color: "rgba(148,163,184,0.5)" }}><Phone className="w-3 h-3" /> {p.phone}</div>}
              </div>
              <div className="text-center shrink-0">
                <div className="text-sm font-bold" style={{ color: "#5dd9cb" }}>{p.visits}</div>
                <div className="text-[10px]" style={{ color: "rgba(148,163,184,0.45)" }}>زيارة</div>
              </div>
              <div className="text-end shrink-0 hidden sm:block">
                <div className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>آخر زيارة</div>
                <div className="text-xs ltr-nums" style={{ color: "rgba(226,232,240,0.8)" }}>{lastAr(p.last)}</div>
              </div>
              <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "rgba(148,163,184,0.4)" }} />
            </Link>
          ))
        )}
      </div>
    </>
  );
}
