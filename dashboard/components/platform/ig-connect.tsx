"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plug, AtSign, CheckCircle2, AlertTriangle } from "lucide-react";
import { connectInstagram } from "@/app/actions/ig-agent";

export type ClinicOption = { id: string; label: string };

const SAMPLE = `أنتِ سُرى، مساعدة عيادة …

مهمتك الرد على استفسارات المرضى في الرسائل الخاصة: الخدمات، الأسعار
التقريبية، أوقات الدوام، والموقع — وتحويل من يريد الحجز إلى الاتصال بالعيادة.

لا تعطي تشخيصاً طبياً ولا تعد بنتيجة علاج.`;

/** Connect another Instagram account to Sura.

    The account id is never typed. Instagram gives one account two different
    ids — the app-scoped one that `/me` returns, and the IGSID that arrives in
    the webhook's `recipient` — and picking the wrong one produces an assistant
    that receives every message and answers none of them. The token is exchanged
    for the right one instead. */
export function IgConnect({ clinics }: { clinics: ClinicOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [token, setToken] = useState("");
  const [persona, setPersona] = useState(SAMPLE);
  const [clinicId, setClinicId] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await connectInstagram({
        accessToken: token,
        persona,
        clinicId: clinicId || null,
      });
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setMsg({ text: `رُبط ${r.username ? "@" + r.username : r.igUserId} ✓` });
      setToken("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button className="btn-ghost" onClick={() => { setMsg(null); setOpen(true); }}>
        <Plug className="w-3.5 h-3.5" /> ربط حساب إنستغرام
      </button>
    );
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
        <AtSign className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        ربط حساب إنستغرام
      </h3>

      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
        رمز الوصول (Instagram Login) *
      </label>
      <input className="field" dir="ltr" type="password" value={token}
        onChange={(e) => setToken(e.target.value)} placeholder="IGAA…" />
      <p className="text-[11px] mt-1" style={{ color: "var(--text-4)" }}>
        معرّف الحساب يُقرأ من الرمز نفسه — لا تكتبه.
      </p>

      <label className="text-[11px] font-semibold block mb-1 mt-3" style={{ color: "var(--text-3)" }}>
        العيادة
      </label>
      <select className="field" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
        <option value="">حساب المنصّة (طَود نفسها)</option>
        {clinics.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      <label className="text-[11px] font-semibold block mb-1 mt-3" style={{ color: "var(--text-3)" }}>
        شخصية سُرى على هذا الحساب *
      </label>
      <textarea className="field" rows={7} value={persona}
        onChange={(e) => setPersona(e.target.value)} style={{ resize: "vertical" }} />

      {msg && (
        <p className="flex items-start gap-1.5 text-[12px] mt-2 font-semibold"
          style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
          {msg.bad ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          {msg.text}
        </p>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button className="btn-primary flex-1" disabled={busy || !token || persona.trim().length < 40} onClick={save}>
          <Plug className="w-3.5 h-3.5" /> {busy ? "جارٍ…" : "ربط"}
        </button>
        <button className="btn-ghost" onClick={() => { setOpen(false); setMsg(null); }}>إلغاء</button>
      </div>
    </div>
  );
}
