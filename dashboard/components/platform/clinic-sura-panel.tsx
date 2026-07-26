"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Save, CheckCircle2, AlertTriangle, Wrench, MessageCircle, Globe,
} from "lucide-react";
import { saveClinicSura, setClinicSuraMaintenance } from "@/app/actions/platform-sura";
import { F } from "@/components/ui/num-field";

export type ClinicSura = {
  clinicId: string;
  clinicName: string;
  systemMessage: string;
  languages: string[];
  channels: Record<string, boolean>;
  inMaintenance: boolean;
  maintenanceMsg: string;
  whatsappLinked: boolean;
  messages7d: number;
  errors7d: number;
};

const CHANNELS: { key: string; label: string }[] = [
  { key: "whatsapp", label: "واتساب" },
  { key: "instagram", label: "إنستغرام" },
  { key: "web_chat", label: "دردشة الموقع" },
];
const LANGS: { key: string; label: string }[] = [
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
];

export function ClinicSuraPanel({ sura }: { sura: ClinicSura }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [msg, setMsg] = useState(sura.systemMessage);
  const [langs, setLangs] = useState<string[]>(sura.languages.length ? sura.languages : ["ar"]);
  const [channels, setChannels] = useState<Record<string, boolean>>(sura.channels ?? {});
  const [maintMsg, setMaintMsg] = useState(sura.maintenanceMsg);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3000); }

  const toggleLang = (k: string) =>
    setLangs((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]));

  function save() {
    setErr(null);
    start(async () => {
      try {
        const r = await saveClinicSura({
          clinicId: sura.clinicId, systemMessage: msg, languages: langs, channels,
        });
        if (!r.ok) { setErr(r.reason); return; }
        ok("حُفظت إعدادات سُرى لهذه العيادة");
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  function toggleMaintenance() {
    setErr(null);
    start(async () => {
      try {
        const r = await setClinicSuraMaintenance(sura.clinicId, !sura.inMaintenance, maintMsg);
        if (!r.ok) { setErr(r.reason); return; }
        ok(sura.inMaintenance ? "عادت سُرى للعمل" : "سُرى في وضع الصيانة لهذه العيادة");
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="section-title">
          <Bot className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>سُرى — إعدادات هذه العيادة</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill">
            <MessageCircle className="w-3 h-3" style={{ color: sura.whatsappLinked ? "var(--accent-1)" : "#fbbf24" }} />
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {sura.whatsappLinked ? "واتساب مربوط" : "واتساب غير مربوط"}
            </span>
          </span>
          <span className="pill">
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>رسائل ٧ أيام</span>
            <span className="text-[13px] font-black ltr-nums text-white">{sura.messages7d}</span>
          </span>
          {sura.errors7d > 0 && (
            <span className="pill" style={{ borderColor: "rgba(248,113,113,0.35)" }}>
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>أخطاء</span>
              <span className="text-[13px] font-black ltr-nums" style={{ color: "#fda4b4" }}>{sura.errors7d}</span>
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        ما تكتبه هنا يدخل في تعليمات سُرى لهذه العيادة وحدها — وتُطبَّق على الرسالة التالية مباشرة
      </p>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {sura.inMaintenance && (
        <div className="flex items-center gap-2 text-[12.5px] px-4 py-2.5 rounded-xl mb-4"
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
          <Wrench className="w-4 h-4 shrink-0" />
          سُرى في وضع الصيانة لهذه العيادة — ترد برسالة الصيانة بدل الحجز
        </div>
      )}

      <div className="space-y-4">
        <F label="تعليمات سُرى الخاصة بالعيادة">
          <textarea className="field" rows={5} style={{ resize: "vertical" }}
            value={msg} onChange={(e) => setMsg(e.target.value)}
            placeholder="مثال: العيادة لا تستقبل حالات طوارئ بعد ١٠ مساءً — وجّه المريض للطوارئ." />
          <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
            تُضاف لتعليماتها الأساسية ولا تستبدلها — اكتب الاستثناءات الخاصة بهذه العيادة فقط
          </span>
        </F>

        <div className="grid sm:grid-cols-2 gap-4">
          <F label="لغات الرد">
            <div className="flex items-center gap-1.5">
              {LANGS.map((l) => {
                const on = langs.includes(l.key);
                return (
                  <button key={l.key} type="button" onClick={() => toggleLang(l.key)}
                    className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
                    style={{
                      background: on ? "rgb(var(--accent-1-rgb) / 0.14)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.35)" : "var(--hairline)"}`,
                      color: on ? "var(--accent-1)" : "var(--text-3)",
                    }}>
                    <Globe className="w-3 h-3" /> {l.label}
                  </button>
                );
              })}
            </div>
          </F>

          <F label="القنوات المفعّلة">
            <div className="flex items-center gap-1.5 flex-wrap">
              {CHANNELS.map((c) => {
                const on = !!channels[c.key];
                return (
                  <button key={c.key} type="button"
                    onClick={() => setChannels((p) => ({ ...p, [c.key]: !on }))}
                    className="text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
                    style={{
                      background: on ? "rgb(var(--accent-1-rgb) / 0.14)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.35)" : "var(--hairline)"}`,
                      color: on ? "var(--accent-1)" : "var(--text-3)",
                    }}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </F>
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" disabled={pending} onClick={save}>
            <Save className="w-4 h-4" /> {pending ? "جارٍ الحفظ…" : "حفظ إعدادات سُرى"}
          </button>
        </div>

        {/* Maintenance is not the same as switching the workflow off. Off leaves
            a patient with no reply at all; this answers in the clinic's words. */}
        <div className="pt-4" style={{ borderTop: "1px solid var(--hairline)" }}>
          <F label="رسالة الصيانة — ما تقوله سُرى بدل الحجز">
            <input className="field" value={maintMsg} onChange={(e) => setMaintMsg(e.target.value)}
              placeholder="نعتذر، الحجز الآلي متوقف مؤقتاً — تواصل معنا على الرقم…" />
          </F>
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
              أفضل من إيقاف الووركفلو: المريض يتلقّى رداً بدل الصمت
            </p>
            <button className="btn-ghost" disabled={pending} onClick={toggleMaintenance}>
              <Wrench className="w-3.5 h-3.5" style={{ color: sura.inMaintenance ? "#34d399" : "#fbbf24" }} />
              {sura.inMaintenance ? "إنهاء الصيانة" : "تفعيل وضع الصيانة"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
