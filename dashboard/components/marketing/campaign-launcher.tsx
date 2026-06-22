"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, X, Users, MessageSquare, CheckCircle2, Send } from "lucide-react";
import { launchCampaign, type CampaignAudience } from "@/app/actions/campaigns";

const AUDIENCES: { value: CampaignAudience; label: string; hint: string }[] = [
  { value: "all", label: "كل المرضى", hint: "كل من له رقم جوال" },
  { value: "loyalty", label: "أصحاب نقاط الولاء", hint: "المرضى الأوفياء" },
  { value: "inactive", label: "غير النشطين", hint: "لم يزوروا مؤخراً" },
];

function LauncherModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<CampaignAudience>("all");
  const [message, setMessage] = useState("");

  function submit() {
    if (!name.trim()) { setError("اسم الحملة مطلوب"); return; }
    if (!message.trim()) { setError("نص الرسالة مطلوب"); return; }
    setError(null);
    startTransition(async () => {
      try {
        const res = await launchCampaign({ name: name.trim(), message: message.trim(), audience });
        setDone(res.recipients);
        router.refresh();
        setTimeout(onClose, 1600);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر إطلاق الحملة");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(2,8,18,0.82)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg panel animate-scale-in" style={{ background: "rgba(8,14,24,0.98)", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="eyebrow mb-1" style={{ color: "var(--color-brand-400)" }}>NEW CAMPAIGN</p>
            <h2 className="text-white font-bold text-lg">إطلاق حملة واتساب</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {done !== null ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(52,211,153,0.14)" }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: "var(--color-ok)" }} />
            </div>
            <p className="text-white font-bold">انطلقت الحملة!</p>
            <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
              يتم الإرسال إلى <span className="ltr-nums font-bold text-white">{done}</span> مريض عبر سُرى…
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: "var(--text-2)" }}>
                <Megaphone className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} /> اسم الحملة *
              </label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عرض الفحص الدوري" />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: "var(--text-2)" }}>
                <Users className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} /> الجمهور
              </label>
              <div className="grid grid-cols-3 gap-2">
                {AUDIENCES.map((a) => {
                  const active = audience === a.value;
                  return (
                    <button key={a.value} onClick={() => setAudience(a.value)}
                      className="rounded-xl px-3 py-2.5 text-right transition-all"
                      style={{
                        background: active ? "rgba(20,184,166,0.12)" : "var(--surface-2)",
                        border: `1px solid ${active ? "rgba(45,212,191,0.4)" : "var(--hairline)"}`,
                      }}>
                      <p className="text-[13px] font-bold" style={{ color: active ? "#5dd9cb" : "var(--text-1)" }}>{a.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>{a.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: "var(--text-2)" }}>
                <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} /> نص الرسالة *
              </label>
              <textarea className="field" rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالتك هنا… (تُرسَل عبر واتساب)" style={{ resize: "none" }} />
              <p className="text-[11px] mt-1.5" style={{ color: "var(--text-4)" }}>تُرسَل عبر واتساب من خلال سُرى — مع مراعاة فترات التأخير لتجنّب الحظر.</p>
            </div>

            {error && (
              <div className="text-sm py-2.5 px-3.5 rounded-xl" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="btn-ghost flex-1 h-11">إلغاء</button>
              <button onClick={submit} disabled={pending} className="btn-primary flex-1 h-11">
                <Send className="w-4 h-4" /> {pending ? "جارٍ الإطلاق…" : "أطلق الحملة"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CampaignLauncherTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Megaphone className="w-4 h-4" /> حملة جديدة
      </button>
      {open && <LauncherModal onClose={() => setOpen(false)} />}
    </>
  );
}
