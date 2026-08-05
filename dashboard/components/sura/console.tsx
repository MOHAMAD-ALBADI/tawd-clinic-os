"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Sparkles, FileText, FileDown, Loader2, Trash2, Plus, History,
  RotateCw, Copy, Check, AlertTriangle, MessageSquare, ArrowDown,
} from "lucide-react";
import { RichText } from "@/components/sura-widget/rich-text";
import { Composer, type StagedFile } from "./composer";
import type { SuraFailure } from "@/lib/sura/types";

/* Sura's room.
 *
 * Four things a chat box is not finished without, and none of which the
 * first version had: the thread survives a refresh, a generation can be
 * stopped, a failure says which failure it was and offers the matching
 * way out, and the interface admits what it is doing while it does it.
 *
 * The last one matters more than it sounds. A model that queries the
 * database, runs an action and then writes prose takes ten seconds and
 * used to show a spinner for all of it, which reads as a hang. Saying
 * "أقرأ بيانات العيادة" is the difference between waiting and worrying.
 */

type Doc = { url: string; label: string };
type Msg = {
  role: "user" | "assistant";
  content: string;
  files?: { name: string; preview?: string }[];
  doc?: Doc;
  failure?: SuraFailure;
  retryable?: boolean;
};
type Head = { id: string; title: string; updated_at: string };

const STARTERS = [
  "كم دخلنا هذا الشهر ووش نسبة التحصيل؟",
  "من المرضى الي عندهم خطط علاج ما كملوها؟",
  "قارني مواعيد هذا الأسبوع بالأسبوع الي قبله",
  "أصدري تقرير هذا الشهر",
];

/* What it is plausibly doing, said in order. Not a fake progress bar —
   these are the real phases of the loop, and the timings are what it
   actually takes. */
const PHASES = ["أفكّر…", "أقرأ بيانات العيادة…", "أرتّب الجواب…"];

export function SuraConsole() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [history, setHistory] = useState<Head[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastAsk = useRef<{ text: string; files: StagedFile[] } | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  /* Scrolling used to be scrollIntoView on an anchor div, which moves the
     nearest scrollable ancestor — sometimes the page, not the thread, so
     the whole dashboard lurched. And it fired on every message, which
     yanked you back to the newest answer the moment you scrolled up to
     read an older one.

     Now the thread scrolls itself, and only when you were already at the
     bottom. Scroll up and it leaves you there, with a button to come
     back. */
  const onScroll = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  }, []);

  const toBottom = useCallback((smooth = true) => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (atBottom) toBottom();
  }, [messages, busy, atBottom, toBottom]);

  /* The phase resets where the work starts, not in an effect reacting to
     it. Writing state synchronously inside an effect schedules a second
     render for something the event that caused it could have set once. */
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 2600);
    return () => clearInterval(t);
  }, [busy]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/sura/conversations", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setHistory((j.conversations ?? []) as Head[]);
    } catch { /* the list is a convenience, not the product */ }
  }, []);

  /* Once, on mount. loadHistory is stable, but depending on it makes the
     effect look reactive when it is not. */
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    void loadHistory();
  }, [loadHistory]);

  async function openConversation(id: string) {
    setShowHistory(false);
    setLoadingConv(true);
    setErr(null);
    try {
      const r = await fetch(`/api/sura/conversations?id=${id}`, { cache: "no-store" });
      if (!r.ok) { setErr("تعذّر فتح المحادثة"); return; }
      const j = await r.json();
      type Turn = { role: "user" | "assistant"; content: string; doc: Doc | null; files: { name: string }[] };
      setMessages(((j.turns ?? []) as Turn[]).map((t) => ({
        role: t.role,
        content: t.content,
        doc: t.doc ?? undefined,
        files: t.files?.length ? t.files.map((f) => ({ name: f.name })) : undefined,
      })));
      setConvId(id);
    } catch {
      setErr("تعذّر فتح المحادثة");
    } finally {
      setLoadingConv(false);
    }
  }

  async function removeConversation(id: string) {
    try {
      await fetch(`/api/sura/conversations?id=${id}`, { method: "DELETE" });
      setHistory((p) => p.filter((c) => c.id !== id));
      if (convId === id) { setConvId(null); setMessages([]); }
    } catch { /* leave it in the list; the next load corrects it */ }
  }

  function reset() {
    abortRef.current?.abort();
    setConvId(null);
    setMessages([]);
    setInput("");
    setFiles([]);
    setErr(null);
  }

  /* Looks for a document produced after the request started.
   *
   * Polled rather than asked once, because the killed function may have
   * been mid-write when the browser gave up — a few seconds of patience
   * here is the difference between recovering a report and asking the
   * owner to sit through building it a second time. */
  const rescueDocument = useCallback(async (since: string) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const r = await fetch(`/api/sura/documents?since=${encodeURIComponent(since)}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j.doc?.url) return j.doc as { url: string; label: string };
        }
      } catch { /* the network is why we are here — keep trying */ }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return null;
  }, []);

  const send = useCallback(async (preset?: string, replay?: { text: string; files: StagedFile[] }) => {
    const text = replay?.text ?? (preset ?? input).trim();
    const sent = replay?.files ?? files;
    if ((!text && sent.length === 0) || busy) return;

    lastAsk.current = { text, files: sent };
    const shown = sent.map((f) => ({ name: f.name, preview: f.preview }));
    /* The server keeps twenty turns; sending six meant it could never
       have them. A working thread is long — ask, read, correct, ask
       again — and the fourth question was already talking to someone who
       had forgotten the first. */
    const priorTurns = messages.filter((m) => !m.failure && m.content.trim()).slice(-20);

    if (!replay) {
      setInput("");
      setFiles([]);
      setMessages((p) => [...p, { role: "user", content: text || "(مرفق)", files: shown }, { role: "assistant", content: "" }]);
    } else {
      /* A retry replaces the failed answer rather than stacking another
         attempt underneath it. */
      setMessages((p) => [...p.slice(0, -1), { role: "assistant", content: "" }]);
    }
    setErr(null);
    setPhase(0);
    setBusy(true);
    /* You just spoke, so you want to see it — even if you were reading
       something further up a second ago. */
    setAtBottom(true);

    const ac = new AbortController();
    abortRef.current = ac;

    /* The platform stops a function at five minutes and the browser has
       no opinion about it, so a killed run left this spinning forever
       over a report that had already been written. Give up just before
       the platform does, then go looking for the work. */
    const startedAt = new Date().toISOString();
    const giveUp = setTimeout(() => ac.abort("deadline"), 290_000);

    try {
      const res = await fetch("/api/sura/ask", {
        method: "POST",
        signal: ac.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text || "اقرأي المرفق ولخّصي لي المهمّ منه.",
          conv_id: convId,
          history: priorTurns.map((m) => ({ role: m.role, text: m.content })),
          files: sent.map((f) => ({ name: f.name, mime: f.mime, data: f.data })),
        }),
      });

      if (!res.ok) {
        setMessages((p) => [...p.slice(0, -1), {
          role: "assistant",
          content: res.status === 401 ? "انتهت الجلسة — سجّل الدخول من جديد." : "تعذّر الوصول للخدمة.",
          failure: "network", retryable: res.status !== 401,
        }]);
        return;
      }

      const j = await res.json();
      if (j.conv_id && j.conv_id !== convId) { setConvId(j.conv_id); void loadHistory(); }

      setMessages((p) => [...p.slice(0, -1), {
        role: "assistant",
        content: String(j.answer ?? "تعذّر التحليل."),
        doc: j.doc?.url ? j.doc : undefined,
        failure: j.failure as SuraFailure | undefined,
        retryable: j.retryable !== false && Boolean(j.failure),
      }]);
    } catch (e) {
      const aborted = (e as Error)?.name === "AbortError";
      const byUser = aborted && ac.signal.reason !== "deadline";

      /* Ran out of time rather than out of work. The document is written
         to the database before the answer is composed, so it can still
         be there — and handing back the report beats handing back an
         apology for a report that exists. */
      const rescued = aborted && !byUser ? await rescueDocument(startedAt) : null;

      setMessages((p) => [...p.slice(0, -1), {
        role: "assistant",
        content: byUser
          ? "أوقفتَ الردّ."
          : rescued
            ? "الطلب تجاوز مهلة الاتصال، لكن المستند اكتمل. هذا هو."
            : aborted
              ? "الطلب استغرق وقتاً أطول من المسموح. جرّب طلباً أضيق — مثلاً محوراً واحداً بدل عدّة محاور."
              : "تعذّر الاتصال.",
        doc: rescued ?? undefined,
        failure: byUser || rescued ? undefined : "network",
        retryable: !byUser && !rescued,
      }]);
    } finally {
      clearTimeout(giveUp);
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, files, busy, convId, messages, loadHistory, rescueDocument]);

  return (
    /* dvh, not vh. A phone's 100vh is the height with the browser chrome
       hidden and it does not shrink when the keyboard opens, so the panel
       stayed taller than what you could see and the page grew under you
       every time you typed. dvh tracks the visible viewport. The minimum
       is also gone below `sm` — on a short phone it was forcing 560px
       into a 480px space, which is the same bug wearing a hat. */
    <div className="panel flex h-[calc(100dvh-10rem)] flex-col overflow-hidden sm:h-[calc(100dvh-13rem)] sm:min-h-[560px]">
      {/* ── header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.14)" }}
        >
          <Sparkles className="size-4" style={{ color: "var(--accent-1)" }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight">سُرى</p>
          {/* The capability list used to live here, four clauses long, on
              every screen forever. It belongs where it helps — the empty
              state, once, when you are deciding what to ask. */}
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
            <span className="size-1.5 rounded-full" style={{ background: "var(--accent-1)" }} />
            متّصلة ببيانات عيادتك
          </p>
        </div>

        <div className="relative flex shrink-0 items-center gap-1">
          <IconBtn label="محادثة جديدة" onClick={reset}><Plus className="size-4" /></IconBtn>
          <IconBtn label="المحادثات السابقة" onClick={() => { setShowHistory(!showHistory); void loadHistory(); }}>
            <History className="size-4" />
          </IconBtn>

          {showHistory && (
            <div
              className="absolute top-11 z-30 max-h-80 w-72 overflow-y-auto rounded-2xl p-1.5 shadow-2xl"
              style={{ insetInlineEnd: 0, background: "#12131a", border: "1px solid rgba(255,255,255,.12)" }}
            >
              {history.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12px] text-[var(--text-3)]">لا محادثات محفوظة بعد</p>
              ) : history.map((c) => (
                <div key={c.id} className="group flex items-center gap-1 rounded-xl px-1 hover:bg-white/5">
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="min-w-0 flex-1 px-2 py-2 text-start"
                  >
                    <span className="block truncate text-[12.5px] text-white">{c.title}</span>
                    <span className="block text-[10.5px] text-[var(--text-3)]">
                      {new Date(c.updated_at).toLocaleString("ar-OM", {
                        timeZone: "Asia/Muscat", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConversation(c.id)}
                    aria-label="حذف"
                    className="shrink-0 p-2 text-[var(--text-3)] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── thread ── */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={threadRef}
          onScroll={onScroll}
          /* overscroll-contain stops a flick at the end of the thread from
             carrying on into the page behind it. */
          className="h-full space-y-4 overflow-y-auto overscroll-contain px-3 py-5 sm:px-5"
        >
          {loadingConv && (
            <p className="py-10 text-center text-[12px] text-[var(--text-3)]">
              <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
              أفتح المحادثة…
            </p>
          )}

          {!loadingConv && messages.length === 0 && (
            <div className="mx-auto flex max-w-xl flex-col justify-center px-1 py-8 sm:py-12">
              <span
                className="mb-4 flex size-11 items-center justify-center rounded-2xl"
                style={{ background: "rgb(var(--accent-1-rgb) / 0.12)" }}
              >
                <Sparkles className="size-5" style={{ color: "var(--accent-1)" }} />
              </span>
              <p className="text-[19px] font-bold leading-snug text-white">
                مساء الخير — وش تحتاج؟
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-3)]">
                اسألني عن أي رقم في عيادتك، أو اطلب مني أحجز أو أؤجّل أو أكتب
                خطة علاج أو أُصدر تقريراً. وتقدر ترفق صورة أو PDF وأقرأه لك.
              </p>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="group/s rounded-2xl px-4 py-3 text-start text-[13px] leading-relaxed text-[var(--text-2)] transition-colors hover:text-white"
                    style={{ background: "var(--surface-2)" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble
              key={i}
              m={m}
              thinking={busy && i === messages.length - 1 && !m.content}
              phase={PHASES[phase]}
              onRetry={() => lastAsk.current && void send(undefined, lastAsk.current)}
            />
          ))}
        </div>

        {/* Only offered when you are actually somewhere else. A jump
            button that is always present is just clutter. */}
        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => { setAtBottom(true); toBottom(); }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white shadow-lg"
            style={{ background: "var(--accent-2)" }}
          >
            <ArrowDown className="size-3.5" />
            أحدث الرسائل
          </button>
        )}
      </div>

      {err && (
        <p className="flex items-center gap-1.5 px-4 pb-1 text-[11px] text-amber-400">
          <AlertTriangle className="size-3" />{err}
        </p>
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => void send()}
        onStop={() => abortRef.current?.abort()}
        busy={busy}
        files={files}
        setFiles={setFiles}
        onError={setErr}
      />
    </div>
  );
}

/* ── one turn ─────────────────────────────────────────────────────── */

/* Memoised because RichText re-parses markdown on every render, and every
   render used to touch every turn in the thread — a phase tick three
   times a request, times twenty answers, is a lot of markdown parsed to
   change one spinner's caption. This is most of the "heavy" feeling. */
const Bubble = memo(function Bubble({
  m, thinking, phase, onRetry,
}: { m: Msg; thinking: boolean; phase: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const failed = Boolean(m.failure);

  return (
    <div className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
      <div
        /* The assistant's turn carries reports and tables, so it gets the
           room; the question above it does not need any. Borders came off
           both — on a dark ground a slightly lifted surface separates them
           perfectly well, and three outlined boxes per exchange was most
           of what read as "cluttered". */
        className={`group rounded-2xl px-4 py-3 text-[14px] leading-[1.85] ${
          m.role === "user" ? "max-w-[min(34rem,86%)]" : "max-w-[min(48rem,94%)]"
        }`}
        style={
          m.role === "user"
            ? { background: "rgb(var(--accent-2-rgb) / 0.16)", color: "#E9EEF7" }
            : failed
              ? { background: "rgba(239,68,68,0.07)", color: "rgba(254,226,226,0.95)" }
              : { background: "rgba(255,255,255,0.045)", color: "rgba(232,238,247,0.95)" }
        }
      >
        {m.files && m.files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {m.files.map((f) =>
              f.preview ? (
                <Image key={f.name} src={f.preview} alt={f.name} width={112} height={112}
                  unoptimized className="h-28 w-auto rounded-lg border border-white/10 object-cover" />
              ) : (
                <span key={f.name} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]">
                  <FileText className="size-3" />{f.name}
                </span>
              ),
            )}
          </div>
        )}

        {thinking ? (
          <span className="flex items-center gap-2 text-[var(--text-3)]">
            <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--accent-1)" }} />
            {phase}
          </span>
        ) : m.content ? (
          m.role === "assistant" ? <RichText text={m.content} /> : m.content
        ) : null}

        {m.doc && (
          <a
            href={m.doc.url}
            target="_blank"
            rel="noopener"
            className="mt-2.5 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-2)" }}
          >
            <FileDown className="size-4" />
            {m.doc.label}
          </a>
        )}

        {/* Copy and retry appear on the turn they belong to, on hover,
            rather than as a toolbar that is always shouting. */}
        {m.role === "assistant" && m.content && !thinking && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {m.retryable && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--text-3)] hover:text-white"
              >
                <RotateCw className="size-3" />أعد المحاولة
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(m.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--text-3)] hover:text-white"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "نُسخ" : "نسخ"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-xl text-[var(--text-3)] transition-colors hover:bg-white/5 hover:text-white"
    >
      {children}
    </button>
  );
}

/** Link out to the printable monthly document. */
export function ReportLink() {
  return (
    <a
      href="/print/report"
      className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] text-[var(--text-2)] transition-colors hover:text-white"
      style={{ borderColor: "var(--hairline)" }}
    >
      <MessageSquare className="size-4" />
      تقرير الشهر
    </a>
  );
}
