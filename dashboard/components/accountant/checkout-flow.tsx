"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReceiptText, Banknote, CreditCard, CheckCircle2 } from "lucide-react";
import { createInvoiceForAppointment, recordPayment } from "@/app/actions/accountant";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Cashier: invoice the completed visit, then take the payment — one screen. */
export function CheckoutFlow({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [invoice, setInvoice] = useState<{ id: string; total: number; number: string } | null>(null);
  const [gateway, setGateway] = useState<"cash" | "bank_transfer">("cash");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<{ status: string; paidSum: number } | null>(null);

  function issue() {
    start(async () => {
      try {
        const r = await createInvoiceForAppointment(appointmentId);
        setInvoice({ id: r.invoiceId, total: r.total, number: r.invoiceNumber });
        setAmount(String(r.total));
        router.refresh();
      } catch (e) { alert(e instanceof Error ? e.message : "حدث خطأ"); }
    });
  }

  function pay() {
    const amt = parseFloat(amount);
    if (!invoice || !(amt > 0)) { alert("المبلغ غير صالح"); return; }
    start(async () => {
      try {
        const r = await recordPayment(invoice.id, gateway, amt);
        setResult(r);
        router.refresh();
      } catch (e) { alert(e instanceof Error ? e.message : "حدث خطأ"); }
    });
  }

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
        <div className="flex items-center justify-center gap-2 mt-5">
          <a href="/accountant" className="btn-primary">رجوع للوحة المالية</a>
          <a href={`/accountant/invoices`} className="btn-ghost">الفواتير</a>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
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
