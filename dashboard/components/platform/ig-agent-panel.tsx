"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign, Save, Play, CheckCircle2, AlertTriangle, MessageSquare, Pause,
} from "lucide-react";
import { saveAgent, tryAgent } from "@/app/actions/ig-agent";
import { arDateTime } from "@/lib/ar-format";

export type Turn = {
  id: string;
  senderId: string;
  direction: string;
  text: string;
  status: string;
  error: string | null;
  at: string;
};

export function IgAgentPanel({
  agent, turns, ready,
}: {
  agent: { igUserId: string; username: string | null; persona: string; isActive: boolean; paused: boolean };
  turns: Turn[];
  /** the tokens exist in the environment — without them nothing can be sent */
  ready: { token: boolean; verify: boolean; secret: boolean };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [persona, setPersona] = useState(agent.persona);
  const [isActive, setIsActive] = useState(agent.isActive);
  const [paused, setPaused] = useState(agent.paused);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const [probe, setProbe] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const missing = [
    !ready.token && "IG_ACCESS_TOKEN",
    !ready.verify && "IG_VERIFY_TOKEN",
    !ready.secret && "IG_APP_SECRET",
  ].filter(Boolean) as string[];

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveAgent({ igUserId: agent.igUserId, persona, isActive, paused });
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setMsg({ text: "حُفظ ✓" });
      setTimeout(() => setMsg(null), 3000);
      router.refresh();
    });
  }

  function test() {
    setAnswer(null); setMsg(null);
    start(async () => {
      const r = await tryAgent(agent.igUserId, probe);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setAnswer(r.answer);
    });
  }

  /* Group the log into conversations — a flat list of turns from several people
     interleaved is unreadable. */
  const byPerson = new Map<string, Turn[]>();
  for (const t of turns) {
    const k = t.senderId;
    byPerson.set(k, [...(byPerson.get(k) ?? []), t]);
  }

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="flex items-start gap-2 text-[12.5px] px-3.5 py-3 rounded-xl"
          style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.26)", color: "#fbbf24" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            ناقص في المتغيّرات: <span className="ltr-nums" dir="ltr">{missing.join(" · ")}</span>
            <span className="block mt-0.5" style={{ color: "var(--text-3)" }}>
              سُرى تستقبل وتفكّر، لكنها لن تستطيع الرد قبل ضبطها في Vercel.
            </span>
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* ── persona ── */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <div className="section-title">
              <AtSign className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
              <h2>شخصية سُرى</h2>
            </div>
            <span className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>
              @{agent.username ?? agent.igUserId}
            </span>
          </div>
          <p className="text-[11.5px] mb-3" style={{ color: "var(--text-4)" }}>
            هذا ما تعرفه وما تقوله — عدّله متى شئت، يسري فوراً بلا نشر
          </p>

          <textarea className="field" rows={16} value={persona}
            onChange={(e) => setPersona(e.target.value)}
            style={{ lineHeight: 1.8, fontSize: "12.5px", resize: "vertical" }} />

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <Toggle on={isActive} set={setIsActive} label="مفعّلة على الحساب" />
            {/* The point of this switch is silence, not a different reply. */}
            <Toggle on={paused} set={setPaused} label="أرد أنا يدوياً الآن" warn />
          </div>

          {msg && (
            <p className="flex items-center gap-1.5 text-[12px] mt-3"
              style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
              {msg.bad ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {msg.text}
            </p>
          )}

          <button className="btn-primary mt-3" disabled={pending} onClick={save}>
            <Save className="w-4 h-4" /> {pending ? "جارٍ…" : "حفظ"}
          </button>
        </div>

        {/* ── rehearsal ── */}
        <div className="space-y-4">
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div className="section-title mb-1">
              <Play className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
              <h2>جرّبها قبل أحد</h2>
            </div>
            <p className="text-[11.5px] mb-3" style={{ color: "var(--text-4)" }}>
              اكتب سؤالاً كأنك عميل — لا يُرسل لأحد ولا يُحفظ في المحادثات
            </p>
            <input className="field" value={probe} onChange={(e) => setProbe(e.target.value)}
              placeholder="مثال: كم سعر النظام؟" />
            <button className="btn-ghost mt-2" disabled={pending || !probe.trim()} onClick={test}>
              <Play className="w-3.5 h-3.5" /> {pending ? "جارٍ…" : "جرّب"}
            </button>

            {answer && (
              <div className="mt-3 px-3.5 py-3 rounded-xl"
                style={{ background: "rgb(var(--accent-1-rgb) / 0.06)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)" }}>
                <p className="text-[10px] mb-1.5" style={{ color: "var(--text-4)" }}>ردّ سُرى</p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-1)" }}>{answer}</p>
              </div>
            )}
          </div>

          {/* ── conversations ── */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div className="section-title mb-1">
              <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
              <h2>المحادثات</h2>
            </div>
            <p className="text-[11.5px] mb-3" style={{ color: "var(--text-4)" }}>
              كل ما وصل وكل ما ردّت به — بمن فيهم من لم تستطع الرد عليه
            </p>

            {byPerson.size === 0 ? (
              <p className="text-[12px] text-center py-8" style={{ color: "var(--text-4)" }}>
                لا رسائل بعد
              </p>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto">
                {[...byPerson.entries()].map(([sender, list]) => (
                  <div key={sender}>
                    <p className="text-[10px] ltr-nums mb-1.5" style={{ color: "var(--text-4)" }}>
                      {sender.slice(0, 10)}… · {arDateTime.format(new Date(list[0].at))}
                    </p>
                    <div className="space-y-1.5">
                      {[...list].reverse().map((t) => (
                        <div key={t.id} className="px-3 py-2 rounded-xl text-[12.5px]"
                          style={{
                            background: t.direction === "in"
                              ? "rgba(255,255,255,0.03)" : "rgb(var(--accent-1-rgb) / 0.07)",
                            border: `1px solid ${t.status === "failed" ? "rgba(248,113,113,0.3)" : "var(--hairline)"}`,
                            marginInlineStart: t.direction === "out" ? "1.5rem" : 0,
                            color: "var(--text-1)",
                          }}>
                          {t.text}
                          {t.status === "failed" && (
                            <span className="block text-[10.5px] mt-1" style={{ color: "#fda4b4" }}>
                              لم تُرسل — {t.error ?? "سبب غير معروف"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, set, label, warn }: {
  on: boolean; set: (v: boolean) => void; label: string; warn?: boolean;
}) {
  return (
    <button type="button" onClick={() => set(!on)} className="flex items-center gap-2.5">
      <span className="w-9 h-5 rounded-full relative transition-colors shrink-0 block"
        style={{ background: on ? (warn ? "#fbbf24" : "var(--accent-2)") : "rgba(255,255,255,0.12)" }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ insetInlineStart: on ? "calc(100% - 1.125rem)" : "0.125rem" }} />
      </span>
      <span className="text-[12.5px] flex items-center gap-1"
        style={{ color: on ? "#ffffff" : "var(--text-4)" }}>
        {warn && on && <Pause className="w-3 h-3" style={{ color: "#fbbf24" }} />}
        {label}
      </span>
    </button>
  );
}
