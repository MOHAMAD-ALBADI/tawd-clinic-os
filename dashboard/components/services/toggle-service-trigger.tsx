"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleServiceStatus } from "@/app/actions/services";

export function ToggleServiceTrigger({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  /* The action reports failure by returning, not throwing, so the result has to
     be read — firing and forgetting would leave the button looking successful
     while nothing changed. */
  function handle() {
    setFailed(false);
    startTransition(async () => {
      try {
        const r = await toggleServiceStatus(id, !isActive);
        if (!r.ok) { setFailed(true); return; }
        router.refresh();
      } catch { setFailed(true); }
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={failed ? "تعذّر تغيير الحالة — حاول مجدداً" : undefined}
      className="text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
      style={
        failed
          ? { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fda4b4" }
          : isActive
            ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#F87171" }
            : { background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "#5dd9cb" }
      }
    >
      {pending ? "..." : failed ? "تعذّر" : isActive ? "تعطيل" : "تفعيل"}
    </button>
  );
}
