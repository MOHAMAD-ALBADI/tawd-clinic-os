"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Send, X, Copy, Check, CheckCircle2, AlertTriangle, Smartphone } from "lucide-react";
import { createInvoicePaymentLink, sendPaymentLink, cancelPaymentLink } from "@/app/actions/thawani";

export type LinkRow = {
  id: string; url: string; amount: number; status: string;
  created_at: string; expires_at: string | null; paid_at: string | null;
  invoice_number: string; patient_name: string;
};
export type PayableInvoice = { id: string; invoice_number: string; patient_name: string; total: number };

const STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "بانتظار الدفع", color: "#fbbf24" },
  paid:      { label: "مدفوع",          color: "#5dd9cb" },
  expired:   { label: "منتهي",          color: "#a1a1aa" },
  cancelled: { label: "ملغى",           color: "#71717a" },
};
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);
const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—");

export function ThawaniBoard({
  links, payable, configured,
}: { links: LinkRow[]; payable: PayableInvoice[]; configured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3000); }

  function create(invoiceId: string) {
    setErr(null);
    start(async () => {
      try {
        const r = await createInvoicePaymentLink(invoiceId);
        if (!r.ok) { setErr(r.reason); return; }
        setPicking(false);
        ok(r.reused ? "يوجد رابط ساري لهذه الفاتورة" : "أُنشئ رابط الدفع");
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }
  function send(id: string) {
    setErr(null);
    start(async () => {
      try {
        const r = await sendPaymentLink(id);
        if (!r.ok) { setErr(r.reason); return; }
        ok("أُرسل الرابط للمريض عبر واتساب");
      } catch { setErr("تعذّر الاتصال"); }
    });
  }
  function cancel(id: string) {
    start(async () => {
      try { const r = await cancelPaymentLink(id); if (r.ok) { ok("أُلغي الرابط"); router.refresh(); } } catch { /* ignore */ }
    });
  }
  async function copy(url: string, id: string) {
    try { await navigator.clipboard.writeText(url); setCopied(id); setTimeout(() => setCopied(null), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="section-title">
          <Link2 className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>روابط الدفع</h2>
        </div>
        <button className="btn-primary" disabled={!configured || pending} onClick={() => { setErr(null); setPicking(true); }}>
          <Smartphone className="w-4 h-4" /> رابط دفع جديد
        </button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {/* pick the invoice to charge */}
      {picking && (
        <div className="panel-2 mb-4" style={{ padding: "1rem" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-white">اختر الفاتورة</p>
            <button onClick={() => setPicking(false)} className="btn-ghost"><X className="w-3.5 h-3.5" /></button>
          </div>
          {payable.length === 0 ? (
            <p className="text-[12.5px] py-3 text-center" style={{ color: "var(--text-4)" }}>
              لا فواتير غير مدفوعة — أنشئ فاتورة أولاً من تبويب الفواتير
            </p>
          ) : (
            <div className="space-y-1.5" style={{ maxHeight: 260, overflowY: "auto" }}>
              {payable.map((inv) => (
                <button key={inv.id} disabled={pending} onClick={() => create(inv.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[12.5px] transition-colors"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono ltr-nums shrink-0" style={{ color: "var(--text-3)" }}>{inv.invoice_number}</span>
                    <span className="font-semibold text-white truncate">{inv.patient_name}</span>
                  </span>
                  <span className="font-black ltr-nums shrink-0" style={{ color: "var(--accent-1)" }}>{fmt(inv.total)} ر.ع</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--text-4)" }}>
          لا روابط دفع بعد — أنشئ رابطاً وأرسله للمريض على واتساب
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["الفاتورة", "المريض", "المبلغ", "أُنشئ", "الحالة", ""].map((h) => (
                  <th key={h} className="text-start px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const st = STATUS[l.status] ?? STATUS.pending;
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td className="px-3 py-3 font-mono text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>{l.invoice_number}</td>
                    <td className="px-3 py-3 font-bold text-white">{l.patient_name}</td>
                    <td className="px-3 py-3 font-black ltr-nums text-white">{fmt(l.amount)}</td>
                    <td className="px-3 py-3 ltr-nums text-[11.5px]" style={{ color: "var(--text-4)" }}>
                      {l.status === "paid" ? when(l.paid_at) : when(l.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}44` }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {l.status === "pending" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button className="btn-ghost" disabled={pending} onClick={() => copy(l.url, l.id)} title="نسخ الرابط">
                            {copied === l.id ? <Check className="w-3.5 h-3.5" style={{ color: "#5dd9cb" }} /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button className="btn-ghost" disabled={pending} onClick={() => send(l.id)} title="إرسال على واتساب">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-ghost" disabled={pending} onClick={() => cancel(l.id)} title="إلغاء الرابط">
                            <X className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
