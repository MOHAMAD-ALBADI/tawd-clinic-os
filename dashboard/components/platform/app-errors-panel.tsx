"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Bug } from "lucide-react";
import { resolveAppError } from "@/app/actions/error-tracking";

export type AppErrorRow = {
  id: string; error_message: string; severity: string; context: Record<string, unknown> | null; created_at: string;
};

const SEV_COLOR: Record<string, string> = {
  critical: "#fda4b4", high: "#fda4b4", medium: "#fbbf24", low: "var(--text-4)",
};

/* Own copy of the relative-time helper: a Server Component cannot pass a
   function as a prop to a Client Component (props must be serialisable). */
function ago(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "الآن" : h < 24 ? `منذ ${h} س` : `منذ ${Math.floor(h / 24)} يوم`;
}

/** new URL() throws on a malformed value — never let a logged error crash the
    page that displays it. */
function pathOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/** TAWD's in-house Sentry-equivalent — see app/actions/error-tracking.ts. */
export function AppErrorsPanel({ errors }: { errors: AppErrorRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function resolve(id: string) {
    start(async () => { try { await resolveAppError(id); router.refresh(); } catch { /* ignore */ } });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
        <Bug className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        أخطاء لوحة التحكم <span className="text-[11px] font-normal" style={{ color: "var(--text-4)" }}>(متتبّع طود الخاص)</span>
      </h3>
      {errors.length === 0 ? (
        <p className="text-[12px]" style={{ color: "#5dd9cb" }}>لا أخطاء ✓</p>
      ) : (
        <div className="space-y-1.5">
          {errors.map((e) => {
            const color = SEV_COLOR[e.severity] ?? "var(--text-4)";
            const url = (e.context?.url as string | undefined) ?? null;
            return (
              <div key={e.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
                style={{ background: `${color}0d`, border: `1px solid ${color}30` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white">{e.error_message.slice(0, 140)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>
                    {e.severity} · {ago(e.created_at)}{pathOf(url) ? ` · ${pathOf(url)}` : ""}
                  </p>
                </div>
                <button title="تعليم كمُراجَع" disabled={pending} onClick={() => resolve(e.id)}
                  className="w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0"
                  style={{ background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.28)", color: "#5dd9cb" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
