"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PhoneCall, MessageCircle, CalendarPlus, AlertTriangle, CheckCircle2,
  ChevronLeft, Coins,
} from "lucide-react";
import type { FollowUp, FollowUpBoard } from "@/lib/reception-followups";

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

type TabKey = keyof Omit<FollowUpBoard, "tomorrowLabel">;

/** The call list.

    Every row exists because somebody has to be phoned, and the two things the
    desk needs are on it: the number to dial and the reason. WhatsApp opens with
    a message already written, because the difference between a list that gets
    worked and one that does not is how many decisions stand between seeing the
    name and making contact. */
export function FollowUpBoardView({ board }: { board: FollowUpBoard }) {
  const tabs: { key: TabKey; label: string; hint: string; money?: boolean }[] = [
    { key: "confirmTomorrow", label: "تأكيد الغد", hint: `مواعيد ${board.tomorrowLabel} لم تُؤكَّد` },
    { key: "rebookNoShows", label: "إعادة حجز الغياب", hint: "لم يحضروا ولم يعودوا" },
    { key: "unscheduledTreatment", label: "علاج بلا موعد", hint: "وافقوا على العلاج ولم يُحجز", money: true },
    { key: "recallDue", label: "مواعيد دورية", hint: "لم يُرَوا منذ ٦ أشهر فأكثر" },
    { key: "outstanding", label: "مستحقات", hint: "فواتير غير مسدّدة", money: true },
    { key: "waitlist", label: "قائمة الانتظار", hint: "ينتظرون شاغراً" },
  ];

  const [tab, setTab] = useState<TabKey>(
    tabs.find((t) => board[t.key].length > 0)?.key ?? "confirmTomorrow"
  );
  const [done, setDone] = useState<Set<string>>(new Set());

  const rows = board[tab];
  const active = tabs.find((t) => t.key === tab)!;

  const totalValue = useMemo(
    () => rows.reduce((s, r) => s + (r.value ?? 0), 0),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((t) => {
          const n = board[t.key].length;
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
              style={{
                background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                color: on ? "var(--accent-1)" : n > 0 ? "var(--text-2)" : "var(--text-4)",
              }}>
              {t.label}
              <span className="ltr-nums text-[11px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-[15px] font-black text-white">{active.label}</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>{active.hint}</p>
          </div>
          {active.money && totalValue > 0 && (
            <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--accent-1)" }}>
              <Coins className="w-3.5 h-3.5" />
              <span className="font-black ltr-nums">{omr(totalValue)}</span> ر.ع
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--accent-1)" }} />
            <p className="text-sm" style={{ color: "var(--text-3)" }}>لا شيء هنا — أنجزتِه ✓</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <Row key={r.id} r={r} done={done.has(r.id)}
                onDone={() => setDone((p) => new Set(p).add(r.id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ r, done, onDone }: { r: FollowUp; done: boolean; onDone: () => void }) {
  const digits = (r.phone ?? "").replace(/\D/g, "");
  /* Pre-written so the desk edits rather than composes. */
  const wa = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(
        `مرحباً ${r.patientName}، معك عيادة طود. ` +
        (r.reason.includes("تأكيد") || r.reason.includes("يؤكد")
          ? "نودّ تأكيد موعدك غداً — هل يناسبك؟"
          : r.reason.includes("لم يحضر")
          ? "فاتك موعدك، ونحب نحجز لك موعداً جديداً. أي يوم يناسبك؟"
          : r.reason.includes("دوري")
          ? "حان موعد فحصك الدوري. نحجز لك؟"
          : r.reason.includes("علاج")
          ? "بخصوص خطة علاجك، نحب نكمل معك. أي يوم يناسبك؟"
          : "نتواصل معك بخصوص حسابك لدينا.")
      )}`
    : null;

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
      style={{
        background: done ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${done ? "rgba(52,211,153,0.2)" : r.urgent ? "rgba(251,191,36,0.24)" : "var(--hairline)"}`,
        opacity: done ? 0.6 : 1,
      }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/reception/patients/${r.patientId}`} className="text-[13px] font-bold text-white hover:underline truncate">
            {r.patientName}
          </Link>
          {r.urgent && <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#fbbf24" }} />}
          {r.value !== null && (
            <span className="text-[11px] font-black ltr-nums" style={{ color: "var(--accent-1)" }}>
              {omr(r.value)} ر.ع
            </span>
          )}
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
          {r.reason} · {r.detail}
          {r.phone && <span className="ltr-nums"> · {r.phone}</span>}
        </p>
      </div>

      {r.phone ? (
        <>
          <a href={`tel:${r.phone}`} className="btn-ghost" title="اتصال">
            <PhoneCall className="w-3.5 h-3.5" />
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost" title="واتساب برسالة جاهزة">
              <MessageCircle className="w-3.5 h-3.5" style={{ color: "#25d366" }} />
            </a>
          )}
        </>
      ) : (
        <span className="text-[10.5px] shrink-0" style={{ color: "#fbbf24" }}>لا رقم مسجّل</span>
      )}

      <Link href={`/reception/book?patient=${r.patientId}`} className="btn-ghost" title="حجز موعد">
        <CalendarPlus className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
      </Link>

      {/* Local only, on purpose. Marking a call done is a note to self for the
          next ten minutes; persisting it would need a contact log, and inventing
          half of one is worse than none. */}
      <button className="btn-ghost" title="تمّت المتابعة (لهذه الجلسة)" onClick={onDone} disabled={done}>
        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: done ? "#34d399" : "var(--text-4)" }} />
      </button>

      <Link href={`/reception/patients/${r.patientId}`} className="shrink-0">
        <ChevronLeft className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
      </Link>
    </div>
  );
}
