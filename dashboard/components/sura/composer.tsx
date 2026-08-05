"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Plus, Mic, Send, Square, X, FileText, Image as ImageIcon,
  FileDown, CalendarPlus, ClipboardList, Search, Loader2,
} from "lucide-react";

/* The composer.
 *
 * The old one was a paperclip and a box. Everything Sura can do was
 * reachable only by knowing to type it, which means it was reachable
 * only by whoever built it — a clinic manager opening this for the
 * first time has no way to discover that she books, drafts plans or
 * produces documents.
 *
 * So the plus menu is the capability list, in the place where you would
 * act on it. Each entry either opens the file picker or seeds the box
 * with a half-written instruction and puts the cursor where the missing
 * detail goes. That is deliberately not a form: the point is to teach
 * the sentence, so the second time they type it themselves.
 */

export type StagedFile = { name: string; mime: string; data: string; preview?: string };

const MAX_FILES = 2;
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/heic,application/pdf";

type Seed = { icon: typeof CalendarPlus; label: string; hint: string; text: string };

const SEEDS: Seed[] = [
  { icon: CalendarPlus, label: "احجز موعداً", hint: "تنفّذه سُرى فعلاً في التقويم",
    text: "احجزي موعد " },
  { icon: ClipboardList, label: "اكتب خطة علاجية", hint: "مسوّدة بأسعار عيادتك",
    text: "اكتبي خطة علاجية لـ" },
  { icon: FileDown, label: "أصدر تقرير الشهر", hint: "جاهز للطباعة أو حفظ PDF",
    text: "أصدري تقرير هذا الشهر" },
  { icon: Search, label: "ابحث في بياناتك", hint: "أي رقم في العيادة",
    text: "كم " },
];

/* Chrome and Edge expose this; Firefox does not. Typed here rather than
   pulled from a lib because it is two fields and one event. */
type SpeechCtor = new () => {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function Composer({
  value, onChange, onSend, onStop, busy, files, setFiles, onError,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  files: StagedFile[];
  setFiles: (f: StagedFile[] | ((p: StagedFile[]) => StagedFile[])) => void;
  onError: (m: string | null) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);

  /* Grows with the text, to a ceiling. A one-line box for a paragraph
     of Arabic is why people write one-line questions. */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  async function accept(list: FileList | File[] | null) {
    if (!list) return;
    const arr = Array.from(list);
    if (!arr.length) return;
    onError(null);

    const room = MAX_FILES - files.length;
    if (room <= 0) { onError("ملفان كحدّ أقصى"); return; }

    for (const f of arr.slice(0, room)) {
      if (!ACCEPT.split(",").includes(f.type)) {
        onError(`«${f.name}» نوع غير مدعوم — صور أو PDF فقط`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        onError(`«${f.name}» أكبر من ٤ ميغابايت`);
        continue;
      }
      try {
        const data = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1] ?? "");
          r.onerror = () => rej(new Error("read"));
          r.readAsDataURL(f);
        });
        setFiles((p) => [...p, {
          name: f.name, mime: f.type, data,
          preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        }]);
      } catch {
        onError(`تعذّر قراءة «${f.name}»`);
      }
    }
  }

  function seed(s: Seed) {
    setMenu(false);
    if (s.text) {
      onChange(s.text);
      requestAnimationFrame(() => {
        const el = boxRef.current;
        el?.focus();
        el?.setSelectionRange(s.text.length, s.text.length);
      });
    }
  }

  function toggleMic() {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { onError("الإدخال الصوتي غير مدعوم في هذا المتصفّح — جرّب Chrome"); return; }

    if (listening) { recRef.current?.stop(); return; }

    const rec = new Ctor();
    rec.lang = "ar-OM";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript ?? "";
      if (said) onChange(value ? `${value} ${said}` : said);
    };
    rec.onerror = () => { onError("تعذّر التقاط الصوت"); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    onError(null);
    rec.start();
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void accept(e.dataTransfer.files); }}
      className="border-t px-3 py-3 transition-colors"
      style={{
        borderColor: "var(--hairline)",
        background: drag ? "rgb(var(--accent-2-rgb) / 0.08)" : undefined,
      }}
    >
      {/* staged files */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={f.name + i}
              className="inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px]"
              style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}
            >
              {f.preview
                ? <Image src={f.preview} alt="" width={24} height={24} unoptimized className="size-6 rounded object-cover" />
                : <FileText className="size-3.5" style={{ color: "var(--accent-1)" }} />}
              <span className="max-w-[13rem] truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="إزالة">
                <X className="size-3 text-[var(--text-3)]" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className="flex items-end gap-1.5 rounded-2xl px-2 py-1.5"
        style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
      >
        {/* ── the plus menu ── */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}
            aria-label="إضافة"
            aria-expanded={menu}
            className="flex size-9 items-center justify-center rounded-xl text-[var(--text-2)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <Plus className="size-4.5" style={{ transform: menu ? "rotate(45deg)" : undefined, transition: "transform .18s" }} />
          </button>

          {menu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-12 z-30 w-[19rem] overflow-hidden rounded-2xl p-1.5 shadow-2xl"
              style={{ insetInlineStart: 0, background: "#12131a", border: "1px solid rgba(255,255,255,.12)" }}
            >
              <MenuRow
                icon={ImageIcon}
                label="إضافة صور وملفات"
                hint="من جهازك — صور أو PDF"
                onClick={() => { setMenu(false); fileRef.current?.click(); }}
              />
              <div className="my-1.5 h-px" style={{ background: "rgba(255,255,255,.08)" }} />
              {SEEDS.map((s) => (
                <MenuRow key={s.label} icon={s.icon} label={s.label} hint={s.hint} onClick={() => seed(s)} />
              ))}
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => { void accept(e.target.files); e.target.value = ""; }}
        />

        <textarea
          ref={boxRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            /* A screenshot straight from the clipboard, which is how
               anyone actually shares one. */
            const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
            if (imgs.length) { e.preventDefault(); void accept(imgs); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
          }}
          rows={1}
          placeholder={listening ? "أستمع…" : "اسأل، أو اطلب تنفيذ شيء…"}
          /* Capped lower on a phone. The box grows as you type, and at
             176px it was eating half a small screen — which is the other
             half of "the screen gets bigger every time I write". */
          className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-1.5 text-[14px] text-white outline-none placeholder:text-[var(--text-3)] sm:max-h-44"
        />

        <button
          type="button"
          onClick={toggleMic}
          aria-label="إدخال صوتي"
          className="flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-white/5"
          style={{ color: listening ? "#f87171" : "var(--text-3)" }}
        >
          <Mic className="size-4" style={listening ? { animation: "pulse 1.1s infinite" } : undefined} />
        </button>

        {/* Stop is the same affordance as send, in the same place —
            a generation you cannot interrupt is one you have to sit
            through. */}
        <button
          type="button"
          onClick={busy ? onStop : onSend}
          disabled={!busy && !value.trim() && files.length === 0}
          aria-label={busy ? "إيقاف" : "إرسال"}
          className="flex size-9 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-35"
          style={{ background: busy ? "#3b3d46" : "var(--accent-2)" }}
        >
          {busy ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
        </button>
      </div>

      {/* Keyboard shortcuts are not news on a phone, where there is no
          keyboard to have shortcuts on — and the line was competing with
          the input directly above it. */}
      <p className="mt-1.5 hidden px-1 text-[10.5px] text-[var(--text-3)] sm:block">
        Enter للإرسال · Shift+Enter لسطر جديد · اسحب ملفاً أو الصق صورة
      </p>
    </div>
  );
}

function MenuRow({
  icon: Icon, label, hint, onClick,
}: { icon: typeof Plus; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition-colors hover:bg-white/6"
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "rgb(var(--accent-1-rgb) / 0.12)", color: "var(--accent-1)" }}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-white">{label}</span>
        <span className="block truncate text-[11px] text-[var(--text-3)]">{hint}</span>
      </span>
    </button>
  );
}

export { Loader2 };
