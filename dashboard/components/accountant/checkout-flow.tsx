"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReceiptText, Banknote, CreditCard, CheckCircle2, AlertCircle, Star } from "lucide-react";
import { createInvoiceForAppointment, recordPayment, redeemPoints } from "@/app/actions/accountant";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export type LoyaltyInfo = {
  active: boolean;
  balance: number;
  rate: number;
  minPoints: number;
  maxPct: number;
};

/** Cashier: invoice the completed visit, then take the payment — one screen. */
export function CheckoutFlow({
  appointmentId,
  loyalty,
}: {
  appointmentId: string;
  loyalty?: LoyaltyInfo;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [invoice, setInvoice] = useState<{ id: string; total: number; number: string } | null>(null);
  const [gateway, setGateway] = useState<"cash" | "bank_transfer">("cash");
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
    setErr(null);
    start(async () => {
      try {
        const r = await recordPayment(invoice.id, gateway, amt);
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
              style={{ background: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.2)" }}>
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
                style={{ background: "rgba(45,212,191,0.14)", border: "1px solid rgba(45,212,191,0.35)", color: "#5dd9cb" }}>
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
            <div className="grid grid-cols-2 gap-2">
              {([["cash", "كاش", Banknote], ["bank_transfer", "شبكة / تحويل", CreditCard]] as const).map(([g, label, Icon]) => (
                <button
                  key={g}
                  onClick={() => setGateway(g)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-colors"
                  style={{
                    background: gateway === g ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${gateway === g ? "rgba(45,212,191,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: gateway === g ? "#5dd9cb" : "var(--text-2)",
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>المبلغ المقبوض (ر.ع)</label>
            <input
              type="number" step="0.001" min="0"
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
