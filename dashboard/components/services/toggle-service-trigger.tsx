"use client";

import { useTransition } from "react";
import { toggleServiceStatus } from "@/app/actions/services";

export function ToggleServiceTrigger({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(() => toggleServiceStatus(id, !isActive));
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
      style={
        isActive
          ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#F87171" }
          : { background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "#5dd9cb" }
      }
    >
      {pending ? "..." : isActive ? "تعطيل" : "تفعيل"}
    </button>
  );
}
