"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock } from "lucide-react";
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

const STATUS_MAP: Record<string, { label: string; color: string; bar: string; bg: string }> = {
  scheduled:   { label: "مجدول",  color: "#818CF8", bar: "#6366F1", bg: "rgba(99,102,241,0.07)"  },
  confirmed:   { label: "مؤكد",   color: "#C4B5FD", bar: "#8B5CF6", bg: "rgba(139,92,246,0.07)" },
  checked_in:  { label: "حضر",    color: "#5dd9cb", bar: "#14b8a6", bg: "rgba(20,184,166,0.07)"  },
  in_progress: { label: "جارٍ",   color: "#38bdf8", bar: "#0ea5e9", bg: "rgba(56,189,248,0.08)"  },
  completed:   { label: "مكتمل",  color: "#4ADE80", bar: "#22C55E", bg: "rgba(34,197,94,0.06)"   },
  cancelled:   { label: "ملغي",   color: "#6B7280", bar: "#4B5563", bg: "rgba(75,85,99,0.04)"    },
  no_show:     { label: "غياب",   color: "#F87171", bar: "#EF4444", bg: "rgba(239,68,68,0.06)"   },
};

const LATE = { label: "تأخّر", color: "#38bdf8", bar: "#fbbf24", bg: "rgba(251,191,36,0.08)" };

const NEXT_ACTIONS: Record<string, Array<{ label: string; status: string; color: string }>> = {
  scheduled: [
    { label: "سجّل حضوره", status: "checked_in",  color: "#5dd9cb" },
    { label: "تأكيد",       status: "confirmed",   color: "#C4B5FD" },
    { label: "إلغاء",       status: "cancelled",   color: "#6B7280" },
    { label: "غياب",        status: "no_show",     color: "#F87171" },
  ],
  confirmed: [
    { label: "سجّل حضوره", status: "checked_in",  color: "#5dd9cb" },
    { label: "إلغاء",       status: "cancelled",   color: "#6B7280" },
    { label: "غياب",        status: "no_show",     color: "#F87171" },
  ],
  checked_in: [
    { label: "ابدأ الجلسة", status: "in_progress", color: "#38bdf8" },
    { label: "إلغاء",       status: "cancelled",   color: "#6B7280" },
  ],
  in_progress: [
    { label: "اكتمل",       status: "completed",   color: "#4ADE80" },
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
      {/* ── header ── */}
      <div className="flex items-center justify-between">
        <h2
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "#334155" }}
        >
          جدول اليوم الحي
        </h2>
        <a
          href="/clinic-admin/appointments"
          className="text-[11px] font-semibold"
          style={{ color: "#14b8a6" }}
        >
          عرض الكل ‹
        </a>
      </div>

      {/* ── status pills ── */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "انتظار", value: pending,    color: "#818CF8" },
          { label: "جارٍ",   value: inProgress, color: "#38bdf8" },
          { label: "مكتمل",  value: completed,  color: "#4ADE80" },
          ...(lateCount > 0
            ? [{ label: "تأخّر", value: lateCount, color: "#38bdf8" }]
            : []),
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
            style={{ background: `${s.color}10`, border: `1px solid ${s.color}22` }}
          >
            <span className="font-black ltr-nums" style={{ color: s.color }}>
              {s.value}
            </span>
            <span style={{ color: s.value > 0 ? s.color : "#334155" }}>{s.label}</span>
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
                    ? "rgba(20,184,166,0.12)"
                    : "rgba(255,255,255,0.03)",
                color: selectedDoc === tab.id ? "#5dd9cb" : "#475569",
                border: `1px solid ${
                  selectedDoc === tab.id
                    ? "rgba(20,184,166,0.22)"
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
              background: "rgba(20,184,166,0.07)",
              border: "1px solid rgba(20,184,166,0.12)",
            }}
          >
            <Calendar className="w-5 h-5" style={{ color: "rgba(20,184,166,0.35)" }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-white text-sm">جدول اليوم فارغ</p>
            <p className="text-xs mt-1" style={{ color: "#334155" }}>
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
                  border: `1px solid ${isHov ? s.bar + "42" : "rgba(255,255,255,0.055)"}`,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxShadow: isHov ? `0 4px 24px ${s.bar}14` : "none",
                }}
                onMouseEnter={() => setHoveredId(appt.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* status stripe on the inline-end (right in LTR, left in RTL) */}
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
                    className="w-[60px] flex flex-col items-center justify-center shrink-0 py-3"
                    style={{ borderInlineEnd: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <p
                      className="text-[13px] font-black ltr-nums"
                      style={{ color: s.color }}
                    >
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
                        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${s.bar}1A`, color: s.color }}
                      >
                        {s.label}
                      </span>
                    </div>
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: "#475569" }}
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
                              background: `${action.color}14`,
                              color: action.color,
                              border: `1px solid ${action.color}2A`,
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
