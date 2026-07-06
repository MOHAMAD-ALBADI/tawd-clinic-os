"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PauseCircle, PlayCircle } from "lucide-react";
import { setClinicStatus } from "@/app/actions/platform";

export function ClinicStatusToggle({
  clinicId,
  status,
}: {
  clinicId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function set(next: "active" | "suspended") {
    setErr(null);
    start(async () => {
      try {
        const r = await setClinicStatus(clinicId, next);
        if (!r.ok) { setErr(r.reason); return; }
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status !== "active" && (
        <button onClick={() => set("active")} disabled={pending} className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: 12 }}>
          <PlayCircle className="w-3.5 h-3.5" /> تفعيل
        </button>
      )}
      {status !== "suspended" && (
        <button onClick={() => set("suspended")} disabled={pending} className="btn-danger">
          <PauseCircle className="w-3.5 h-3.5" /> إيقاف مؤقت
        </button>
      )}
      {err && <span className="text-[11px]" style={{ color: "#fda4b4" }}>{err}</span>}
      {pending && <Power className="w-3.5 h-3.5 animate-pulse" style={{ color: "var(--text-3)" }} />}
    </div>
  );
}
