"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Edit3, X, Save, CheckCircle2 } from "lucide-react";
import { updateWorkingHours } from "@/app/actions/clinic-settings";

const DAYS: { key: string; label: string }[] = [
  { key: "sun", label: "الأحد" },
  { key: "mon", label: "الاثنين" },
  { key: "tue", label: "الثلاثاء" },
  { key: "wed", label: "الأربعاء" },
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
  { key: "sat", label: "السبت" },
];

type DayHours = { open: string; close: string } | null;
type HoursMap = Record<string, DayHours>;

export function WorkingHoursForm({ hours: initial }: { hours: HoursMap }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<HoursMap>(initial);

  function toggleDay(key: string) {
    setHours((h) => ({
      ...h,
      [key]: h[key] ? null : { open: "08:00", close: "22:00" },
    }));
  }

  function setTime(key: string, field: "open" | "close", value: string) {
    setHours((h) => ({
      ...h,
      [key]: { ...(h[key] ?? { open: "08:00", close: "22:00" }), [field]: value },
    }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateWorkingHours(hours);
        router.refresh();
        setDone(true);
        setEditing(false);
        setTimeout(() => setDone(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  const timeInput = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(226,232,240,0.9)",
    borderRadius: "0.5rem",
    padding: "0.35rem 0.6rem",
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <Clock className="w-4 h-4" style={{ color: "#5dd9cb" }} />
          </div>
          <div>
            <h3 className="font-bold text-white">ساعات العمل</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>تحديد أوقات استقبال المرضى لكل يوم</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {done ? (
            <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl" style={{ color: "#34D399", background: "rgba(16,185,129,0.1)" }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> تم الحفظ
            </span>
          ) : editing ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setHours(initial); setError(null); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.7)" }}
              >
                <X className="w-3.5 h-3.5" /> إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={pending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "white" }}
              >
                <Save className="w-3.5 h-3.5" />
                {pending ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
              style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", color: "#5dd9cb" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.1)"; }}
            >
              <Edit3 className="w-3.5 h-3.5" /> تعديل
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm py-2.5 px-4 rounded-xl mb-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
          {error}
        </div>
      )}

      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = hours[key];
          const isOpen = day !== null && day !== undefined;

          return (
            <div
              key={key}
              className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{
                background: isOpen ? "rgba(20,184,166,0.05)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isOpen ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.05)"}`,
              }}
            >
              {/* Day toggle */}
              {editing ? (
                <button
                  onClick={() => toggleDay(key)}
                  className="relative w-10 h-5 rounded-full transition-all shrink-0"
                  style={{ background: isOpen ? "#14b8a6" : "rgba(255,255,255,0.1)" }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: isOpen ? "calc(100% - 1.125rem)" : "2px" }}
                  />
                </button>
              ) : (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: isOpen ? "#5dd9cb" : "rgba(148,163,184,0.25)" }}
                />
              )}

              {/* Day name */}
              <span className="w-16 text-sm font-semibold shrink-0" style={{ color: isOpen ? "white" : "rgba(148,163,184,0.4)" }}>
                {label}
              </span>

              {/* Hours */}
              {isOpen ? (
                editing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={day?.open ?? "08:00"}
                      onChange={(e) => setTime(key, "open", e.target.value)}
                      style={timeInput}
                    />
                    <span className="text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>—</span>
                    <input
                      type="time"
                      value={day?.close ?? "22:00"}
                      onChange={(e) => setTime(key, "close", e.target.value)}
                      style={timeInput}
                    />
                  </div>
                ) : (
                  <span className="text-sm ltr-nums" style={{ color: "rgba(148,163,184,0.7)" }}>
                    {day?.open} — {day?.close}
                  </span>
                )
              ) : (
                <span className="text-sm" style={{ color: "rgba(148,163,184,0.3)" }}>مغلق</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
