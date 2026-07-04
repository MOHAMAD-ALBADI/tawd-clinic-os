"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Armchair, BellRing, DoorOpen, CheckCheck, UserX, MessageCircle } from "lucide-react";
import { setQueueStatus } from "@/app/actions/reception";

export type QueueEntry = {
  id: string;
  position: number;
  status: string; // waiting | called | in_room
  patientName: string;
  doctorName: string | null;
  serviceName: string | null;
  waitingSince: string; // formatted
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  waiting: { label: "ينتظر",       color: "#a1a1aa" },
  called:  { label: "تمت مناداته", color: "#2dd4bf" },
  in_room: { label: "في العيادة",  color: "#5dd9cb" },
};

export function WaitingRoom({ entries }: { entries: QueueEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waMsg, setWaMsg] = useState<string | null>(null);

  function move(id: string, status: "called" | "in_room" | "done" | "left") {
    setBusyId(id);
    start(async () => {
      try {
        const r = await setQueueStatus(id, status);
        if (status === "called") {
          setWaMsg(r.whatsappSent ? "أُرسلت رسالة «دورك الآن» واتساب ✓" : "تمت المناداة (تعذّر إرسال واتساب)");
          setTimeout(() => setWaMsg(null), 4000);
        }
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "حدث خطأ");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="panel flex flex-col" style={{ padding: "1.25rem", minHeight: 320 }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <Armchair className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          غرفة الانتظار
        </h3>
        <span className="font-bold ltr-nums text-lg text-white">{entries.length}</span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-3)" }}>
        المناداة تُرسل «دورك الآن» واتساب للمريض تلقائياً
      </p>

      {waMsg && (
        <div className="badge badge-brand mb-3 self-start">
          <MessageCircle className="w-3 h-3" />
          {waMsg}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
          <Armchair className="w-8 h-8" style={{ color: "var(--text-4)" }} />
          <p className="text-xs" style={{ color: "var(--text-3)" }}>غرفة الانتظار فارغة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((q) => {
            const meta = STATUS_META[q.status] ?? STATUS_META.waiting;
            const busy = pending && busyId === q.id;
            return (
              <div
                key={q.id}
                className="rounded-xl p-3"
                style={{
                  background: q.status === "called" ? "rgba(45,212,191,0.05)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${q.status === "called" ? "rgba(45,212,191,0.2)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ltr-nums shrink-0 text-white"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {q.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{q.patientName}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
                      {q.serviceName ?? "—"}{q.doctorName ? ` · ${q.doctorName}` : ""} · وصل {q.waitingSince}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                    style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: meta.color }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {q.status === "waiting" && (
                    <button onClick={() => move(q.id, "called")} disabled={busy}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg disabled:opacity-50"
                      style={{ background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}>
                      <BellRing className="w-3 h-3" /> {busy ? "…" : "مناداة"}
                    </button>
                  )}
                  {(q.status === "waiting" || q.status === "called") && (
                    <button onClick={() => move(q.id, "in_room")} disabled={busy}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }}>
                      <DoorOpen className="w-3 h-3" /> دخل
                    </button>
                  )}
                  {q.status === "in_room" && (
                    <button onClick={() => move(q.id, "done")} disabled={busy}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#5dd9cb" }}>
                      <CheckCheck className="w-3 h-3" /> انتهى
                    </button>
                  )}
                  <button onClick={() => move(q.id, "left")} disabled={busy}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg disabled:opacity-50"
                    style={{ color: "var(--text-4)" }}>
                    <UserX className="w-3 h-3" /> غادر
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
