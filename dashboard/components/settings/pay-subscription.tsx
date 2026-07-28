"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, RefreshCw, AlertTriangle } from "lucide-react";
import {
  createSubscriptionPaymentLink, verifySubscriptionPayment,
} from "@/app/actions/subscription";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Pay one subscription invoice by card.

    The clinic leaves TAWD for the gateway and comes back to a route that asks
    Thawani directly whether the card was charged. If that return trip is lost —
    tab closed, network dropped — the check button asks again, which is why it is
    always offered rather than only after a failure. */
export function PaySubscription({
  invoiceId, outstanding, configured, live,
}: {
  invoiceId: string;
  outstanding: number;
  configured: boolean;
  live: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  function pay() {
    setMsg(null);
    start(async () => {
      const r = await createSubscriptionPaymentLink(invoiceId);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      /* Straight to the gateway — an intermediate "click here" page is one more
         thing between a clinic and paying us. */
      window.location.href = r.url;
    });
  }

  function check() {
    setMsg(null);
    start(async () => {
      const r = await verifySubscriptionPayment(invoiceId);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      if (r.paid) { setMsg({ text: `وصلت الدفعة ${fmt(r.amount)} ر.ع ✓` }); router.refresh(); }
      else setMsg({ text: "لم تصل دفعة بعد", bad: true });
    });
  }

  if (!configured) {
    return (
      <span className="text-[10.5px]" style={{ color: "var(--text-4)" }}>
        الدفع بالبطاقة غير مفعّل بعد
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {msg && (
        <span className="text-[10.5px]" style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
          {msg.text}
        </span>
      )}
      {/* Sandbox keys take real clicks and move no money. Saying so on the button
          is cheaper than a clinic believing a test payment settled their bill. */}
      {!live && (
        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#fbbf24" }}>
          <AlertTriangle className="w-3 h-3" /> بيئة تجريبية
        </span>
      )}
      <button className="btn-ghost" disabled={pending} onClick={check} title="تحقّق من وصول الدفعة">
        <RefreshCw className="w-3 h-3" />
      </button>
      <button className="btn-primary" disabled={pending} onClick={pay}
        style={{ padding: "0.3rem 0.7rem", fontSize: "11.5px" }}>
        <CreditCard className="w-3.5 h-3.5" />
        {pending ? "جارٍ…" : `دفع ${fmt(outstanding)}`}
      </button>
    </div>
  );
}
