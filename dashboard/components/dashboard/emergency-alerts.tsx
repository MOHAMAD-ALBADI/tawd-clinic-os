"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, MessageSquareWarning, Phone, Check } from "lucide-react";
import { acknowledgeAlert } from "@/app/actions/alerts";

export type EmergencyAlert = {
  id: string;
  kind: string; // 'emergency' | 'complaint'
  phone: string | null;
  patientName: string | null;
  message: string | null;
  ago: string;
};

const C = {
  emergency: { main: "#EF4444", soft: "#F87171", faint: "rgba(239,68,68,", label: "طوارئ" },
  complaint: { main: "#fbbf24", soft: "#fcd34d", faint: "rgba(251,191,36,", label: "شكوى" },
} as const;
const kc = (k: string) => (k === "complaint" ? C.complaint : C.emergency);

/** Live banner for unhandled Sura alerts (medical emergencies = red, complaints = amber). */
export function EmergencyAlerts({ alerts }: { alerts: EmergencyAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const hasEmergency = visible.some((a) => a.kind !== "complaint");
  const theme = hasEmergency ? C.emergency : C.complaint;
  const title = hasEmergency ? "تنبيهات تحتاج تدخّلاً فورياً" : "شكاوى تحتاج متابعة";

  function acknowledge(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(() => acknowledgeAlert(id).catch(() => {
      setDismissed((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }));
  }

  return (
    <div
      className="rounded-3xl overflow-hidden animate-fade-in"
      style={{
        background: `linear-gradient(145deg, ${theme.faint}0.14) 0%, rgba(18,14,10,0.95) 55%)`,
        border: `1px solid ${theme.faint}0.35)`,
        boxShadow: `0 0 0 1px ${theme.faint}0.12), 0 24px 60px ${theme.faint}0.12)`,
      }}
    >
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: theme.main }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: theme.main, boxShadow: `0 0 8px ${theme.main}` }} />
        </span>
        {hasEmergency ? <AlertTriangle className="w-4 h-4" style={{ color: theme.soft }} /> : <MessageSquareWarning className="w-4 h-4" style={{ color: theme.soft }} />}
        <h2 className="font-black text-white text-sm">{title}</h2>
        <span className="ltr-nums text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${theme.faint}0.2)`, color: theme.soft }}>
          {visible.length}
        </span>
      </div>

      <div className="px-4 pb-4 pt-1 space-y-2">
        {visible.map((a) => {
          const c = kc(a.kind);
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.28)", border: `1px solid ${c.faint}0.18)` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: `${c.faint}0.18)`, color: c.soft }}>{c.label}</span>
                  <span className="font-bold text-white text-sm">{a.patientName?.trim() || "مريض"}</span>
                  {a.phone && (
                    <a href={`tel:${a.phone}`} className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ltr-nums" style={{ background: `${c.faint}0.16)`, color: c.soft }}>
                      <Phone className="w-3 h-3" />
                      {a.phone}
                    </a>
                  )}
                  <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.45)" }}>{a.ago}</span>
                </div>
                {a.message && (
                  <p className="text-[12px] mt-1 leading-relaxed line-clamp-3" style={{ color: "rgba(255,255,255,0.72)" }}>{a.message}</p>
                )}
              </div>
              <button
                onClick={() => acknowledge(a.id)}
                disabled={pending}
                className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}
              >
                <Check className="w-3.5 h-3.5" />
                تم التعامل
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
