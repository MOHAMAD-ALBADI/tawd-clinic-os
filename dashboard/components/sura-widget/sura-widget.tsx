"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Bot, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/tawd";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Record<Role, string> = {
  clinic_admin:   "مرحباً! أنا سُرى 🏔️ أطّلع على كل بيانات عيادتك لحظياً — اسألني عن الإيرادات، المواعيد، المرضى، أو أي تفصيل.",
  doctor:         "مرحباً دكتور! أنا سُرى 🏔️ اسألني عن جدولك، مرضاك، أو مواعيدك القادمة.",
  receptionist:   "مرحباً! أنا سُرى 🏔️ اسألني عن مواعيد اليوم، قائمة الانتظار، أو أي مريض.",
  accountant:     "مرحباً! أنا سُرى 🏔️ اسألني عن الفواتير، الإيرادات، والمبالغ المعلقة.",
  platform_admin: "مرحباً! أنا سُرى 🏔️ مساعدتك في إدارة منصة طود شرف لي.",
};

const QUICK: Record<Role, string[]> = {
  clinic_admin:   ["كم إيراد هذا الشهر؟", "مين أكثر مريض عنده نقاط ولاء؟", "وش أكثر خدمة مطلوبة؟"],
  doctor:         ["كم موعد عندي اليوم؟", "مين مرضاي بكرة؟"],
  receptionist:   ["كم موعد اليوم؟", "مين في قائمة الانتظار؟"],
  accountant:     ["كم الفواتير غير المدفوعة؟", "كم إيراد هذا الشهر؟"],
  platform_admin: ["كم عدد المرضى الكلي؟"],
};

export function SuraWidget({ userRole }: { userRole: Role }) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME[userRole] },
  ]);
  const [input, setInput]     = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || streaming) return;

    const msgsBefore = [...messages, { role: "user" as const, content: text }];
    setMessages((p) => [...p, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/sura/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          question: text,
          history: msgsBefore.slice(-7, -1).map((m) => ({
            role: m.role === "user" ? "user" : "sura",
            text: m.content,
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      const answer = j.answer ?? j.error ?? "تعذّر التحليل الآن — حاول مرة أخرى.";
      setMessages((p) => {
        const copy = [...p];
        copy[copy.length - 1] = { role: "assistant", content: String(answer) };
        return copy;
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((p) => {
        const copy = [...p];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "عذراً، حدث خطأ في الاتصال. حاول مجدداً.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 start-5 w-80 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          style={{
            background: "rgba(14,14,16,0.98)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(28px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(20,184,166,0.08)",
            animation: "slideUp 0.22s ease-out",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(20,184,166,0.2)", border: "1px solid rgba(20,184,166,0.3)" }}
              >
                <Bot className="w-4 h-4" style={{ color: "#5dd9cb" }} />
              </div>
              <div>
                <p className="text-white text-[13px] font-bold leading-none">سُرى</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#2dd4bf", animation: "pulse 2s infinite" }}
                  />
                  <span className="text-[10px]" style={{ color: "#5dd9cb" }}>
                    {streaming ? "تحلّل بياناتك…" : "متصلة ببيانات عيادتك"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
              style={{ color: "rgba(148,163,184,0.5)" }}
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-72">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}
              >
                <div
                  className={cn(
                    "max-w-[85%] px-3.5 py-2 text-[13px] leading-relaxed",
                    m.role === "user" ? "rounded-2xl rounded-ss-sm" : "rounded-2xl rounded-se-sm"
                  )}
                  style={
                    m.role === "user"
                      ? { background: "rgba(20,184,166,0.25)", color: "#E2E8F0", border: "1px solid rgba(20,184,166,0.2)" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(226,232,240,0.9)" }
                  }
                >
                  {m.content || (streaming && i === messages.length - 1
                    ? <span style={{ color: "rgba(148,163,184,0.4)", animation: "pulse 1.2s infinite" }}>...</span>
                    : null)}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Quick questions — before the conversation starts */}
          {messages.length <= 1 && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5">
              {(QUICK[userRole] ?? []).map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={streaming}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-colors hover:bg-white/10"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "rgba(226,232,240,0.75)",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            className="p-3 flex gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
              placeholder="اسأل سُرى..."
              disabled={streaming}
              className="flex-1 text-white text-[13px] rounded-xl px-3 py-2 outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(226,232,240,0.95)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.4)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
            />
            <button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-35"
              style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* FAB — premium pill, bottom-left over content (clear of the sidebar) */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 start-5 z-50 flex items-center gap-2.5 transition-all duration-200 active:scale-95 group"
        style={{
          height: "52px",
          paddingInline: open ? "0" : "18px 16px",
          width: open ? "52px" : "auto",
          justifyContent: "center",
          borderRadius: "999px",
          background: open
            ? "rgba(15,118,110,0.92)"
            : "linear-gradient(135deg, #14b8a6 0%, #0d9488 60%, #0f766e 100%)",
          border: "1px solid rgba(45,212,191,0.45)",
          boxShadow: "0 8px 32px rgba(20,184,166,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(20,184,166,0.5), inset 0 1px 0 rgba(255,255,255,0.22)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(20,184,166,0.35), inset 0 1px 0 rgba(255,255,255,0.18)"; e.currentTarget.style.transform = "translateY(0)"; }}
        aria-label={open ? "إغلاق سُرى" : "فتح المساعد سُرى"}
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <>
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full shrink-0"
              style={{ background: "rgba(255,255,255,0.16)" }}>
              <Sparkles className="w-4 h-4 text-white" />
              <span className="absolute -top-0.5 -end-0.5 w-2 h-2 rounded-full"
                style={{ background: "#cbf6ef", boxShadow: "0 0 6px #5dd9cb", animation: "pulse 2s infinite" }} />
            </span>
            <span className="text-white font-bold text-[14px] leading-none pe-1" style={{ letterSpacing: "0.01em" }}>
              سُرى
            </span>
          </>
        )}
      </button>
    </>
  );
}
