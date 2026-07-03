"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Bot, X, Inbox, Clock } from "lucide-react";

export type HitlItem = {
  id: string;
  ai_draft: string;
  ai_intent: string | null;
  confidence_score: number;
  status: string;
  created_at: string;
  patients: unknown;
};

/** HITL review queue. The FAB appears only when something needs review —
    the conversational assistant lives in the global Sura widget. */
export function SuraWidget({
  hitlItems,
  hitlCount,
}: {
  hitlItems: HitlItem[];
  hitlCount: number;
}) {
  const [open, setOpen] = useState(false);

  if (hitlCount === 0 && !open) return null;

  const ageLabel = (iso: string) => {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (min < 60) return `${min} د`;
    if (min < 1440) return `${Math.round(min / 60)} س`;
    return `${Math.round(min / 1440)} يوم`;
  };

  const panel = open ? (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 9998,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(3px)",
        }}
        onClick={() => setOpen(false)}
      />

      {/* slide panel */}
      <div
        className="fixed top-0 bottom-0 end-0 flex flex-col"
        style={{
          width: "min(360px, 100vw)",
          zIndex: 9999,
          background: "rgba(13,13,15,0.98)",
          borderInlineStart: "1px solid rgba(20,184,166,0.22)",
          boxShadow: "-24px 0 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* header */}
        <div
          className="flex items-center gap-3 px-4 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(20,184,166,0.28), rgba(13,148,136,0.18))",
              border: "1px solid rgba(20,184,166,0.28)",
            }}
          >
            <Inbox className="w-4 h-4" style={{ color: "#2dd4bf" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">طابور مراجعة سُرى</p>
            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
              محادثات تحتاج قراراً بشرياً
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-3)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {hitlItems.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "rgba(45,212,191,0.06)",
                  border: "1px solid rgba(45,212,191,0.1)",
                }}
              >
                <Inbox className="w-4 h-4" style={{ color: "rgba(45,212,191,0.45)" }} />
              </div>
              <p className="text-xs font-semibold" style={{ color: "#5dd9cb" }}>
                الطابور فارغ
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {hitlItems.slice(0, 10).map((item) => {
                const patient = (item.patients as any)?.name ?? "زائر غير مسجّل";
                const conf = Math.round(Number(item.confidence_score) * 100);
                const confColor =
                  conf >= 70 ? "#5dd9cb" : conf >= 40 ? "rgba(45,212,191,0.6)" : "#fda4b4";

                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-3"
                    style={{
                      background: "rgba(94,217,203,0.04)",
                      border: "1px solid rgba(94,217,203,0.1)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-xs font-bold text-white truncate flex-1">{patient}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" style={{ color: "#5dd9cb", opacity: 0.5 }} />
                        <span className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>
                          {ageLabel(item.created_at)}
                        </span>
                      </div>
                    </div>

                    {item.ai_intent && (
                      <p className="text-[11px] mb-1" style={{ color: "var(--text-2)" }}>
                        {item.ai_intent}
                      </p>
                    )}

                    <p className="text-[11px] line-clamp-2" style={{ color: "var(--text-3)" }}>
                      {item.ai_draft.substring(0, 90)}
                      {item.ai_draft.length > 90 ? "…" : ""}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2">
                      <div
                        className="h-1 w-14 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.07)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${conf}%`, background: confColor }}
                        />
                      </div>
                      <span className="text-[10px] ltr-nums" style={{ color: confColor }}>
                        {conf}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      {/* floating trigger — only when review is needed */}
      <button
        onClick={() => setOpen(true)}
        className="fixed flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm"
        style={{
          bottom: "1.5rem",
          insetInlineEnd: "1.5rem",
          zIndex: 9990,
          background: "rgba(19,19,21,0.95)",
          border: "1px solid rgba(45,212,191,0.35)",
          color: "#5dd9cb",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <Bot className="w-4 h-4" />
        مراجعة سُرى
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ltr-nums"
          style={{ background: "#5dd9cb", color: "#0a0a0b" }}
        >
          {hitlCount}
        </span>
      </button>

      {typeof window !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}
