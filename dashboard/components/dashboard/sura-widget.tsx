"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Bot, X, Inbox, Clock, ChevronLeft, Sparkles } from "lucide-react";

export type HitlItem = {
  id: string;
  ai_draft: string;
  ai_intent: string | null;
  confidence_score: number;
  status: string;
  created_at: string;
  patients: unknown;
};

export function SuraWidget({
  hitlItems,
  hitlCount,
}: {
  hitlItems: HitlItem[];
  hitlCount: number;
}) {
  const [open, setOpen] = useState(false);

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

      {/* slide panel — fixed on inline-end (right in LTR / left in RTL) */}
      <div
        className="fixed top-0 bottom-0 end-0 flex flex-col"
        style={{
          width: "min(340px, 100vw)",
          zIndex: 9999,
          background: "rgba(4,6,15,0.98)",
          borderInlineStart: "1px solid rgba(20,184,166,0.22)",
          boxShadow: "-24px 0 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* ── header ── */}
        <div
          className="flex items-center gap-3 px-4 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(20,184,166,0.28), rgba(13,148,136,0.18))",
              border: "1px solid rgba(20,184,166,0.28)",
            }}
          >
            <Bot className="w-4 h-4" style={{ color: "#14b8a6" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">سُرى</p>
            <p className="text-[11px]" style={{ color: "#334155" }}>
              المساعد الذكي للعيادة
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "#475569",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* HITL queue */}
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Inbox className="w-3.5 h-3.5" style={{ color: "#5dd9cb" }} />
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#334155" }}
              >
                طابور المراجعة
              </p>
              {hitlCount > 0 && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-full ltr-nums"
                  style={{
                    background: "rgba(94,217,203,0.12)",
                    color: "#5dd9cb",
                    border: "1px solid rgba(94,217,203,0.2)",
                  }}
                >
                  {hitlCount}
                </span>
              )}
            </div>

            {hitlItems.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(74,222,128,0.06)",
                    border: "1px solid rgba(74,222,128,0.1)",
                  }}
                >
                  <Inbox
                    className="w-4 h-4"
                    style={{ color: "rgba(74,222,128,0.4)" }}
                  />
                </div>
                <p className="text-xs font-semibold" style={{ color: "#4ADE80" }}>
                  الطابور فارغ
                </p>
                <p
                  className="text-[11px] text-center"
                  style={{ color: "#334155" }}
                >
                  لا توجد محادثات تحتاج مراجعة
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {hitlItems.slice(0, 8).map((item) => {
                  const patient =
                    (item.patients as any)?.name ?? "زائر غير مسجّل";
                  const ageMin = Math.max(
                    0,
                    Math.round(
                      (Date.now() - new Date(item.created_at).getTime()) /
                        60_000
                    )
                  );
                  const conf = Math.round(Number(item.confidence_score) * 100);
                  const confColor =
                    conf >= 70 ? "#4ADE80" : conf >= 40 ? "#5dd9cb" : "#F87171";

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
                        <p className="text-xs font-bold text-white truncate flex-1">
                          {patient}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <Clock
                            className="w-3 h-3"
                            style={{ color: "#5dd9cb", opacity: 0.5 }}
                          />
                          <span
                            className="text-[10px] ltr-nums"
                            style={{ color: "#134e4a" }}
                          >
                            {ageMin} د
                          </span>
                        </div>
                      </div>

                      {item.ai_intent && (
                        <p className="text-[11px] mb-1" style={{ color: "#38bdf8" }}>
                          {item.ai_intent}
                        </p>
                      )}

                      <p
                        className="text-[11px] line-clamp-2"
                        style={{ color: "#475569" }}
                      >
                        {item.ai_draft.substring(0, 90)}
                        {item.ai_draft.length > 90 ? "…" : ""}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-1 w-14 rounded-full overflow-hidden"
                            style={{ background: "rgba(255,255,255,0.07)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${conf}%`,
                                background: confColor,
                              }}
                            />
                          </div>
                          <span
                            className="text-[10px] ltr-nums"
                            style={{ color: confColor }}
                          >
                            {conf}%
                          </span>
                        </div>
                        <button
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                          style={{
                            background: "rgba(20,184,166,0.1)",
                            color: "#5dd9cb",
                            border: "1px solid rgba(20,184,166,0.18)",
                          }}
                        >
                          مراجعة
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── quick query ── */}
          <div className="px-4 pb-4 mt-4">
            <div
              className="pt-4 space-y-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "#334155" }}
                >
                  اسأل سُرى
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="مثال: ما إجمالي إيراد الأسبوع؟"
                  className="flex-1 rounded-xl px-3 py-2 text-xs text-white"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    outline: "none",
                  }}
                />
                <button
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
              </div>

              <p
                className="text-[10px] text-center"
                style={{ color: "#1E3A4C" }}
              >
                التحليل الذكي المباشر — قريباً
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      {/* floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm"
        style={{
          bottom: "1.5rem",
          insetInlineEnd: "1.5rem",
          zIndex: 9990,
          background: "linear-gradient(135deg, #0d9488, #0f766e)",
          color: "white",
          boxShadow: "0 8px 32px rgba(13,148,136,0.4)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 12px 40px rgba(13,148,136,0.55)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "0 8px 32px rgba(13,148,136,0.4)";
        }}
      >
        <Bot className="w-4 h-4" />
        سُرى
        {hitlCount > 0 && (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ltr-nums"
            style={{ background: "#5dd9cb", color: "#1C1917" }}
          >
            {hitlCount}
          </span>
        )}
      </button>

      {typeof window !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}
