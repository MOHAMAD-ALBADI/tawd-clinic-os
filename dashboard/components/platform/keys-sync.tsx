"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { syncPlatformKeysToClinics } from "@/app/actions/channels";

/** Push the platform's keys into every connected clinic's channel row.

    They have to live in both places: six n8n workflows read them out of the
    clinic's row, WF-05 included, and that one is not to be edited. Rotating a
    key therefore used to mean editing every clinic's JSON by hand, and a clinic
    that got missed simply stopped answering with no error raised anywhere. */
export function KeysSync({ clinics }: { clinics: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      try {
        const r = await syncPlatformKeysToClinics();
        setMsg({ text: `حُدِّثت ${r.updated} عيادة ✓` });
        router.refresh();
      } catch {
        setMsg({ text: "تعذّر التنفيذ", bad: true });
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3"
      style={{ borderTop: "1px solid var(--hairline)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
        مفاتيح سُرى منسوخة داخل كل عيادة مربوطة ({clinics}) — بعد تدوير أي مفتاح، انسخه لها
      </p>
      <div className="flex items-center gap-2">
        {msg && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
            {msg.bad ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {msg.text}
          </span>
        )}
        <button className="btn-ghost text-[11px]" disabled={busy || clinics === 0} onClick={run}>
          <RefreshCw className="w-3 h-3" /> {busy ? "جارٍ…" : "مزامنة المفاتيح"}
        </button>
      </div>
    </div>
  );
}
