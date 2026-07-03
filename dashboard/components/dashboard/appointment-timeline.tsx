"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { updateAppointmentStatus } from "@/app/actions/appointments";

type Appt = {
  id: string;
  slot_time: string;
  status: string;
  patients: unknown;
  services: unknown;
  tawd_staff_users: unknown;
};

type Doctor = { id: string; name: string; name_ar: string | null };

/* Status = meaning. Neutral for waiting, accent for arrived,
   info for active, green for done, amber late, red no-show. */
const STATUS_MAP: Record<string, { label: string; color: string; bar: string; bg: string }> = {
  scheduled:   { label: "مجدول",  color: "#a1a1aa", bar: "rgba(255,255,255,0.25)", bg: "rgba(255,255,255,0.03)" },
  confirmed:   { label: "مؤكد",   color: "#e4e4e7", bar: "rgba(255,255,255,0.45)", bg: "rgba(255,255,255,0.04)" },
  checked_in:  { label: "حضر",    color: "#5dd9cb", bar: "#14b8a6", bg: "rgba(20,184,166,0.06)" },
  in_progress: { label: "جارٍ",   color: "#7dd3fc", bar: "#38bdf8", bg: "rgba(56,189,248,0.06)" },
  completed:   { label: "مكتمل",  color: "#6ee7b7", bar: "#34d399", bg: "rgba(52,211,153,0.05)" },
  cancelled:   { label: "ملغي",   color: "#71717a", bar: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.015)" },
  no_show:     { label: "غياب",   color: "#fda4b4", bar: "#f43f5e", bg: "rgba(244,63,94,0.05)" },
};

const LATE = { label: "تأخّر", color: "#fcd34d", bar: "#fbbf24", bg: "rgba(251,191,36,0.06)" };

const NEXT_ACTIONS: Record<string, Array<{ label: string; status: string; color: string }>> = {
  scheduled: [
    { label: "سجّل حضوره", status: "checked_in",  color: "#5dd9cb" },
    { label: "تأكيد",       status: "confirmed",   color: "#e4e4e7" },
    { label: "إلغاء",       status: "cancelled",   color: "#71717a" },
    { label: "غياب",        status: "no_show",     color: "#fda4b4" },
  ],
  confirmed: [
    { label: "سجّل حضوره", status: "checked_in",  color: "#5dd9cb" },
    { label: "إلغاء",       status: "cancelled",   color: "#71717a" },
    { label: "غياب",        status: "no_show",     color: "#fda4b4" },
  ],
  checked_in: [
    { label: "ابدأ الجلسة", status: "in_progress", color: "#7dd3fc" },
    { label: "إلغاء",       status: "cancelled",   color: "#71717a" },
  ],
  in_progress: [
    { label: "اكتمل",       status: "completed",   color: "#6ee7b7" },
  ],
};

export function AppointmentTimeline({
  appointments,
  doctors,
}: {
  appointments: Appt[];
  doctors: Doctor[];
}) {
  const router = useRouter();
  const [hoveredId, setHoveredId]         = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc]     = useState("all");
  const [loadingId, setLoadingId]         = useState<string | null>(null);
  const [now, setNow]                     = useState(() => new Date());
  const [, startTransition]               = useTransition();

  /* keep "now" fresh every minute for late detection */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const isLate = (a: Appt) =>
    ["scheduled", "confirmed"].includes(a.status) &&
    now.getTime() - new Date(a.slot_time).getTime() > 5 * 60_000;

  const filtered =
    selectedDoc === "all"
      ? appointments
      : appointments.filter((a) => (a.tawd_staff_users as any)?.id === selectedDoc);

  function handleAction(apptId: string, newStatus: string) {
    setLoadingId(apptId);
    startTransition(async () => {
      try {
        await updateAppointmentStatus(apptId, newStatus as any);
        router.refresh();
      } finally {
        setLoadingId(null);
        setHoveredId(null);
      }
    });
  }

  /* --- summary counts --- */
  const completed  = appointments.filter((a) => a.status === "completed").length;
  const pending    = appointments.filter((a) => ["scheduled", "confirmed"].includes(a.status)).length;
  const inProgress = appointments.filter((a) => ["checked_in", "in_progress"].includes(a.status)).length;
  const lateCount  = appointments.filter(isLate).length;

  return (
    <div className="flex flex-col gap-3">
      {/* ── status pills ── */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "انتظار", value: pending,    color: "#a1a1aa" },
          { label: "جارٍ",   value: inProgress, color: "#7dd3fc" },
          { label: "مكتمل",  value: completed,  color: "#6ee7b7" },
          ...(lateCount > 0
            ? [{ label: "تأخّر", value: lateCount, color: "#fcd34d" }]
            : []),
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
            <span className="font-bold ltr-nums text-white">{s.value}</span>
            <span style={{ color: "var(--text-3)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── doctor filter tabs ── */}
      {doctors.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: "all", label: `الكل (${appointments.length})` },
            ...doctors.map((d) => ({
              id: d.id,
              label: `${d.name_ar ?? d.name} (${
                appointments.filter((a) => (a.tawd_staff_users as any)?.id === d.id).length
              })`,
            })),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedDoc(tab.id)}
              className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
              style={{
                background:
                  selectedDoc === tab.id
                    ? "rgba(255,255,255,0.09)"
                    : "rgba(255,255,255,0.03)",
                color: selectedDoc === tab.id ? "#ffffff" : "var(--text-4)",
                border: `1px solid ${
                  selectedDoc === tab.id
                    ? "rgba(255,255,255,0.16)"
                    : "rgba(255,255,255,0.05)"
                }`,
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── timeline cards ── */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center gap-4"
          style={{
            minHeight: 220,
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Calendar className="w-5 h-5" style={{ color: "var(--text-4)" }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-white text-sm">جدول اليوم فارغ</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>
              لا توجد مواعيد مجدولة
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((appt) => {
            const late    = isLate(appt);
            const s       = late ? LATE : (STATUS_MAP[appt.status] ?? STATUS_MAP.scheduled);
            const isHov   = hoveredId === appt.id;
            const isLoad  = loadingId === appt.id;
            const actions = NEXT_ACTIONS[appt.status] ?? [];
            const time    = new Date(appt.slot_time).toLocaleTimeString("ar-SA", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const patient = (appt.patients as any)?.name ?? "مريض";
            const service =
              (appt.services as any)?.name_ar ??
              (appt.services as any)?.name ??
              null;
            const doctor =
              (appt.tawd_staff_users as any)?.name_ar ??
              (appt.tawd_staff_users as any)?.name ??
              null;

            return (
              <div
                key={appt.id}
                className="relative rounded-xl overflow-hidden"
                style={{
                  border: `1px solid ${isHov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.055)"}`,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxShadow: isHov ? "0 4px 24px rgba(0,0,0,0.35)" : "none",
                }}
                onMouseEnter={() => setHoveredId(appt.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* status stripe on the reading edge */}
                <div
                  className="absolute top-0 bottom-0 end-0 w-[3px]"
                  style={{ background: s.bar }}
                />

                <div
                  className="flex items-stretch"
                  style={{
                    background: isHov ? s.bg : "rgba(255,255,255,0.018)",
                    transition: "background 0.15s",
                  }}
                >
                  {/* time */}
                  <div
                    className="w-[64px] flex flex-col items-center justify-center shrink-0 py-3"
                    style={{ borderInlineEnd: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <p className="text-[13px] font-bold ltr-nums text-white">
                      {time}
                    </p>
                    {late && (
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1 animate-pulse"
                        style={{ background: "#fbbf24" }}
                      />
                    )}
                  </div>

                  {/* info + hover actions */}
                  <div className="flex-1 py-2.5 px-3 pe-5 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-white truncate flex-1">
                        {patient}
                      </p>
                      <span
                        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5"
                        style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: s.color }}
                      >
                        <span className="w-1 h-1 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </div>
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: "var(--text-4)" }}
                    >
                      {service ?? "—"}
                      {doctor && ` · ${doctor}`}
                    </p>

                    {/* action buttons on hover */}
                    {isHov && actions.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {actions.map((action) => (
                          <button
                            key={action.status}
                            disabled={isLoad}
                            onClick={() => handleAction(appt.id, action.status)}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              color: action.color,
                              border: "1px solid rgba(255,255,255,0.1)",
                              opacity: isLoad ? 0.5 : 1,
                              transition: "opacity 0.1s",
                            }}
                          >
                            {isLoad ? "…" : action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
