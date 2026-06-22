"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleStaffActive } from "@/app/actions/staff";

interface Props {
  staffId: string;
  isActive: boolean;
  name: string;
}

export function ToggleActiveButton({ staffId, isActive, name }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleStaffActive(staffId, !isActive);
        router.refresh();
      } catch {
        // Error is silently swallowed here; the UI will not change
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      title={isActive ? `تعطيل ${name}` : `تفعيل ${name}`}
      className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all disabled:opacity-40"
      style={
        isActive
          ? { background: "rgba(239,68,68,0.08)", color: "#F87171", border: "1px solid rgba(239,68,68,0.15)" }
          : { background: "rgba(16,185,129,0.08)", color: "#34D399", border: "1px solid rgba(16,185,129,0.15)" }
      }
    >
      {pending ? "..." : isActive ? "تعطيل" : "تفعيل"}
    </button>
  );
}
