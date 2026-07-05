"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, CheckCircle2, AlertCircle } from "lucide-react";
import { checkInArrival } from "@/app/actions/reception";

export function CheckinButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function go() {
    setErr(null);
    start(async () => {
      try {
        const r = await checkInArrival(appointmentId);
        if (!r.ok) {
          setErr(r.reason);
          setTimeout(() => setErr(null), 4000);
          return;
        }
        setDone(r.position ?? 0);
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال");
        setTimeout(() => setErr(null), 4000);
      }
    });
  }

  if (err) {
    return (
      <span className="badge badge-bad shrink-0">
        <AlertCircle className="w-3 h-3" />
        {err}
      </span>
    );
  }

  if (done !== null) {
    return (
      <span className="badge badge-brand shrink-0">
        <CheckCircle2 className="w-3 h-3" />
        وصل{done ? ` · دور ${done}` : ""}
      </span>
    );
  }

  return (
    <button
      onClick={go}
      disabled={pending}
      className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      style={{
        background: "rgba(45,212,191,0.1)",
        border: "1px solid rgba(45,212,191,0.25)",
        color: "#5dd9cb",
      }}
    >
      <LogIn className="w-3.5 h-3.5" />
      {pending ? "…" : "تسجيل وصول"}
    </button>
  );
}
