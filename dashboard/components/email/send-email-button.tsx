"use client";

import { useState, useTransition } from "react";
import { Mail, X, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { emailInvoice, emailReceipt, emailStatement } from "@/app/actions/email";

type Kind = "invoice" | "receipt" | "statement";

const LABEL: Record<Kind, string> = {
  invoice: "إرسال الفاتورة بالبريد",
  receipt: "إرسال السند بالبريد",
  statement: "إرسال الكشف بالبريد",
};

/** Send a document to the patient.

    Opens a small confirmation rather than firing on click, for two reasons: the
    address on file is often stale, and the person pressing this is about to send
    a patient's financial document — a moment's pause with the destination
    written out is worth more than one saved click. */
export function SendEmailButton({
  kind, id, patientEmail, enabled, compact,
}: {
  kind: Kind;
  id: string;
  /** what is on file, so it can be shown and overridden */
  patientEmail: string | null;
  /** the clinic has the email channel switched on */
  enabled: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [to, setTo] = useState(patientEmail ?? "");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  function send() {
    setMsg(null);
    start(async () => {
      const fn = kind === "invoice" ? emailInvoice : kind === "receipt" ? emailReceipt : emailStatement;
      const r = await fn(id, to.trim() || undefined);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setMsg({ text: `أُرسلت إلى ${r.to} ✓` });
      setTimeout(() => { setOpen(false); setMsg(null); }, 2200);
    });
  }

  if (!enabled) return null;

  return (
    <>
      <button className={compact ? "btn-ghost" : "btn-ghost"} onClick={() => { setMsg(null); setOpen(true); }}
        title={LABEL[kind]}>
        <Mail className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
        {!compact && <span className="text-[12px]">بريد</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
          style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full glass" style={{ maxWidth: 400, borderRadius: "1.25rem", padding: "1.5rem" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-black text-white flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: "var(--accent-1)" }} /> {LABEL[kind]}
              </h3>
              <button className="btn-ghost" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
            </div>

            <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--text-3)" }}>
              إلى
            </label>
            <input className="field ltr-nums" dir="ltr" type="email" value={to}
              onChange={(e) => setTo(e.target.value)} placeholder="patient@example.com" />
            {!patientEmail && (
              <p className="text-[11px] mt-2" style={{ color: "#fbbf24" }}>
                لا يوجد بريد محفوظ لهذا المريض — اكتبه هنا، ولن يُحفظ في ملفه.
              </p>
            )}

            {msg && (
              <p className="flex items-center gap-1.5 text-[12px] mt-3"
                style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
                {msg.bad ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                {msg.text}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
              <button className="btn-primary" disabled={pending || !to.trim()} onClick={send}>
                <Send className="w-4 h-4" /> {pending ? "جارٍ الإرسال…" : "إرسال"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
