"use client";

import { useState } from "react";
import {
  ChevronDown, MessageSquare, PauseCircle, XCircle,
  ArrowUpRight, ShieldAlert, Check, X,
} from "lucide-react";

/* Why Sura did what it did.
 *
 * The closed state is a headline the owner can skim; the open state is
 * the case file. Both matter, and the order matters: the decision first,
 * the justification underneath, the raw facts last. Reversing that — raw
 * data first, conclusion buried — is how audit logs become the thing
 * nobody reads.
 *
 * A clinic owner who can satisfy themselves that the choice was sound
 * keeps the agent switched on. That is the entire purpose of this
 * component, and it is why it is a product surface rather than a
 * debugging page behind a flag.
 */

const ICONS: Record<string, typeof MessageSquare> = {
  message_patient: MessageSquare,
  wait: PauseCircle,
  drop: XCircle,
  escalate: ArrowUpRight,
  hold: ShieldAlert,
};

export function WhyCard({
  at, kindLabel, choseLabel, chose, ok, valueOmr,
  reason, considered, observed, args, result,
}: {
  at: string;
  kindLabel: string;
  choseLabel: string;
  chose: string;
  ok: boolean;
  valueOmr: number;
  reason: string;
  considered: string[];
  observed: Record<string, unknown>;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[chose] ?? MessageSquare;

  const when = new Date(at).toLocaleString("ar-OM", {
    timeZone: "Asia/Muscat",
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  const message = typeof args.message_ar === "string" ? args.message_ar : null;
  const who = typeof args.name === "string" ? args.name : null;
  const blocked = typeof result.blocked === "string" ? result.blocked : null;
  const error = typeof result.error === "string" ? result.error : null;

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-right"
      >
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: ok ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${ok ? "rgb(var(--accent-1-rgb) / 0.28)" : "rgba(239,68,68,0.3)"}`,
            color: ok ? "var(--accent-1)" : "#f87171",
          }}
        >
          <Icon className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-sm">{choseLabel}</b>
            {who && <span className="text-sm text-[var(--text-2)]">— {who}</span>}
            <span className="eyebrow" style={{ letterSpacing: ".1em" }}>{kindLabel}</span>
            {valueOmr > 0 && (
              <span className="text-xs font-bold" style={{ color: "var(--accent-1)" }}>
                {valueOmr.toLocaleString("ar-OM")} ر.ع
              </span>
            )}
          </span>
          {/* The one-sentence justification is the headline, not a detail. */}
          <span className="mt-1 block text-[13px] leading-relaxed text-[var(--text-2)]">
            {reason}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-[var(--text-3)]">{when}</span>
          <ChevronDown
            className="size-4 text-[var(--text-3)] transition-transform"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[var(--hairline)] px-4 py-4">
          {considered.length > 0 && (
            <Block title="ما وازنته">
              <ul className="space-y-1.5">
                {considered.map((c) => (
                  <li key={c} className="flex gap-2 text-[13px] leading-relaxed text-[var(--text-2)]">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--text-3)]" />
                    {c}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {message && (
            <Block title="الرسالة التي أُرسلت">
              <p className="whitespace-pre-line rounded-xl p-3 text-[13px] leading-relaxed"
                 style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
                {message}
              </p>
            </Block>
          )}

          {(blocked || error) && (
            <Block title={blocked ? "لماذا لم تُرسل" : "الخطأ"}>
              <p className="rounded-xl p-3 text-[13px] leading-relaxed"
                 style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.24)" }}>
                {blocked ?? error}
              </p>
            </Block>
          )}

          <Block title="ما رأته">
            <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {Object.entries(observed)
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .slice(0, 12)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 text-[12px]">
                    <dt className="text-[var(--text-3)]">{FIELD_AR[k] ?? k}</dt>
                    <dd className="truncate text-[var(--text-2)]">{render(v)}</dd>
                  </div>
                ))}
            </dl>
          </Block>

          <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
            {ok ? <Check className="size-3" /> : <X className="size-3" />}
            {ok ? "نُفّذ" : "لم يُنفّذ"}
          </p>
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      {children}
    </div>
  );
}

const FIELD_AR: Record<string, string> = {
  kind: "نوع الهدف",
  value_omr: "القيمة",
  service_name: "الخدمة",
  doctor_name: "الطبيب",
  slot_time: "الموعد",
  duration: "المدّة",
  candidate_count: "عدد المرشّحين",
  plan_title: "الخطة",
  items_left: "بنود متبقّية",
  items_done: "بنود منجزة",
  next_item: "البند التالي",
  next_price: "سعر البند",
  days_stalled: "أيام التوقّف",
};

function render(v: unknown): string {
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "number") return v.toLocaleString("ar-OM");
  const s = String(v);
  /* An ISO timestamp is unreadable in a table; the same instant in clinic
     time is the thing the owner is actually checking. */
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return new Date(s).toLocaleString("ar-OM", {
      timeZone: "Asia/Muscat",
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }
  return s;
}
