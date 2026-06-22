"use client";

import { useState, useRef, useTransition } from "react";
import { MoreHorizontal, Check, CalendarClock, XCircle } from "lucide-react";
import { updateAppointmentStatus, rescheduleAppointment, cancelAppointment, type AppointmentStatus } from "@/app/actions/appointments";

const STATUS_OPTS: { value: AppointmentStatus; label: string }[] = [
  { value: "confirmed", label: "تأكيد" },
  { value: "checked_in", label: "تسجيل حضور" },
  { value: "in_progress", label: "بدء الفحص" },
  { value: "completed", label: "اكتمل" },
  { value: "no_show", label: "لم يحضر" },
];

type Pos = { left: number; top?: number; bottom?: number };
const MENU_W = 216;

export function AppointmentRowActions({ id, status, slotTime }: { id: string; status: string; slotTime: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "reschedule">("menu");
  const [pos, setPos] = useState<Pos | null>(null);
  const [pending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  const initial = slotTime ? new Date(slotTime) : new Date();
  const [date, setDate] = useState(initial.toISOString().split("T")[0]);
  const [time, setTime] = useState(initial.toTimeString().slice(0, 5));

  function toggle() {
    if (open) { close(); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const openUp = window.innerHeight - r.bottom < 320;
      // Align the menu's right edge to the button, then clamp inside the viewport.
      const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
      setPos({
        left,
        top: openUp ? undefined : Math.round(r.bottom + 6),
        bottom: openUp ? Math.round(window.innerHeight - r.top + 6) : undefined,
      });
    }
    setMode("menu");
    setOpen(true);
  }
  function close() { setOpen(false); setMode("menu"); }

  function change(s: AppointmentStatus) {
    startTransition(async () => { try { await updateAppointmentStatus(id, s); } finally { close(); } });
  }
  function reschedule() {
    startTransition(async () => { try { await rescheduleAppointment(id, `${date}T${time}:00`); } finally { close(); } });
  }
  function cancel() {
    if (!confirm("سيتم إلغاء الموعد (يبقى في السجل، لا حذف نهائي). متابعة؟")) return;
    startTransition(async () => { try { await cancelAppointment(id); } finally { close(); } });
  }

  return (
    <>
      <button ref={btnRef} onClick={toggle} disabled={pending}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }} title="إجراءات">
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={close} />
          <div
            className="panel py-1.5 animate-scale-in"
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: MENU_W, maxHeight: "70vh", overflowY: "auto", zIndex: 60, background: "rgba(12,18,28,0.99)" }}
          >
            {mode === "menu" ? (
              <>
                <p className="eyebrow px-3 py-1.5">تغيير الحالة</p>
                {STATUS_OPTS.filter((o) => o.value !== status).map((o) => (
                  <button key={o.value} onClick={() => change(o.value)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "var(--text-1)" }}>
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} /> {o.label}
                  </button>
                ))}
                <div className="my-1" style={{ borderTop: "1px solid var(--hairline)" }} />
                <button onClick={() => setMode("reschedule")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "var(--text-1)" }}>
                  <CalendarClock className="w-3.5 h-3.5" style={{ color: "var(--color-info)" }} /> إعادة جدولة
                </button>
                <button onClick={cancel}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "#fda4b4" }}>
                  <XCircle className="w-3.5 h-3.5" /> إلغاء الموعد
                </button>
              </>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <p className="eyebrow">موعد جديد</p>
                <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setMode("menu")} className="btn-ghost flex-1 h-9">رجوع</button>
                  <button onClick={reschedule} disabled={pending} className="btn-primary flex-1 h-9">{pending ? "..." : "حفظ"}</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
