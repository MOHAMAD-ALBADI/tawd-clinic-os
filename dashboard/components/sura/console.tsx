"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Send, Paperclip, X, FileText, Loader2, Sparkles, Trash2, FileDown,
} from "lucide-react";
import { RichText } from "@/components/sura-widget/rich-text";

/* Sura's own room, rather than a bubble in the corner.
 *
 * The floating widget is right for "what was yesterday's revenue" while
 * you are doing something else. It is wrong for the work this page is
 * for: reading a document she has been handed, drafting a treatment
 * plan, booking across a week. Those need width, they need the
 * conversation to persist while you go and check something, and they
 * need somewhere to put a file.
 *
 * Attachments are held in memory and sent with the question. They are
 * never uploaded to our storage — a photograph of somebody's medical
 * report should not acquire a permanent home because they wanted a
 * question answered about it.
 */

type Attach = { name: string; mime: string; data: string; preview?: string };
type Msg = { role: "user" | "assistant"; content: string; files?: { name: string; preview?: string }[] };

const MAX_FILES = 2;
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/heic,application/pdf";

const STARTERS = [
  "كم دخلنا هذا الشهر ووش نسبة التحصيل؟",
  "من المرضى الي عندهم خطط علاج ما كملوها؟",
  "أي طبيب عنده أكثر مواعيد بكرة؟",
  "وش المواعيد الي انلغت هذا الأسبوع؟",
];

export function SuraConsole() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Attach[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setErr(null);
    const room = MAX_FILES - files.length;
    const picked = Array.from(list).slice(0, Math.max(0, room));
    if (picked.length < list.length) setErr(`ملفان كحدّ أقصى`);

    for (const f of picked) {
      if (f.size > MAX_BYTES) {
        setErr(`«${f.name}» أكبر من ٤ ميغابايت`);
        continue;
      }
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      setFiles((p) => [
        ...p,
        {
          name: f.name,
          mime: f.type,
          data,
          preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        },
      ]);
    }
  }

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if ((!text && files.length === 0) || busy) return;

    const sent = files;
    const shown = sent.map((f) => ({ name: f.name, preview: f.preview }));
    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.content }));

    setInput("");
    setFiles([]);
    setErr(null);
    setMessages((p) => [
      ...p,
      { role: "user", content: text || "(مرفق)", files: shown },
      { role: "assistant", content: "" },
    ]);
    setBusy(true);

    try {
      const res = await fetch("/api/sura/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text || "اقرأي المرفق ولخّصي لي المهمّ منه.",
          history,
          files: sent.map((f) => ({ name: f.name, mime: f.mime, data: f.data })),
        }),
      });
      const j = await res.json();
      setMessages((p) => {
        const copy = [...p];
        copy[copy.length - 1] = {
          role: "assistant",
          content: String(j.answer ?? j.error ?? "تعذّر التحليل — حاول مرّة أخرى."),
        };
        return copy;
      });
    } catch {
      setMessages((p) => {
        const copy = [...p];
        copy[copy.length - 1] = { role: "assistant", content: "تعذّر الاتصال — حاول مرّة أخرى." };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel flex h-[calc(100vh-13rem)] min-h-[520px] flex-col overflow-hidden">
      {/* ── header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
        <span
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.14)", border: "1px solid rgb(var(--accent-1-rgb) / 0.3)" }}
        >
          <Sparkles className="size-4" style={{ color: "var(--accent-1)" }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">اسأل سُرى</p>
          <p className="text-[11px] text-[var(--text-3)]">
            متّصلة ببيانات عيادتك · تنفّذ الحجز والتأجيل والخطط · تقرأ الصور وملفات PDF
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 text-[11px] text-[var(--text-3)] transition-colors hover:text-white"
          >
            <Trash2 className="size-3" />
            محادثة جديدة
          </button>
        )}
      </div>

      {/* ── thread ── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg py-8 text-center">
            <p className="text-sm text-[var(--text-2)]">
              اسألني عن أي رقم في عيادتك، أو اطلب مني أن أحجز أو أؤجّل أو أكتب
              خطة علاج. وتقدر ترفق صورة أو ملف PDF وأقرأه لك.
            </p>
            <div className="mt-5 grid gap-2 text-start">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-xl border border-[var(--hairline)] px-3.5 py-2.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-white/20 hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
            <div
              className="max-w-[min(46rem,88%)] rounded-2xl px-4 py-2.5 text-[13.5px]"
              style={
                m.role === "user"
                  ? { background: "rgb(var(--accent-2-rgb) / 0.22)", border: "1px solid rgb(var(--accent-2-rgb) / 0.28)", color: "#E2E8F0" }
                  : { background: "rgba(255,255,255,0.05)", color: "rgba(226,232,240,0.94)" }
              }
            >
              {m.files && m.files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.files.map((f) =>
                    f.preview ? (
                      <Image
                        key={f.name}
                        src={f.preview}
                        alt={f.name}
                        width={112}
                        height={112}
                        unoptimized
                        className="h-28 w-auto rounded-lg border border-white/10 object-cover"
                      />
                    ) : (
                      <span
                        key={f.name}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                      >
                        <FileText className="size-3" />
                        {f.name}
                      </span>
                    ),
                  )}
                </div>
              )}

              {m.content
                ? m.role === "assistant"
                  ? <RichText text={m.content} />
                  : m.content
                : busy && i === messages.length - 1
                  ? <Loader2 className="size-4 animate-spin" style={{ color: "var(--accent-1)" }} />
                  : null}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* ── staged attachments ── */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-[var(--hairline)] px-4 py-2.5">
          {files.map((f, i) => (
            <span
              key={f.name + i}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-white/5 px-2 py-1.5 text-[11px]"
            >
              {f.preview ? (
                <Image src={f.preview} alt="" width={24} height={24} unoptimized className="size-6 rounded object-cover" />
              ) : (
                <FileText className="size-3.5" style={{ color: "var(--accent-1)" }} />
              )}
              <span className="max-w-[14rem] truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="إزالة">
                <X className="size-3 text-[var(--text-3)]" />
              </button>
            </span>
          ))}
        </div>
      )}

      {err && <p className="px-4 pb-1 text-[11px] text-red-400">{err}</p>}

      {/* ── composer ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-end gap-2 border-t border-[var(--hairline)] px-4 py-3"
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={files.length >= MAX_FILES}
          title="أرفق صورة أو PDF"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hairline)] text-[var(--text-3)] transition-colors hover:text-white disabled:opacity-40"
        >
          <Paperclip className="size-4" />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            /* Enter sends, Shift+Enter breaks the line — the convention
               every messaging app on the user's phone already uses. */
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }}
          rows={1}
          placeholder="اسأل، أو اطلب تنفيذ شيء…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[13.5px] text-white outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
        />

        <button
          type="submit"
          disabled={busy || (!input.trim() && files.length === 0)}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent-2)" }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}

/** Link out to the printable monthly document. */
export function ReportLink() {
  return (
    <a
      href="/clinic-admin/sura-agent/report"
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] px-3.5 py-2 text-[13px] text-[var(--text-2)] transition-colors hover:text-white"
    >
      <FileDown className="size-4" />
      تقرير الشهر (PDF)
    </a>
  );
}
