"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, CheckCircle2, UserX, Loader2 } from "lucide-react";
import { setAppointmentStatus } from "@/app/actions/doctor";

const PENDING = ["scheduled", "confirmed", "checked_in"];

export function AppointmentActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function run(next: "in_progress" | "completed" | "no_show") {
    setBusy(next);
    startTransition(async () => {
      try {
        await setAppointmentStatus(id, next);
        router.refresh();
      } finally {
        setBusy(null);
      }
    });
  }

  const btn = (bg: string, border: string, color: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 10,
    background: bg, border: `1px solid ${border}`, color, opacity: pending ? 0.6 : 1,
    cursor: pending ? "default" : "pointer",
  });
  const Spin = ({ k }: { k: string }) => (busy === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null);

  if (status === "completed")
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399" }}>مكتمل ✓</span>;
  if (status === "no_show")
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: "#F87171" }}>لم يحضر</span>;
  if (status === "cancelled")
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--text-4)", color: "var(--text-2)" }}>ملغي</span>;

  return (
    <div className="flex items-center gap-2">
      {status === "in_progress" ? (
        <button disabled={pending} onClick={() => run("completed")} style={btn("linear-gradient(135deg,var(--accent-2),var(--accent-3))", "transparent", "white")}>
          {busy === "completed" ? <Spin k="completed" /> : <CheckCircle2 className="w-3.5 h-3.5" />} إنهاء الكشف
        </button>
      ) : PENDING.includes(status) ? (
        <>
          <button disabled={pending} onClick={() => run("in_progress")} style={btn("rgb(var(--accent-2-rgb) / 0.14)", "rgb(var(--accent-1-rgb) / 0.25)", "var(--accent-1)")}>
            {busy === "in_progress" ? <Spin k="in_progress" /> : <Play className="w-3.5 h-3.5" />} بدء الكشف
          </button>
          <button disabled={pending} onClick={() => run("no_show")} style={btn("rgba(255,255,255,0.04)", "rgba(255,255,255,0.1)", "var(--text-2)")}>
            <UserX className="w-3.5 h-3.5" /> لم يحضر
          </button>
        </>
      ) : null}
    </div>
  );
}
