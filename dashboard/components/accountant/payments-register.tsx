"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, X, Banknote, CreditCard, ShieldCheck, AlertTriangle, CheckCircle2,
  Ban, Coins, Hash, UserCircle,
} from "lucide-react";
import { voidPayment } from "@/app/actions/accountant";
import { METHODS, type PaymentMethod } from "@/lib/payment-methods";
import { arDateShort, arTime } from "@/lib/ar-format";

export type RegisterPayment = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  invoiceId: string | null;
  invoiceNumber: string;
  patientId: string | null;
  patientName: string;
  /** who was at the desk */
  receivedBy: string | null;
  voided: boolean;
  voidReason: string | null;
  voidedBy: string | null;
  /** the clinic day this payment belongs to, and whether that day is closed */
  day: string;
  dayClosed: boolean;
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const iconFor = (m: string) =>
  m === "cash" ? Banknote : m === "insurance" ? ShieldCheck : CreditCard;

/** Every payment the clinic has taken.

    There was no such screen. Money could be recorded and then only ever seen as
    a total: no list of who paid, how much, which patient, on what, taken by
    whom, or against which slip. So a payment entered twice, or entered for the
    wrong patient, or 450 typed instead of 45, was invisible and permanent.

    Reconciliation is looking down a list for the row that is wrong, which is why
    the list is the screen and the totals are a strip above it. */
export function PaymentsRegister({
  payments, capped, staffNames,
}: {
  payments: RegisterPayment[];
  capped: boolean;
  staffNames: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");
  const [voiding, setVoiding] = useState<RegisterPayment | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return payments.filter((p) => {
      if (method !== "all" && p.method !== method) return false;
      if (!term) return true;
      return `${p.patientName} ${p.invoiceNumber} ${p.reference ?? ""}`.toLowerCase().includes(term);
    });
  }, [payments, q, method]);

  /* Voided rows are shown but never counted — that is the point of keeping them. */
  const live = rows.filter((p) => !p.voided);

  const byMethod = useMemo(() => {
    const m = new Map<string, { total: number; n: number }>();
    for (const p of live) {
      const cur = m.get(p.method) ?? { total: 0, n: 0 };
      cur.total += p.amount; cur.n += 1;
      m.set(p.method, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [live]);

  const total = live.reduce((s, p) => s + p.amount, 0);

  /* A card or transfer with no reference cannot be matched to the terminal report
     or the bank statement. Not an error — a list of rows to go and find. */
  const unmatched = live.filter(
    (p) => METHODS[p.method as PaymentMethod]?.refLabel && !p.reference,
  );

  function doVoid(p: RegisterPayment, reason: string) {
    setMsg(null);
    start(async () => {
      const r = await voidPayment(p.id, reason);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setVoiding(null);
      setMsg({ text: `أُلغيت دفعة ${omr(p.amount)} ر.ع — خرجت من كل المجاميع` });
      setTimeout(() => setMsg(null), 7000);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="إجمالي المقبوض" value={omr(total)} sub={`${live.length} دفعة`} accent />
        {byMethod.slice(0, 3).map(([m, v]) => (
          <Card key={m} label={METHODS[m as PaymentMethod]?.label ?? m}
            value={omr(v.total)} sub={`${v.n} دفعة`} />
        ))}
      </div>

      {msg && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={msg.bad
            ? { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }
            : { background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          {msg.bad ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {unmatched.length > 0 && (
        <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.26)", color: "#fbbf24" }}>
          <Hash className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="ltr-nums">{unmatched.length}</span> دفعة بطاقة أو تحويل بلا رقم مرجعي —
          لا يمكن مطابقتها مع تقرير المكينة أو كشف البنك.
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "cash", "card", "bank_transfer", "thawani", "insurance"] as const).map((k) => {
          const on = method === k;
          const n = k === "all" ? payments.length : payments.filter((p) => p.method === k).length;
          if (k !== "all" && n === 0) return null;
          return (
            <button key={k} onClick={() => setMethod(k)}
              className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
              style={{
                background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                color: on ? "var(--accent-1)" : "var(--text-3)",
              }}>
              {k === "all" ? "الكل" : METHODS[k].label}
              <span className="ltr-nums text-[11px] opacity-70">{n}</span>
            </button>
          );
        })}
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المريض أو رقم الفاتورة أو الرقم المرجعي…"
            style={{ paddingInlineStart: 34 }} />
          {q && (
            <button onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2"
              style={{ insetInlineEnd: 12 }}>
              <X className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
            </button>
          )}
        </div>
      </div>

      {capped && (
        <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          تُعرض أحدث الدفعات فقط — والمجاميع أعلاه تخصّ المعروض.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-16">
          <Coins className="w-7 h-7" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {q || method !== "all" ? "لا دفعة تطابق البحث" : "لا دفعات مسجّلة بعد"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {rows.map((p, i) => {
            const m = METHODS[p.method as PaymentMethod];
            const Icon = iconFor(p.method);
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{
                  borderTop: i ? "1px solid var(--hairline-2)" : "none",
                  opacity: p.voided ? 0.55 : 1,
                }}>
                <Icon className="w-4 h-4 shrink-0" style={{ color: m?.colour ?? "var(--text-3)" }} />

                <div className="shrink-0" style={{ minWidth: 92 }}>
                  <p className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>
                    {arDateShort.format(new Date(p.paidAt))}
                  </p>
                  <p className="text-[10.5px] ltr-nums" style={{ color: "var(--text-4)" }}>
                    {arTime.format(new Date(p.paidAt))}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  {p.patientId ? (
                    <Link href={`/reception/patients/${p.patientId}`}
                      className="text-[13px] font-bold text-white truncate hover:underline">
                      {p.patientName}
                    </Link>
                  ) : (
                    <span className="text-[13px] font-bold text-white truncate">{p.patientName}</span>
                  )}
                  <p className="text-[10.5px] truncate" style={{ color: "var(--text-4)" }}>
                    <span className="ltr-nums">{p.invoiceNumber}</span>
                    {" · "}{m?.label ?? p.method}
                    {p.reference && <> · مرجع <span className="ltr-nums">{p.reference}</span></>}
                  </p>
                  {/* Who took it. Without this a short till has no owner. */}
                  <p className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: "var(--text-4)" }}>
                    <UserCircle className="w-3 h-3 shrink-0" />
                    {p.receivedBy ? (staffNames[p.receivedBy] ?? "موظف") : "غير مسجّل"}
                  </p>
                  {p.voided && (
                    <p className="text-[10.5px] mt-0.5" style={{ color: "#fda4b4" }}>
                      ملغاة — {p.voidReason}
                      {p.voidedBy && ` · بواسطة ${staffNames[p.voidedBy] ?? "موظف"}`}
                    </p>
                  )}
                </div>

                <span className="text-[13.5px] font-black ltr-nums shrink-0"
                  style={{
                    color: p.voided ? "var(--text-4)" : "#ffffff",
                    textDecoration: p.voided ? "line-through" : undefined,
                  }}>
                  {omr(p.amount)}
                </span>

                {!p.voided && (
                  p.dayClosed ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-4)" }}
                      title="اليوم مُغلق ومطابَق — التصحيح يكون على الفاتورة">
                      يوم مُغلق
                    </span>
                  ) : (
                    <button className="btn-ghost shrink-0" disabled={pending}
                      title="إلغاء دفعة سُجّلت بالخطأ"
                      onClick={() => { setMsg(null); setVoiding(p); }}>
                      <Ban className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {voiding && (
        <VoidDialog p={voiding} pending={pending}
          onClose={() => setVoiding(null)} onVoid={doVoid} />
      )}
    </div>
  );
}

function Card({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <div className="panel" style={{ padding: "0.95rem 1.1rem" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
        style={{ color: "var(--text-4)" }}>{label}</p>
      <p className="font-black ltr-nums leading-none"
        style={{ fontSize: "1.3rem", color: accent ? "var(--accent-1)" : "#ffffff" }}>{value}</p>
      <p className="text-[10.5px] mt-1.5 ltr-nums" style={{ color: "var(--text-4)" }}>{sub}</p>
    </div>
  );
}

function VoidDialog({
  p, pending, onClose, onVoid,
}: {
  p: RegisterPayment; pending: boolean;
  onClose: () => void; onVoid: (p: RegisterPayment, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 420, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-black text-white flex items-center gap-2">
            <Ban className="w-4 h-4" style={{ color: "#fda4b4" }} /> إلغاء دفعة
          </h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <p className="text-[12.5px] mb-3" style={{ color: "var(--text-2)" }}>
          {p.patientName} — <span className="ltr-nums font-black text-white">{omr(p.amount)}</span> ر.ع
          {" "}({METHODS[p.method as PaymentMethod]?.label ?? p.method}) على الفاتورة{" "}
          <span className="ltr-nums">{p.invoiceNumber}</span>
        </p>

        {/* The distinction that keeps the till honest. */}
        <p className="text-[11.5px] leading-relaxed rounded-xl px-3 py-2.5 mb-3"
          style={{ background: "rgba(253,164,180,0.07)", border: "1px solid rgba(253,164,180,0.22)", color: "var(--text-2)" }}>
          الإلغاء يعني أن هذه الدفعة <b>لم تحصل أصلاً</b> — خطأ في الإدخال. تخرج من كل
          المجاميع ويبقى سجلها. أما إن كان المريض دفع فعلاً وترجّعون له مبلغه فذاك
          <b> استرداد</b> من صفحة الفواتير، لا إلغاء.
        </p>

        <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--text-3)" }}>
          السبب * — يبقى في السجل ولا يُعدَّل
        </label>
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="مثال: أُدخل المبلغ ٤٥٠ بدل ٤٥" />

        <div className="flex items-center justify-end gap-2 mt-4">
          <button className="btn-ghost" onClick={onClose}>رجوع</button>
          <button className="btn-primary" disabled={pending || reason.trim().length < 3}
            onClick={() => onVoid(p, reason.trim())}>
            <Ban className="w-4 h-4" /> {pending ? "جارٍ…" : "تأكيد الإلغاء"}
          </button>
        </div>
      </div>
    </div>
  );
}
