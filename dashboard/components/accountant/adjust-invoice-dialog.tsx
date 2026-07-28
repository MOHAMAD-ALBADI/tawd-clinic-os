"use client";

import { useState } from "react";
import { X, AlertTriangle, Undo2 } from "lucide-react";
import { NumField, F } from "@/components/ui/num-field";
import {
  ADJUSTMENT_META, REFUND_METHODS, type AdjustmentKind,
} from "@/lib/invoice-meta";

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export type AdjustTarget = {
  id: string;
  number: string;
  patientName: string;
  /** what was invoiced */
  total: number;
  /** money received, less anything already refunded */
  netPaid: number;
  /** still owed, after credit notes and write-offs */
  outstanding: number;
};

/** Choosing between the three, then doing one.

    The three are close enough to confuse and expensive to confuse, so the dialog
    names the ceiling for each one and says in a sentence what it does to the
    money before anything is typed. The server refuses an amount over the cap
    regardless; this is so the accountant does not have to discover the cap by
    being refused. */
export function AdjustInvoiceDialog({
  inv, pending, onClose, onSubmit,
}: {
  inv: AdjustTarget;
  pending: boolean;
  onClose: () => void;
  onSubmit: (
    kind: AdjustmentKind, amount: number, reason: string,
    method: "cash" | "bank_transfer" | "thawani" | null,
  ) => void;
}) {
  const [kind, setKind] = useState<AdjustmentKind>(inv.outstanding > 0 ? "credit_note" : "refund");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "thawani">("cash");

  const cap = kind === "refund" ? inv.netPaid : inv.outstanding;
  const meta = ADJUSTMENT_META[kind];
  const amt = Number(amount || 0);
  const over = amt - cap > 0.0005;
  const ready = amt > 0 && !over && reason.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 460, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-black text-white flex items-center gap-2">
            <Undo2 className="w-4 h-4" style={{ color: meta.colour }} /> تسوية {inv.number}
          </h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--text-3)" }}>
          {inv.patientName} — فاتورة <span className="ltr-nums text-white font-bold">{omr(inv.total)}</span> ر.ع
          {" · "}محصّل <span className="ltr-nums text-white font-bold">{omr(inv.netPaid)}</span>
          {" · "}مستحق <span className="ltr-nums text-white font-bold">{omr(inv.outstanding)}</span>
        </p>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {(Object.keys(ADJUSTMENT_META) as AdjustmentKind[]).map((k) => {
            const m = ADJUSTMENT_META[k];
            const on = kind === k;
            const limit = k === "refund" ? inv.netPaid : inv.outstanding;
            const dead = limit <= 0.0005;
            return (
              <button key={k} type="button" disabled={dead}
                onClick={() => { setKind(k); setAmount(""); }}
                title={dead
                  ? (k === "refund" ? "لا دفعات محصّلة على هذه الفاتورة" : "لا مبلغ مستحق على هذه الفاتورة")
                  : m.short}
                className="text-[12px] font-bold px-2 py-2.5 rounded-xl transition-colors text-center"
                style={{
                  background: on ? `${m.colour}1f` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${on ? `${m.colour}55` : "var(--hairline)"}`,
                  color: dead ? "var(--text-4)" : on ? m.colour : "var(--text-3)",
                  opacity: dead ? 0.45 : 1,
                }}>
                {m.label}
                <span className="block text-[9.5px] font-normal mt-0.5 leading-tight opacity-80">{m.short}</span>
              </button>
            );
          })}
        </div>

        {/* What this choice actually does. Left out, the three are guesswork. */}
        <p className="text-[11.5px] leading-relaxed rounded-xl px-3 py-2.5 mb-3"
          style={{ background: `${meta.colour}0f`, border: `1px solid ${meta.colour}2e`, color: "var(--text-2)" }}>
          {meta.hint}
        </p>

        <F label={`المبلغ (ر.ع) — حتى ${omr(cap)}`}>
          <NumField value={amount} onChange={setAmount} />
        </F>

        {kind === "refund" && (
          <div className="mt-3">
            <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--text-3)" }}>
              كيف رجع المبلغ؟
            </label>
            <div className="flex items-center gap-1.5">
              {REFUND_METHODS.map((m) => {
                const on = method === m.value;
                return (
                  <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                    className="flex-1 text-[11.5px] font-bold px-2 py-2 rounded-xl transition-colors"
                    style={{
                      background: on ? "rgb(var(--accent-1-rgb) / 0.13)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.34)" : "var(--hairline)"}`,
                      color: on ? "var(--accent-1)" : "var(--text-3)",
                    }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--text-3)" }}>
            السبب * — يُحفظ في السجل ولا يمكن تعديله لاحقاً
          </label>
          <input className="field" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={kind === "refund" ? "مثال: المريض دفع مرتين بالخطأ"
              : kind === "credit_note" ? "مثال: احتُسبت جلستان والمقدَّم جلسة واحدة"
              : "مثال: لا يمكن الوصول للمريض منذ سنة — أُبلغ ثلاث مرات"} />
        </div>

        {over && (
          <p className="flex items-center gap-1.5 text-[11.5px] mt-3" style={{ color: "#fda4b4" }}>
            <AlertTriangle className="w-3.5 h-3.5" /> الحد الأقصى {omr(cap)} ر.ع
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-4">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending || !ready}
            onClick={() => onSubmit(kind, amt, reason, kind === "refund" ? method : null)}>
            <Undo2 className="w-4 h-4" /> {pending ? "جارٍ…" : `تسجيل ${meta.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
