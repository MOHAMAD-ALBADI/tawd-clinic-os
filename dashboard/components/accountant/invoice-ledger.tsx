"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, X, Banknote, CreditCard, AlertTriangle, CheckCircle2, Coins,
  ReceiptText, ChevronLeft, Undo2, ShieldCheck,
} from "lucide-react";
import { METHODS, type PaymentMethod } from "@/lib/payment-methods";
import { recordPayment } from "@/app/actions/accountant";
import { adjustInvoice } from "@/app/actions/invoices";
import { NumField, F } from "@/components/ui/num-field";
import { arDateShort } from "@/lib/ar-format";
import { ADJUSTMENT_META, type AdjustmentKind } from "@/lib/invoice-meta";
import { AdjustInvoiceDialog } from "@/components/accountant/adjust-invoice-dialog";

export type LedgerInvoice = {
  id: string;
  number: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
  /** what was invoiced — the figure on the document */
  total: number;
  paid: number;
  /** money already given back */
  refunded: number;
  /** credit notes plus write-offs: the part of `total` no longer collectable */
  adjusted: number;
  status: string;
  createdAt: string;
  dueDate: string | null;
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/* Collectable, collected, and the gap between them.

   Every figure on this page used to be total − paid. That is only true of an
   invoice nothing has happened to: a credit note reduces what may be collected,
   a refund un-collects what was, and both were invisible here — so a corrected
   invoice still showed its original debt and a refunded one showed as settled. */
const collectable = (i: LedgerInvoice) => i.total - i.adjusted;
const netPaid     = (i: LedgerInvoice) => i.paid - i.refunded;
const owed        = (i: LedgerInvoice) => Math.max(0, collectable(i) - netPaid(i));

const STATUS: Record<string, { label: string; color: string }> = {
  draft:          { label: "مسودة",        color: "#a1a1aa" },
  sent:           { label: "غير مسدّدة",   color: "#fbbf24" },
  partially_paid: { label: "مسدّدة جزئياً", color: "#fbbf24" },
  overdue:        { label: "متأخرة",       color: "#fda4b4" },
  paid:           { label: "مسدّدة",       color: "#34d399" },
  cancelled:      { label: "ملغاة",        color: "#71717a" },
  refunded:       { label: "مستردة",       color: "#a78bfa" },
  written_off:    { label: "مشطوبة",       color: "#a78bfa" },
};

const OPEN = ["sent", "partially_paid", "overdue", "draft"];
type Tab = "open" | "overdue" | "paid" | "adjusted" | "all";

/* Anything that has been refunded, credited or written off, whatever its
   status. An accountant is asked about these more often than about clean
   invoices, and there was no way to find one. */
const ADJUSTED = (i: LedgerInvoice) =>
  i.refunded > 0 || i.adjusted > 0 || i.status === "refunded" || i.status === "written_off";

const ageDays = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/** The receivables ledger.

    The old page listed the first eight characters of a UUID, a date, an amount
    and a status — no patient, no invoice number (the column existed and was
    ignored), no way to take a payment, and a total row count above a capped
    list. An accountant cannot chase money with that, which is the only reason
    the page exists. */
export function InvoiceLedger({
  invoices, capped, methods,
}: {
  invoices: LedgerInvoice[]; capped: boolean;
  /** the methods this clinic accepts, so the dialog cannot offer a card machine
      to a clinic that does not have one */
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  const [paying, setPaying] = useState<LedgerInvoice | null>(null);
  const [adjusting, setAdjusting] = useState<LedgerInvoice | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const isOpen = (i: LedgerInvoice) => OPEN.includes(i.status);
  const isOverdue = (i: LedgerInvoice) =>
    isOpen(i) && (i.status === "overdue" || (!!i.dueDate && new Date(i.dueDate).getTime() < Date.now()));

  const counts = useMemo(() => ({
    open: invoices.filter(isOpen).length,
    overdue: invoices.filter(isOverdue).length,
    paid: invoices.filter((i) => i.status === "paid").length,
    adjusted: invoices.filter(ADJUSTED).length,
    all: invoices.length,
  }), [invoices]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return invoices
      .filter((i) => {
        if (tab === "open" && !isOpen(i)) return false;
        if (tab === "overdue" && !isOverdue(i)) return false;
        if (tab === "paid" && i.status !== "paid") return false;
        if (tab === "adjusted" && !ADJUSTED(i)) return false;
        if (term && !`${i.patientName} ${i.number} ${i.patientPhone ?? ""}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, tab, q]);

  /* Aged receivables — the accountant's core artefact and it was nowhere. */
  const aging = useMemo(() => {
    const buckets = { d0: 0, d30: 0, d60: 0, d90: 0 };
    for (const i of invoices) {
      if (!isOpen(i)) continue;
      const rest = owed(i);
      const age = ageDays(i.createdAt);
      if (age <= 30) buckets.d0 += rest;
      else if (age <= 60) buckets.d30 += rest;
      else if (age <= 90) buckets.d60 += rest;
      else buckets.d90 += rest;
    }
    return buckets;
  }, [invoices]);

  const outstanding = aging.d0 + aging.d30 + aging.d60 + aging.d90;
  const shownTotal = rows.reduce((s, i) => s + (tab === "paid" ? netPaid(i) : owed(i)), 0);

  function pay(inv: LedgerInvoice, gateway: PaymentMethod, amount: number, ref: string) {
    setMsg(null);
    start(async () => {
      const r = await recordPayment(inv.id, gateway, amount, ref || undefined);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setPaying(null);
      setMsg({
        text: r.status === "paid"
          ? `سُدّدت ${inv.number} بالكامل ✓${r.earnedPoints ? ` · ${r.earnedPoints} نقطة ولاء` : ""}`
          : `سُجّلت دفعة على ${inv.number} — المتبقي ${omr(Math.max(0, collectable(inv) - r.paidSum))} ر.ع`,
      });
      setTimeout(() => setMsg(null), 6000);
      router.refresh();
    });
  }

  function adjust(
    inv: LedgerInvoice, kind: AdjustmentKind, amount: number, reason: string,
    method: "cash" | "bank_transfer" | "thawani" | null,
  ) {
    setMsg(null);
    start(async () => {
      const r = await adjustInvoice({ invoiceId: inv.id, kind, amount, reason, method });
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setAdjusting(null);
      const label = ADJUSTMENT_META[kind].label;
      setMsg({
        text: `سُجّل ${label} ${omr(amount)} ر.ع على ${inv.number}`
          + ` — المستحق الآن ${omr(r.outstanding)} ر.ع`
          + (r.pointsTaken ? ` · سُحبت ${r.pointsTaken} نقطة ولاء` : "")
          + (kind === "write_off" ? " · سُجّل مصروف «ديون معدومة»" : ""),
      });
      setTimeout(() => setMsg(null), 9000);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {outstanding > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card label="إجمالي المستحق" value={omr(outstanding)} accent />
          <Card label="حتى ٣٠ يوم" value={omr(aging.d0)} />
          <Card label="٣١–٦٠ يوم" value={omr(aging.d30)} warn={aging.d30 > 0} />
          <Card label="٦١–٩٠ يوم" value={omr(aging.d60)} warn={aging.d60 > 0} />
          <Card label="أكثر من ٩٠" value={omr(aging.d90)} bad={aging.d90 > 0} />
        </div>
      )}

      {msg && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={msg.bad
            ? { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }
            : { background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          {msg.bad ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {([["open", "غير مسدّدة"], ["overdue", "متأخرة"], ["paid", "مسدّدة"],
           ["adjusted", "تسويات"], ["all", "الكل"]] as [Tab, string][])
          .map(([k, label]) => {
            const on = tab === k;
            const n = counts[k];
            return (
              <button key={k} onClick={() => setTab(k)}
                className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
                style={{
                  background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                  color: on ? "var(--accent-1)" : k === "overdue" && n > 0 ? "#fda4b4" : "var(--text-3)",
                }}>
                {label}<span className="ltr-nums text-[11px] opacity-70">{n}</span>
              </button>
            );
          })}
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث برقم الفاتورة أو اسم المريض…" style={{ paddingInlineStart: 34 }} />
          {q && (
            <button onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineEnd: 12 }}>
              <X className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
            </button>
          )}
        </div>
      </div>

      {capped && (
        <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          تُعرض أحدث الفواتير فقط — الأقدم غير محمَّلة، والمجاميع أعلاه تخصّ المعروض.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-16">
          <ReceiptText className="w-7 h-7" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {q ? "لا فاتورة تطابق البحث" : tab === "open" ? "لا فواتير معلّقة ✓" : "لا فواتير"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 text-[11px]"
            style={{ borderBottom: "1px solid var(--hairline)", color: "var(--text-4)" }}>
            <span className="ltr-nums">{rows.length} فاتورة</span>
            <span className="ms-auto">
              {tab === "paid" ? "محصّل صافي" : "مستحق"}{" "}
              <span className="font-black ltr-nums" style={{ color: "var(--accent-1)" }}>{omr(shownTotal)}</span> ر.ع
            </span>
          </div>

          {rows.map((inv, i) => {
            const st = STATUS[inv.status] ?? STATUS.draft;
            const rest = owed(inv);
            const late = isOverdue(inv);
            const age = ageDays(inv.createdAt);
            /* A refund or a credit note is the whole story of some invoices, so
               it goes on the row rather than behind a click. */
            const adjNote = [
              inv.refunded > 0 ? `مستردّ ${omr(inv.refunded)}` : "",
              inv.adjusted > 0 ? `منزَّل ${omr(inv.adjusted)}` : "",
            ].filter(Boolean).join(" · ");
            /* Anything with money still in play can be adjusted: an open debt can
               be credited or written off, a settled one can be refunded. */
            const canAdjust = owed(inv) > 0.0005 || netPaid(inv) > 0.0005;
            return (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{ borderTop: i ? "1px solid var(--hairline-2)" : "none" }}>
                <span className="text-[12.5px] font-bold ltr-nums text-white shrink-0" style={{ minWidth: 110 }}>
                  {inv.number}
                </span>

                <div className="flex-1 min-w-0">
                  {inv.patientId ? (
                    <Link href={`/reception/patients/${inv.patientId}`} className="text-[13px] font-bold text-white truncate hover:underline">
                      {inv.patientName}
                    </Link>
                  ) : (
                    <span className="text-[13px] font-bold text-white truncate">{inv.patientName}</span>
                  )}
                  <p className="text-[10.5px] ltr-nums" style={{ color: late ? "#fda4b4" : "var(--text-4)" }}>
                    {arDateShort.format(new Date(inv.createdAt))}
                    {age > 0 && ` · عمرها ${age} يوم`}
                    {late && " · متأخرة"}
                  </p>
                </div>

                <div className="text-end shrink-0" style={{ minWidth: 92 }}>
                  <p className="text-[13px] font-black ltr-nums text-white">{omr(inv.total)}</p>
                  {/* Only while the invoice is still being collected. A refunded
                      or written-off one has a non-zero gap between billed and
                      collected, and printing it as "باقي" reads as a debt the
                      desk should chase — which is the opposite of the truth. */}
                  {isOpen(inv) && rest > 0 && rest < inv.total && (
                    <p className="text-[10.5px] ltr-nums" style={{ color: "#fbbf24" }}>باقي {omr(rest)}</p>
                  )}
                  {adjNote && (
                    <p className="text-[10px] ltr-nums" style={{ color: "#c4b5fd" }}>{adjNote}</p>
                  )}
                </div>

                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40` }}>
                  {st.label}
                </span>

                {OPEN.includes(inv.status) && (
                  <button className="btn-ghost" disabled={pending} title="تسجيل دفعة"
                    onClick={() => { setMsg(null); setPaying(inv); }}>
                    <Banknote className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                  </button>
                )}
                {canAdjust && (
                  <button className="btn-ghost" disabled={pending} title="استرداد / إشعار دائن / شطب"
                    onClick={() => { setMsg(null); setAdjusting(inv); }}>
                    <Undo2 className="w-3.5 h-3.5" style={{ color: "#c4b5fd" }} />
                  </button>
                )}
                {inv.patientId && (
                  <Link href={`/reception/patients/${inv.patientId}`} className="shrink-0">
                    <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-4)" }} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {paying && (
        <PayDialog inv={paying} methods={methods} pending={pending}
          onClose={() => setPaying(null)} onPay={pay} />
      )}
      {adjusting && (
        <AdjustInvoiceDialog
          inv={{
            id: adjusting.id, number: adjusting.number, patientName: adjusting.patientName,
            total: adjusting.total, netPaid: netPaid(adjusting), outstanding: owed(adjusting),
          }}
          pending={pending}
          onClose={() => setAdjusting(null)}
          onSubmit={(kind, amount, reason, method) => adjust(adjusting, kind, amount, reason, method)}
        />
      )}
    </div>
  );
}

function Card({ label, value, accent, warn, bad }: {
  label: string; value: string; accent?: boolean; warn?: boolean; bad?: boolean;
}) {
  return (
    <div className="panel" style={{ padding: "0.95rem 1.1rem" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--text-4)" }}>{label}</p>
      <p className="font-black ltr-nums leading-none" style={{
        fontSize: "1.3rem",
        color: bad ? "#fda4b4" : warn ? "#fbbf24" : accent ? "var(--accent-1)" : "#ffffff",
      }}>{value}</p>
    </div>
  );
}

function PayDialog({
  inv, methods, pending, onClose, onPay,
}: {
  inv: LedgerInvoice; methods: PaymentMethod[]; pending: boolean; onClose: () => void;
  onPay: (i: LedgerInvoice, g: PaymentMethod, amount: number, ref: string) => void;
}) {
  const rest = owed(inv);
  const [amount, setAmount] = useState(String(rest));
  const [gateway, setGateway] = useState<PaymentMethod>(methods[0] ?? "cash");
  const [reference, setReference] = useState("");
  const meta = METHODS[gateway];
  const over = Number(amount) > rest + 0.0005;
  const missingRef = meta.refRequired && !reference.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 420, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-black text-white">دفعة على {inv.number}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <p className="text-[12.5px] mb-4" style={{ color: "var(--text-2)" }}>
          {inv.patientName} — المتبقي <span className="font-black ltr-nums text-white">{omr(rest)}</span> ر.ع
        </p>

        <F label="المبلغ (ر.ع)">
          <NumField value={amount} onChange={setAmount} />
        </F>

        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {methods.map((k) => {
            const m = METHODS[k];
            const on = gateway === k;
            const Icon = k === "cash" ? Banknote : k === "insurance" ? ShieldCheck : CreditCard;
            return (
              <button key={k} type="button"
                onClick={() => { setGateway(k); setReference(""); }}
                className="flex items-center gap-1.5 justify-center text-[12px] font-bold px-3 py-2 rounded-xl transition-colors"
                style={{
                  background: on ? "rgb(var(--accent-1-rgb) / 0.13)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.34)" : "var(--hairline)"}`,
                  color: on ? "var(--accent-1)" : "var(--text-3)",
                }}>
                <Icon className="w-3.5 h-3.5 shrink-0" /> {m.label}
              </button>
            );
          })}
        </div>

        {meta.refLabel && (
          <div className="mt-3">
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
              {meta.refLabel}{meta.refRequired ? " *" : ""}
            </label>
            <input className="field ltr-nums" dir="ltr" value={reference}
              onChange={(e) => setReference(e.target.value)} placeholder="—" />
          </div>
        )}

        {/* Overpaying is a refund waiting to happen; the action refuses it, but
            saying so before the click is cheaper than an error afterwards. */}
        {over && (
          <p className="flex items-center gap-1.5 text-[11.5px] mt-3" style={{ color: "#fbbf24" }}>
            <AlertTriangle className="w-3.5 h-3.5" /> المبلغ أكبر من المتبقي
          </p>
        )}

        {missingRef && (
          <p className="flex items-center gap-1.5 text-[11.5px] mt-3" style={{ color: "#fbbf24" }}>
            <AlertTriangle className="w-3.5 h-3.5" /> {meta.refLabel} مطلوب للمطابقة مع كشف البنك
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-4">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending || !(Number(amount) > 0) || missingRef}
            onClick={() => onPay(inv, gateway, Number(amount), reference.trim())}>
            <Coins className="w-4 h-4" /> {pending ? "جارٍ…" : "تسجيل الدفعة"}
          </button>
        </div>
      </div>
    </div>
  );
}
