"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ReceiptText, Banknote, CreditCard, CheckCircle2, AlertCircle, Star, ShieldCheck,
} from "lucide-react";
import { createInvoiceForAppointment, recordPayment, redeemPoints } from "@/app/actions/accountant";
import { METHODS, type PaymentMethod } from "@/lib/payment-methods";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export type LoyaltyInfo = {
  active: boolean;
  balance: number;
  rate: number;
  minPoints: number;
  maxPct: number;
};

export type BankDetails = {
  bankName: string | null;
  accountName: string | null;
  iban: string | null;
  phone: string | null;
};

/** Cashier: invoice the completed visit, then take the payment — one screen. */
export function CheckoutFlow({
  appointmentId,
  loyalty,
  methods,
  bank,
}: {
  appointmentId: string;
  loyalty?: LoyaltyInfo;
  /** what this clinic actually accepts — a clinic with no card machine should not
      be offered a card button */
  methods: PaymentMethod[];
  /** where a transfer goes, so the number is read off the screen and not off
      somebody's memory */
  bank: BankDetails;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [invoice, setInvoice] = useState<{ id: string; total: number; number: string } | null>(null);
  const [gateway, setGateway] = useState<PaymentMethod>(methods[0] ?? "cash");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<{ points: number; value: number } | null>(null);
  const [balance, setBalance] = useState(loyalty?.balance ?? 0);
  const [result, setResult] = useState<{ status: string; paidSum: number; earned: number } | null>(null);

  function issue() {
    setErr(null);
    start(async () => {
      try {
        const r = await createInvoiceForAppointment(appointmentId);
        if (!r.ok) { setErr(r.reason); return; }
        setInvoice({ id: r.invoiceId, total: r.total, number: r.invoiceNumber });
        setAmount(String(r.total));
        router.refresh();
      } catch { setErr("تعذّر الاتصال — حاول مجدداً"); }
    });
  }

  function pay() {
    const amt = parseFloat(amount);
    if (!invoice || !(amt > 0)) { setErr("المبلغ غير صالح"); return; }
    const meta = METHODS[gateway];
    if (meta.refRequired && !reference.trim()) {
      setErr(`${meta.refLabel} مطلوب — بدونه لا يمكن مطابقة الدفعة مع كشف البنك`);
      return;
    }
    setErr(null);
    start(async () => {
      try {
        const r = await recordPayment(invoice.id, gateway, amt, reference.trim() || undefined);
        if (!r.ok) { setErr(r.reason); return; }
        setResult({ status: r.status, paidSum: r.paidSum, earned: r.earnedPoints ?? 0 });
        router.refresh();
      } catch { setErr("تعذّر الاتصال — حاول مجدداً"); }
    });
  }

  function doRedeem() {
    if (!invoice || !loyalty) return;
    const maxByInvoice = Math.floor(((invoice.total * loyalty.maxPct) / 100) / loyalty.rate);
    const usePoints = Math.min(balance, maxByInvoice);
    if (usePoints <= 0) { setErr("لا يمكن الاستبدال على هذه الفاتورة"); return; }
    setErr(null);
    start(async () => {
      try {
        const r = await redeemPoints(invoice.id, usePoints);
        if (!r.ok) { setErr(r.reason); return; }
        setInvoice((inv) => (inv ? { ...inv, total: r.newTotal } : inv));
        setAmount(String(r.newTotal));
        setBalance(r.balanceAfter);
        setRedeemed({ points: r.usedPoints, value: r.value });
        router.refresh();
      } catch { setErr("تعذّر الاتصال — حاول مجدداً"); }
    });
  }

  const canRedeem =
    !!invoice && !!loyalty?.active && !redeemed &&
    balance >= (loyalty?.minPoints ?? Infinity) && invoice.total > 0;
  const redeemPreviewPoints = invoice && loyalty
    ? Math.min(balance, Math.floor(((invoice.total * loyalty.maxPct) / 100) / loyalty.rate))
    : 0;
  const redeemPreviewValue = loyalty ? Math.round(redeemPreviewPoints * loyalty.rate * 1000) / 1000 : 0;

  if (result) {
    return (
      <div className="panel-feature text-center" style={{ padding: "2rem" }}>
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--accent-1)" }} />
        <p className="text-lg font-bold text-white mb-1">
          {result.status === "paid" ? "تم التحصيل بالكامل ✓" : "دفعة جزئية مسجّلة"}
        </p>
        <p className="text-sm ltr-nums" style={{ color: "var(--text-2)" }}>
          المقبوض: {fmt(result.paidSum)} ر.ع · فاتورة {invoice?.number}
        </p>
        {result.earned > 0 && (
          <p className="badge badge-brand mt-3 inline-flex">
            <Star className="w-3 h-3" />
            كسب المريض {result.earned} نقطة ولاء جديدة
          </p>
        )}
        <div className="flex items-center justify-center gap-2 mt-5">
          <a href="/accountant" className="btn-primary">رجوع للوحة المالية</a>
          <a href={`/accountant/invoices`} className="btn-ghost">الفواتير</a>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      {err && (
        <p className="text-[12px] font-semibold flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3"
          style={{ background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
        </p>
      )}
      {!invoice ? (
        <button onClick={issue} disabled={pending} className="btn-primary w-full">
          <ReceiptText className="w-4 h-4" />
          {pending ? "جارٍ الإصدار…" : "إصدار الفاتورة الضريبية"}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="badge badge-brand">
              <ReceiptText className="w-3 h-3" /> {invoice.number}
            </span>
            <p className="text-xl font-bold ltr-nums text-white">{fmt(invoice.total)} <span className="text-xs" style={{ color: "var(--text-3)" }}>ر.ع</span></p>
          </div>

          {/* loyalty redemption */}
          {canRedeem && redeemPreviewPoints > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: "rgb(var(--accent-1-rgb) / 0.06)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)" }}>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 shrink-0" style={{ color: "var(--accent-1)" }} />
                <p className="text-[12px]" style={{ color: "var(--text-1)" }}>
                  رصيده <span className="font-bold ltr-nums">{balance}</span> نقطة
                  <span style={{ color: "var(--text-3)" }}> — يمكن استبدال حتى </span>
                  <span className="font-bold ltr-nums">{redeemPreviewPoints}</span>
                </p>
              </div>
              <button onClick={doRedeem} disabled={pending}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg shrink-0"
                style={{ background: "rgb(var(--accent-1-rgb) / 0.14)", border: "1px solid rgb(var(--accent-1-rgb) / 0.35)", color: "var(--accent-1)" }}>
                {pending ? "…" : `استبدال = خصم ${fmt(redeemPreviewValue)} ر.ع`}
              </button>
            </div>
          )}
          {redeemed && (
            <p className="badge badge-ok">
              <Star className="w-3 h-3" />
              خُصم {fmt(redeemed.value)} ر.ع مقابل {redeemed.points} نقطة ✓
            </p>
          )}

          <div>
            <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-3)" }}>طريقة الدفع</p>
            {/* One button per method the clinic really takes. «شبكة / تحويل» used
                to be one button covering the clinic's own card machine and a
                transfer into its bank account — two things reconciled against two
                different reports, so folding them together meant neither could be
                checked. */}
            <div className="grid grid-cols-2 gap-2">
              {methods.map((g) => {
                const m = METHODS[g];
                const on = gateway === g;
                const Icon = g === "cash" ? Banknote : g === "insurance" ? ShieldCheck : CreditCard;
                return (
                  <button
                    key={g}
                    onClick={() => { setGateway(g); setReference(""); setErr(null); }}
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-bold transition-colors text-start"
                    style={{
                      background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.35)" : "rgba(255,255,255,0.08)"}`,
                      color: on ? "var(--accent-1)" : "var(--text-2)",
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      {m.label}
                      <span className="block text-[10px] font-normal opacity-75 mt-0.5">{m.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* The account to transfer into, read off the screen rather than off a
              sticky note — a number recited from memory is how a patient's money
              ends up somewhere else. */}
          {gateway === "bank_transfer" && (bank.iban || bank.phone || bank.accountName) && (
            <div className="rounded-xl px-3.5 py-2.5 text-[11.5px] space-y-0.5"
              style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.22)" }}>
              <p className="font-bold" style={{ color: "#c4b5fd" }}>حساب العيادة للتحويل</p>
              {bank.accountName && <p style={{ color: "var(--text-2)" }}>{bank.accountName}{bank.bankName ? ` — ${bank.bankName}` : ""}</p>}
              {bank.iban && <p className="ltr-nums" dir="ltr" style={{ color: "var(--text-2)" }}>{bank.iban}</p>}
              {bank.phone && <p className="ltr-nums" dir="ltr" style={{ color: "var(--text-2)" }}>{bank.phone}</p>}
            </div>
          )}

          {/* What ties this row to a line on the terminal report or the bank
              statement. Required only where the money is not in the room. */}
          {METHODS[gateway].refLabel && (
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
                {METHODS[gateway].refLabel}
                {METHODS[gateway].refRequired
                  ? " *"
                  : <span style={{ color: "var(--text-4)" }}> (يساعد في المطابقة)</span>}
              </label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                className="field ltr-nums" dir="ltr" placeholder="—" />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>المبلغ المقبوض (ر.ع)</label>
            <input
              type="text" inputMode="decimal" step="0.001" min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field ltr-nums" dir="ltr"
            />
          </div>

          <button onClick={pay} disabled={pending} className="btn-primary w-full">
            <Banknote className="w-4 h-4" />
            {pending ? "جارٍ التسجيل…" : "تسجيل الدفعة"}
          </button>
        </div>
      )}
    </div>
  );
}
