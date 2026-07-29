"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, X, Check } from "lucide-react";
import { resolveSuraError } from "@/app/actions/error-tracking";

export type SuraErrorRow = {
  id: string;
  workflowName: string;
  nodeName: string;
  message: string;
  at: string;
};

/** Open Sura workflow errors, with a way to close them.

    The panel used to list the last ten rows whatever their status and offer no
    action, so the log only ever grew — fifty-two rows accumulated from faults
    fixed weeks earlier, and the health signal reading that count sat permanently
    red. Only open errors appear here now, and each one can be closed with the
    reason recorded. */
export function SuraErrorsPanel({ errors }: { errors: SuraErrorRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [closing, setClosing] = useState<SuraErrorRow | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const ago = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 1 ? "الآن" : h < 24 ? `منذ ${h} س` : `منذ ${Math.floor(h / 24)} يوم`;
  };

  function close(e: SuraErrorRow) {
    setMsg(null);
    start(async () => {
      const r = await resolveSuraError(e.id, note);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setClosing(null); setNote("");
      setMsg({ text: "أُغلق الخطأ ✓" });
      setTimeout(() => setMsg(null), 3000);
      router.refresh();
    });
  }

  if (errors.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--accent-1)" }}>
        <CheckCircle2 className="w-3.5 h-3.5" /> لا أخطاء مفتوحة ✓
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {msg && (
        <p className="text-[12px]" style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
          {msg.text}
        </p>
      )}

      {errors.map((e) => (
        <div key={e.id} className="px-3 py-2 rounded-lg"
          style={{ background: "rgba(244,63,94,0.04)", border: "1px solid rgba(244,63,94,0.12)" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-white">
                {e.workflowName}
                <span style={{ color: "var(--text-4)" }}> · {e.nodeName} · {ago(e.at)}</span>
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                {e.message.slice(0, 140)}
              </p>
            </div>
            <button className="btn-ghost shrink-0" disabled={pending} title="إغلاق الخطأ"
              onClick={() => { setMsg(null); setNote(""); setClosing(e); }}>
              <Check className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
            </button>
          </div>
        </div>
      ))}

      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full glass" style={{ maxWidth: 420, borderRadius: "1.25rem", padding: "1.5rem" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-black text-white">إغلاق الخطأ</h3>
              <button className="btn-ghost" onClick={() => setClosing(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[12px] mb-3" style={{ color: "var(--text-3)" }}>
              {closing.workflowName} · {closing.nodeName}
            </p>

            {/* A reason is required: "resolved" with no note is
                indistinguishable from "dismissed because it was annoying", and
                weeks later nobody can tell whether the fault was really fixed. */}
            <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--text-3)" }}>
              ما الذي عولج؟ *
            </label>
            <input className="field" value={note} onChange={(ev) => setNote(ev.target.value)}
              placeholder="مثال: صُحّح اسم الحالة في السير — ناجح ٥ أيام" />

            {msg?.bad && (
              <p className="flex items-center gap-1.5 text-[12px] mt-2" style={{ color: "#fda4b4" }}>
                <AlertTriangle className="w-3.5 h-3.5" /> {msg.text}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="btn-ghost" onClick={() => setClosing(null)}>إلغاء</button>
              <button className="btn-primary" disabled={pending || note.trim().length < 3}
                onClick={() => close(closing)}>
                <Check className="w-4 h-4" /> {pending ? "جارٍ…" : "إغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
