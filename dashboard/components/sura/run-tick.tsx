"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2 } from "lucide-react";

/* Run a beat of the agent now, rather than waiting for the ten-minute cron.
 *
 * Platform-owner only — the endpoint enforces that, this button just
 * avoids showing a control that would 404. It exists because "wait ten
 * minutes" is not a demonstration, and because when something is wrong
 * the person diagnosing it needs to watch one tick happen rather than
 * infer it from a log.
 */

type Report = {
  scanned: { gaps: number; plans: number };
  considered: number;
  messaged: number;
  dropped: number;
  waited: number;
  skipped: { goal: string; why: string }[];
  errors: string[];
  ms: number;
};

export function RunTick() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setBusy(true);
    setErr(null);
    setOut(null);
    try {
      const res = await fetch("/api/sura/tick", { cache: "no-store" });
      if (!res.ok) {
        setErr(res.status === 404 ? "هذا الزرّ لمالك المنصّة فقط" : `تعذّر التشغيل (${res.status})`);
        return;
      }
      setOut((await res.json()) as Report);
      /* The page is a server component reading fresh rows; refreshing it
         is what turns the tick into something visible. */
      startTransition(() => router.refresh());
    } catch {
      setErr("تعذّر الاتصال");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button type="button" onClick={run} disabled={busy} className="btn-primary">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {busy ? "تعمل…" : "شغّل الآن"}
      </button>

      {err && <p className="text-[11px] text-red-400">{err}</p>}

      {out && (
        <p className="text-[11px] leading-relaxed text-[var(--text-3)] sm:text-left">
          رصدت {out.scanned.gaps + out.scanned.plans} هدفاً جديداً · قيّمت {out.considered} ·
          راسلت {out.messaged} · أغلقت {out.dropped} · أجّلت {out.waited}
          {out.skipped.length > 0 && ` · امتنعت ${out.skipped.length}`}
          {` (${out.ms} ms)`}
          {out.errors.length > 0 && (
            <span className="mt-1 block text-red-400">{out.errors.join(" · ")}</span>
          )}
        </p>
      )}
    </div>
  );
}
