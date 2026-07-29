"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";

export type MoveType = "purchase_in" | "consume" | "adjustment" | "waste";

export type MoveRow = {
  id: string;
  at: string;
  item: string;
  unit: string;
  type: MoveType;
  qty: number;      // signed: what the movement did to the balance
  reason: string | null;
  refType: string | null;
  by: string | null;
};

const TYPES: Record<MoveType, { label: string; colour: string }> = {
  purchase_in: { label: "استلام",  colour: "#34d399" },
  consume:     { label: "استهلاك", colour: "#38bdf8" },
  adjustment:  { label: "جرد",     colour: "#fbbf24" },
  waste:       { label: "إتلاف",   colour: "#fda4b4" },
};

/* Where the movement came from, in the clinic's words rather than the column's. */
const REF: Record<string, string> = {
  manual: "يدوي",
  prescription: "وصفة",
  appointment: "موعد",
  invoice: "فاتورة",
};

const num = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(n);

/** Every movement of stock, newest first.

    The ledger has been written since the module shipped — receipts, stock-takes,
    the automatic deduction at billing, pharmacy dispensing — and never shown.
    A balance you cannot explain is a balance nobody trusts: this is the screen
    that answers "the shelf says four and the system says six, what happened". */
export function MovementsLedger({ rows }: { rows: MoveRow[] }) {
  const [type, setType] = useState<MoveType | "all">("all");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (type === "all" || r.type === type) &&
        (!needle || r.item.toLowerCase().includes(needle))
    );
  }, [rows, type, q]);

  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Muscat", hour12: false,
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="section-title">
          <ScrollText className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>حركة المخزون</h2>
          <span className="text-[11px] font-bold ltr-nums px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-3)" }}>
            {shown.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-3"
              style={{ color: "var(--text-4)" }} />
            <input className="field" style={{ paddingInlineStart: "2.1rem", width: 180 }}
              placeholder="ابحث بالصنف" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {(["all", "purchase_in", "consume", "adjustment", "waste"] as const).map((t) => {
            const on = type === t;
            const c = t === "all" ? "var(--accent-1)" : TYPES[t].colour;
            return (
              <button key={t} onClick={() => setType(t)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
                style={{
                  background: on ? `${c}1f` : "rgba(255,255,255,0.03)",
                  color: on ? c : "var(--text-3)",
                  border: `1px solid ${on ? `${c}45` : "var(--hairline)"}`,
                }}>
                {t === "all" ? "الكل" : TYPES[t].label}
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel text-center py-14" style={{ padding: "1.25rem" }}>
          <ScrollText className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            لا حركة بعد — تظهر هنا مع أول استلام أو صرف
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="panel text-center py-10" style={{ padding: "1.25rem" }}>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>لا حركة تطابق البحث</p>
        </div>
      ) : (
        <div className="panel overflow-hidden" style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["التاريخ", "الصنف", "النوع", "الكمية", "السبب", "بواسطة"].map((h) => (
                    <th key={h} className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const t = TYPES[r.type];
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td className="px-4 py-2.5 ltr-nums whitespace-nowrap" style={{ color: "var(--text-3)" }}>
                        {when(r.at)}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-white">{r.item}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${t.colour}1a`, color: t.colour, border: `1px solid ${t.colour}33` }}>
                          {t.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 ltr-nums font-bold whitespace-nowrap"
                        style={{ color: r.qty >= 0 ? "#34d399" : "#fda4b4" }}>
                        {r.qty >= 0 ? "+" : "−"}{num(Math.abs(r.qty))}
                        <span className="text-[11px] font-normal mx-1" style={{ color: "var(--text-4)" }}>{r.unit}</span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-3)" }}>
                        {r.reason ?? "—"}
                        {r.refType && REF[r.refType] && r.refType !== "manual" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full ms-1.5"
                            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-4)" }}>
                            {REF[r.refType]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-3)" }}>{r.by ?? "النظام"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
