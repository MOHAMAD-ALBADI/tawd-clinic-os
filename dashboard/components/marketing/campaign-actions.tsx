"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Send, AlertTriangle } from "lucide-react";
import { resumeCampaign, retryFailed } from "@/app/actions/campaigns";

/** Continue or retry a campaign from the list.

    Sending is capped per run, and WhatsApp rejects individual recipients for
    reasons the clinic can often fix — an expired token, a mistyped number. Both
    used to leave the campaign frozen with no way forward. */
export function CampaignActions({
  campaignId, pending, failed,
}: { campaignId: string; pending: number; failed: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.reason ?? "تعذّر التنفيذ"); return; }
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  if (pending === 0 && failed === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      {pending > 0 && (
        <button className="btn-ghost text-[11px]" disabled={busy}
          onClick={() => run(() => resumeCampaign(campaignId))}>
          <Send className="w-3 h-3" /> متابعة الإرسال ({pending})
        </button>
      )}
      {failed > 0 && (
        <button className="btn-ghost text-[11px]" disabled={busy}
          onClick={() => run(() => retryFailed(campaignId))}>
          <RotateCcw className="w-3 h-3" /> إعادة المحاولة ({failed})
        </button>
      )}
      {busy && <span className="text-[11px]" style={{ color: "var(--text-4)" }}>جارٍ الإرسال…</span>}
      {err && (
        <span className="flex items-center gap-1 text-[11px]" style={{ color: "#fda4b4" }}>
          <AlertTriangle className="w-3 h-3" /> {err}
        </span>
      )}
    </div>
  );
}
