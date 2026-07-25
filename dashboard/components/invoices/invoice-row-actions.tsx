"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Check, Trash2, FileText, Banknote, AlertTriangle } from "lucide-react";
import { updateInvoiceStatus, deleteInvoice, recordInvoicePayment } from "@/app/actions/invoices";
import { MANUAL_STATUSES, STATUS_META, GATEWAY_AR, fmt3, type InvoiceStatus } from "@/lib/invoice-meta";
import { NumField } from "@/components/ui/num-field";

type Pos = { left: number; top?: number; bottom?: number };
const MENU_W = 216;

type Gateway = "cash" | "bank_transfer" | "thawani" | "insurance";
const GATEWAYS: Gateway[] = ["cash", "bank_transfer", "thawani", "insurance"];

export function InvoiceRowActions({
  id, status, total, paid,
}: { id: string; status: string; total: number; paid: number }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  const remaining = Math.round((total - paid) * 1000) / 1000;
  const collectable = remaining > 0 && !["paid", "cancelled", "refunded"].includes(status);

  function toggle() {
    if (open) { close(); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const openUp = window.innerHeight - r.bottom < 340;
      const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
      setPos({
        left,
        top: openUp ? undefined : Math.round(r.bottom + 6),
        bottom: openUp ? Math.round(window.innerHeight - r.top + 6) : undefined,
      });
    }
    setOpen(true);
  }
  function close() { setOpen(false); setConfirming(false); setPaying(false); setErr(null); }

  function change(s: InvoiceStatus) {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await updateInvoiceStatus(id, s);
        if (!r.ok) { setErr(r.reason); return; }
        close();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }
  function remove() {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await deleteInvoice(id);
        if (!r.ok) { setErr(r.reason); return; }
        close();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <>
      <button ref={btnRef} onClick={toggle} disabled={pending}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }} title="إجراءات">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={close} />
          <div
            className="panel py-1.5 animate-scale-in"
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: MENU_W, maxHeight: "70vh", overflowY: "auto", zIndex: 60, background: "rgba(12,18,28,0.99)" }}
          >
            {err && (
              <div className="mx-2 mb-1.5 px-2.5 py-2 rounded-lg flex items-start gap-1.5 text-[11px] leading-relaxed"
                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {err}
              </div>
            )}

            {paying ? (
              <PaymentPanel
                id={id}
                remaining={remaining}
                pending={pending}
                onError={setErr}
                onDone={close}
                start={startTransition}
                onBack={() => { setPaying(false); setErr(null); }}
              />
            ) : confirming ? (
              <div className="px-3 py-2 space-y-2">
                <p className="eyebrow" style={{ color: "#fda4b4" }}>تأكيد الإلغاء</p>
                <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                  تُنقل الفاتورة للأرشيف كملغاة — لا حذف نهائي.
                </p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setConfirming(false)} className="btn-ghost flex-1 h-9">رجوع</button>
                  <button onClick={remove} disabled={pending} className="btn-danger flex-1 h-9">{pending ? "..." : "إلغاء"}</button>
                </div>
              </div>
            ) : (
              <>
                <Link href={`/clinic-admin/finance/invoices/${id}`}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "var(--text-1)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "var(--color-info)" }} /> عرض / طباعة
                </Link>

                {collectable && (
                  <>
                    <div className="my-1" style={{ borderTop: "1px solid var(--hairline)" }} />
                    <button onClick={() => { setErr(null); setPaying(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "var(--accent-1)" }}>
                      <Banknote className="w-3.5 h-3.5" /> تسجيل دفعة
                      <span className="ms-auto text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>{fmt3(remaining)}</span>
                    </button>
                  </>
                )}

                <div className="my-1" style={{ borderTop: "1px solid var(--hairline)" }} />
                <p className="eyebrow px-3 py-1.5">تغيير الحالة</p>
                {MANUAL_STATUSES.filter((s) => s !== status && s !== "cancelled").map((s) => (
                  <button key={s} onClick={() => change(s)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "var(--text-1)" }}>
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} /> {STATUS_META[s].label}
                  </button>
                ))}

                <div className="my-1" style={{ borderTop: "1px solid var(--hairline)" }} />
                <button onClick={() => setConfirming(true)} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "#fda4b4" }}>
                  <Trash2 className="w-3.5 h-3.5" /> إلغاء الفاتورة
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** Collecting money: amount defaults to what is still owed, method is explicit
    because the day-close reconciles cash separately from card. */
function PaymentPanel({
  id, remaining, pending, onError, onDone, onBack, start,
}: {
  id: string; remaining: number; pending: boolean;
  onError: (m: string | null) => void; onDone: () => void; onBack: () => void;
  start: (fn: () => void) => void;
}) {
  const [amount, setAmount] = useState(String(remaining));
  const [gateway, setGateway] = useState<Gateway>("cash");

  function submit() {
    onError(null);
    start(async () => {
      try {
        const r = await recordInvoicePayment(id, Number(amount) || 0, gateway);
        if (!r.ok) { onError(r.reason); return; }
        onDone();
      } catch { onError("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="px-3 py-2 space-y-2.5">
      <p className="eyebrow" style={{ color: "var(--accent-1)" }}>تسجيل دفعة</p>
      <div>
        <label className="text-[10.5px] block mb-1" style={{ color: "var(--text-4)" }}>
          المبلغ — المتبقّي <span className="ltr-nums">{fmt3(remaining)}</span>
        </label>
        <NumField value={amount} onChange={setAmount} max={remaining} />
      </div>
      <div>
        <label className="text-[10.5px] block mb-1" style={{ color: "var(--text-4)" }}>طريقة الدفع</label>
        <select className="field" value={gateway} onChange={(e) => setGateway(e.target.value as Gateway)} style={{ cursor: "pointer" }}>
          {GATEWAYS.map((g) => <option key={g} value={g}>{GATEWAY_AR[g]}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-0.5">
        <button onClick={onBack} className="btn-ghost flex-1 h-9">رجوع</button>
        <button onClick={submit} disabled={pending} className="btn-primary flex-1 h-9">{pending ? "..." : "تحصيل"}</button>
      </div>
    </div>
  );
}
