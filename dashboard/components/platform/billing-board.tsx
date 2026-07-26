"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt, CheckCircle2, AlertTriangle, X, Banknote, Ban, Play, Trash2, ChevronLeft,
} from "lucide-react";
import {
  issueMonthlyRun, recordPlatformPayment, voidInvoice, deletePlatformPayment,
} from "@/app/actions/platform-billing";
import { NumField, F } from "@/components/ui/num-field";

export type InvoiceRow = {
  id: string; number: string; clinicId: string; clinicName: string;
  periodStart: string; periodEnd: string;
  total: number; paid: number; status: string;
  issuedAt: string; dueAt: string | null;
  payments: { id: string; amount: number; method: string; paidAt: string; reference: string | null }[];
};

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const DAY = new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" });

const METHOD_AR: Record<string, string> = {
  bank_transfer: "تحويل بنكي", cash: "نقداً", thawani: "ثواني", card: "بطاقة", other: "أخرى",
};
const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "غير مدفوعة", color: "#fbbf24" },
  paid: { label: "مدفوعة",     color: "#34d399" },
  void: { label: "ملغاة",      color: "#71717a" },
};

type Filter = "open" | "overdue" | "paid" | "all";

export function BillingBoard({ invoices, thisMonth }: { invoices: InvoiceRow[]; thisMonth: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [voiding, setVoiding] = useState<InvoiceRow | null>(null);
  const [run, setRun] = useState<{ issued: number; skipped: { clinic: string; why: string }[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 5000); }

  const overdue = (i: InvoiceRow) =>
    i.status === "open" && !!i.dueAt && new Date(i.dueAt).getTime() < Date.now();

  const rows = useMemo(() => invoices.filter((i) => {
    if (filter === "all") return true;
    if (filter === "overdue") return overdue(i);
    if (filter === "paid") return i.status === "paid";
    return i.status === "open";
  }), [invoices, filter]);

  const counts = useMemo(() => ({
    open: invoices.filter((i) => i.status === "open").length,
    overdue: invoices.filter(overdue).length,
    paid: invoices.filter((i) => i.status === "paid").length,
    all: invoices.length,
  }), [invoices]);

  function doRun() {
    setErr(null); setRun(null);
    start(async () => {
      const r = await issueMonthlyRun(thisMonth);
      if (!r.ok) { setErr(r.reason); return; }
      setRun({ issued: r.issued.length, skipped: r.skipped });
      if (r.issued.length) ok(`صدرت ${r.issued.length} فاتورة لشهر ${thisMonth}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {([["open", "غير مدفوعة"], ["overdue", "متأخرة"], ["paid", "مدفوعة"], ["all", "الكل"]] as [Filter, string][])
          .map(([k, label]) => {
            const on = filter === k;
            const n = counts[k];
            return (
              <button key={k} onClick={() => setFilter(k)}
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
        <button className="btn-primary ms-auto" disabled={pending} onClick={doRun}>
          <Play className="w-3.5 h-3.5" /> إصدار فواتير {thisMonth}
        </button>
      </div>

      {/* The run reports who it skipped and why — silence would read as "all
          done" while a clinic with no contract quietly went unbilled. */}
      {run && (
        <div className="panel" style={{ padding: "1rem 1.2rem" }}>
          <p className="text-[12.5px] font-bold text-white mb-1">
            صدرت <span className="ltr-nums">{run.issued}</span> فاتورة
          </p>
          {run.skipped.length > 0 && (
            <div className="space-y-0.5 mt-1.5">
              {run.skipped.map((s, i) => (
                <p key={i} className="text-[11.5px]" style={{ color: "#fbbf24" }}>
                  {s.clinic} — {s.why}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-16">
          <Receipt className="w-6 h-6" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {filter === "open" ? "لا فواتير معلّقة ✓" : "لا فواتير في هذا التصنيف"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["الفاتورة", "العيادة", "الفترة", "المبلغ", "المحصَّل", "الحالة", ""].map((h) => (
                    <th key={h} className="text-start px-3 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const st = STATUS[i.status] ?? STATUS.open;
                  const late = overdue(i);
                  const rest = i.total - i.paid;
                  return (
                    <>
                      <tr key={i.id} style={{ borderTop: "1px solid var(--hairline-2)" }}>
                        <td className="px-3 py-3">
                          <button onClick={() => setOpen(open === i.id ? null : i.id)}
                            className="font-bold ltr-nums text-white">{i.number}</button>
                          {late && (
                            <p className="text-[10.5px]" style={{ color: "#fda4b4" }}>
                              متأخرة منذ {DAY.format(new Date(i.dueAt as string))}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/platform-admin/clinics/${i.clinicId}`} className="text-white">
                            {i.clinicName}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[11.5px] ltr-nums" style={{ color: "var(--text-3)" }}>
                          {i.periodStart} → {i.periodEnd}
                        </td>
                        <td className="px-3 py-3 ltr-nums font-bold text-white">{fmt(i.total)}</td>
                        <td className="px-3 py-3 ltr-nums"
                          style={{ color: i.paid > 0 ? "#34d399" : "var(--text-4)" }}>
                          {fmt(i.paid)}
                          {i.status === "open" && i.paid > 0 && (
                            <span className="block text-[10.5px]" style={{ color: "#fbbf24" }}>
                              باقي {fmt(rest)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40` }}>
                            <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {i.status === "open" && (
                              <button className="btn-ghost" disabled={pending} title="تسجيل دفعة"
                                onClick={() => { setErr(null); setPaying(i); }}>
                                <Banknote className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                              </button>
                            )}
                            {i.status === "open" && i.paid === 0 && (
                              <button className="btn-ghost" disabled={pending} title="إلغاء الفاتورة"
                                onClick={() => { setErr(null); setVoiding(i); }}>
                                <Ban className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
                              </button>
                            )}
                            <button className="btn-ghost" onClick={() => setOpen(open === i.id ? null : i.id)}>
                              <ChevronLeft className="w-3.5 h-3.5"
                                style={{ transform: open === i.id ? "rotate(-90deg)" : undefined }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open === i.id && (
                        <tr key={`${i.id}-d`}>
                          <td colSpan={7} className="px-3 pb-3">
                            <div className="rounded-xl px-3.5 py-3"
                              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                              <p className="eyebrow mb-2">الدفعات</p>
                              {i.payments.length === 0 ? (
                                <p className="text-[11.5px]" style={{ color: "var(--text-4)" }}>
                                  لم تصل أي دفعة على هذه الفاتورة
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {i.payments.map((p) => (
                                    <div key={p.id} className="flex items-center gap-3 text-[11.5px] px-2 py-1.5 rounded-lg"
                                      style={{ background: "rgba(255,255,255,0.02)" }}>
                                      <span className="ltr-nums font-bold" style={{ color: "#34d399" }}>{fmt(p.amount)}</span>
                                      <span style={{ color: "var(--text-3)" }}>{METHOD_AR[p.method] ?? p.method}</span>
                                      <span className="ltr-nums" style={{ color: "var(--text-4)" }}>
                                        {DAY.format(new Date(p.paidAt))}
                                      </span>
                                      {p.reference && (
                                        <span className="ltr-nums truncate" style={{ color: "var(--text-4)" }}>#{p.reference}</span>
                                      )}
                                      <button className="btn-ghost ms-auto" disabled={pending} title="حذف الدفعة"
                                        onClick={() => start(async () => {
                                          const r = await deletePlatformPayment(p.id);
                                          if (!r.ok) { setErr(r.reason); return; }
                                          ok("حُذفت الدفعة — عادت الفاتورة غير مدفوعة");
                                          router.refresh();
                                        })}>
                                        <Trash2 className="w-3 h-3" style={{ color: "#fda4b4" }} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paying && (
        <PayDialog
          invoice={paying} pending={pending} err={err}
          onClose={() => setPaying(null)}
          onSave={(amount, method, paidAt, reference) => start(async () => {
            const r = await recordPlatformPayment({
              invoiceId: paying.id, amountOmr: amount, method, paidAt, reference,
            });
            if (!r.ok) { setErr(r.reason); return; }
            setPaying(null);
            ok(r.settled ? `سُدّدت ${paying.number} بالكامل ✓` : `سُجّلت دفعة على ${paying.number}`);
            router.refresh();
          })}
        />
      )}

      {voiding && (
        <VoidDialog
          invoice={voiding} pending={pending} err={err}
          onClose={() => setVoiding(null)}
          onSave={(reason) => start(async () => {
            const r = await voidInvoice(voiding.id, reason);
            if (!r.ok) { setErr(r.reason); return; }
            setVoiding(null);
            ok(`أُلغيت ${voiding.number} — ورقمها محفوظ في السجل`);
            router.refresh();
          })}
        />
      )}
    </div>
  );
}

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 440, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-black text-white">{title}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PayDialog({
  invoice, pending, err, onClose, onSave,
}: {
  invoice: InvoiceRow; pending: boolean; err: string | null; onClose: () => void;
  onSave: (a: number, m: "bank_transfer" | "cash" | "thawani" | "card" | "other", d: string, r: string) => void;
}) {
  const rest = invoice.total - invoice.paid;
  const [amount, setAmount] = useState(String(rest));
  const [method, setMethod] = useState<"bank_transfer" | "cash" | "thawani" | "card" | "other">("bank_transfer");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");

  return (
    <Shell title={`دفعة على ${invoice.number}`} onClose={onClose}>
      <p className="text-[12.5px] mb-4" style={{ color: "var(--text-2)" }}>
        {invoice.clinicName} — المتبقي <span className="font-black ltr-nums text-white">{fmt(rest)}</span> ر.ع
      </p>
      <div className="grid grid-cols-2 gap-3">
        <F label="المبلغ (ر.ع)"><NumField value={amount} onChange={setAmount} /></F>
        <F label="الطريقة">
          <select className="field" value={method} style={{ cursor: "pointer" }}
            onChange={(e) => setMethod(e.target.value as typeof method)}>
            {Object.entries(METHOD_AR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </F>
        <F label="التاريخ">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </F>
        <F label="مرجع التحويل">
          <input className="field ltr-nums" dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)}
            placeholder="اختياري" />
        </F>
      </div>
      {err && (
        <div className="flex items-center gap-2 text-[12.5px] px-3.5 py-2.5 rounded-xl mt-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 mt-4">
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" disabled={pending}
          onClick={() => onSave(Number(amount) || 0, method, date, ref)}>
          <Banknote className="w-4 h-4" /> تسجيل الدفعة
        </button>
      </div>
    </Shell>
  );
}

function VoidDialog({
  invoice, pending, err, onClose, onSave,
}: {
  invoice: InvoiceRow; pending: boolean; err: string | null; onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Shell title={`إلغاء ${invoice.number}`} onClose={onClose}>
      <p className="text-[12.5px] mb-3" style={{ color: "var(--text-2)" }}>
        لا تُحذف الفاتورة — يبقى رقمها في التسلسل مع سبب الإلغاء، لأن رقم فاتورة
        يختفي هو الشيء الوحيد الذي لا يقبله محاسب.
      </p>
      <F label="سبب الإلغاء">
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="صدرت بالخطأ · تغيّر الاتفاق قبل السداد" />
      </F>
      {err && (
        <p className="text-[12px] mt-2" style={{ color: "#fda4b4" }}>{err}</p>
      )}
      <div className="flex items-center justify-end gap-2 mt-4">
        <button className="btn-ghost" onClick={onClose}>تراجع</button>
        <button className="btn-danger" disabled={pending || !reason.trim()} onClick={() => onSave(reason)}>
          <Ban className="w-3.5 h-3.5" /> إلغاء الفاتورة
        </button>
      </div>
    </Shell>
  );
}
