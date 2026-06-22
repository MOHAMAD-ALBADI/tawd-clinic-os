"use client";

import { useState, useTransition } from "react";
import { formatTime, isLateAppointment } from "@/lib/utils";
import { AppointmentStatusBadge } from "@/components/appointments/status-badge";
import { updateAppointmentStatus } from "@/app/actions/appointments";
import { UserCheck, UserX, PlayCircle, Clock, CheckCircle2 } from "lucide-react";
import type { TimelineSlot, AppointmentStatus } from "@/types/tawd";

interface TodayTimelineProps {
  slots: TimelineSlot[];
}

export function TodayTimeline({ slots: initial }: TodayTimelineProps) {
  const [slots, setSlots] = useState(initial);
  const [, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}
        >
          <Clock className="w-7 h-7" style={{ color: "#14b8a6" }} />
        </div>
        <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
          لا توجد مواعيد اليوم
        </p>
      </div>
    );
  }

  async function handleStatus(slotId: string, newStatus: AppointmentStatus) {
    setLoadingId(slotId);
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: newStatus } : s))
    );
    startTransition(async () => {
      try {
        await updateAppointmentStatus(slotId, newStatus);
      } catch {
        setSlots(initial);
      } finally {
        setLoadingId(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      {slots.map((slot) => {
        const late   = isLateAppointment(slot.time, slot.status);
        const busy   = loadingId === slot.id;
        const active = ["scheduled","confirmed"].includes(slot.status);

        return (
          <div
            key={slot.id}
            className="group flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200"
            style={{
              background: late
                ? "rgba(20,184,166,0.08)"
                : "rgba(255,255,255,0.03)",
              border: late
                ? "1px solid rgba(20,184,166,0.2)"
                : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Time dot */}
            <div className="flex flex-col items-center gap-1 shrink-0 w-12">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: late ? "#14b8a6" : "#14b8a6" }}
              />
              <span
                className="text-xs font-mono ltr-nums tabular-nums"
                style={{ color: "rgba(148,163,184,0.6)" }}
              >
                {formatTime(slot.time)}
              </span>
            </div>

            {/* Patient info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: "rgba(226,232,240,0.95)" }}>
                {slot.patient_name}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: "rgba(148,163,184,0.55)" }}>
                {slot.service}
                {slot.doctor_name && (
                  <span style={{ color: "#14b8a6" }}> · د. {slot.doctor_name}</span>
                )}
              </p>
            </div>

            {/* Badge */}
            <AppointmentStatusBadge status={slot.status} isLate={late} />

            {/* Action buttons */}
            {active && (
              <div
                className="flex items-center gap-1.5 shrink-0 transition-all duration-200"
                style={{ opacity: busy ? 0.5 : 1 }}
              >
                <button
                  disabled={busy}
                  onClick={() => handleStatus(slot.id, "checked_in")}
                  title="تسجيل حضور"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(45,212,191,0.14)",
                    border: "1px solid rgba(45,212,191,0.28)",
                    color: "#5dd9cb",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(45,212,191,0.24)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(45,212,191,0.14)"; }}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  وصل
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleStatus(slot.id, "in_progress")}
                  title="بدء الفحص"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(56,189,248,0.14)",
                    border: "1px solid rgba(56,189,248,0.25)",
                    color: "#7dd3fc",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(56,189,248,0.24)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(56,189,248,0.14)"; }}
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  فحص
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleStatus(slot.id, "no_show")}
                  title="لم يحضر"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.22)",
                    color: "#F87171",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.22)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
                >
                  <UserX className="w-3.5 h-3.5" />
                  غياب
                </button>
              </div>
            )}

            {slot.status === "in_progress" && (
              <button
                disabled={busy}
                onClick={() => handleStatus(slot.id, "completed")}
                title="إنهاء الفحص"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 shrink-0"
                style={{
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#34D399",
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                اكتمل
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
