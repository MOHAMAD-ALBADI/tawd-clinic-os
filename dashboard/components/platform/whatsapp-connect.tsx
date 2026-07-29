"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, CheckCircle2, AlertTriangle, Plug, Power } from "lucide-react";
import { connectWhatsApp, testWhatsApp, setWhatsAppActive } from "@/app/actions/channels";

export type WaState = {
  connected: boolean;
  active: boolean;
  label: string | null;      // credentials_ref — the number as Meta reports it
  phoneNumberId: string | null;
  hasBrain: boolean;         // gemini key present in this clinic's row
};

/** Connect a clinic's WhatsApp so Sura can answer on its number.

    Until this screen existed, createClinic left every new clinic without a
    channel row, and the only way to give one was to write JSON into the
    database by hand. */
export function WhatsAppConnect({ clinicId, state }: { clinicId: string; state: WaState }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [phoneNumberId, setPhoneNumberId] = useState(state.phoneNumberId ?? "");
  const [wabaId, setWabaId] = useState("");
  const [token, setToken] = useState("");

  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [warn, setWarn] = useState<string[]>([]);

  function test() {
    setMsg(null); setWarn([]);
    start(async () => {
      const r = await testWhatsApp({ phoneNumberId, wabaId, accessToken: token });
      setMsg(r.ok
        ? { text: `الرمز صالح — ${r.displayNumber ?? ""} ${r.verifiedName ? `(${r.verifiedName})` : ""}` }
        : { text: r.reason ?? "فشل التحقق", bad: true });
    });
  }

  function save() {
    setMsg(null); setWarn([]);
    start(async () => {
      const r = await connectWhatsApp(clinicId, { phoneNumberId, wabaId, accessToken: token });
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setWarn(r.warnings);
      setMsg({ text: `تم الربط — ${r.displayNumber ?? phoneNumberId}` });
      setToken("");
      setOpen(false);
      router.refresh();
    });
  }

  function toggle() {
    start(async () => {
      const r = await setWhatsAppActive(clinicId, !state.active);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <MessageCircle className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          قناة واتساب — سُرى
        </h3>
        {state.connected && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={
              state.active
                ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                : { background: "rgba(255,255,255,0.04)", color: "var(--text-3)", border: "1px solid var(--hairline)" }
            }>
            {state.active ? "تعمل" : "موقوفة"}
          </span>
        )}
      </div>

      {state.connected ? (
        <>
          <p className="text-[12px]" style={{ color: "var(--text-2)" }}>{state.label}</p>
          {!state.hasBrain && (
            <p className="flex items-start gap-1.5 text-[11px] mt-2" style={{ color: "#fbbf24" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              الرسائل تصل لكن سُرى لن ترد — مفاتيح المنصة غير منسوخة لهذه العيادة
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
          غير مربوطة — سُرى لا تستقبل ولا ترد على مرضى هذه العيادة
        </p>
      )}

      {msg && (
        <p className="flex items-start gap-1.5 text-[12px] mt-2 font-semibold"
          style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
          {msg.bad ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          {msg.text}
        </p>
      )}
      {warn.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-[11px] mt-1.5" style={{ color: "#fbbf24" }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
        </p>
      ))}

      {open ? (
        <div className="space-y-2.5 mt-3">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
              Phone number ID *
            </label>
            <input className="field ltr-nums" dir="ltr" value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="1234567890123456" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
              WhatsApp Business Account ID
            </label>
            <input className="field ltr-nums" dir="ltr" value={wabaId}
              onChange={(e) => setWabaId(e.target.value)} placeholder="اختياري" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
              رمز الوصول الدائم *
            </label>
            {/* type=password so a shoulder or a screen share does not hand over
                a token that can send as the clinic. */}
            <input className="field" dir="ltr" type="password" value={token}
              onChange={(e) => setToken(e.target.value)} placeholder="EAAG…" />
          </div>

          <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
            من لوحة ميتا ← WhatsApp ← API Setup. لا يُحفظ شيء قبل أن تؤكّد ميتا أن الرمز يملك هذا الرقم.
          </p>

          <div className="flex items-center gap-2">
            <button className="btn-ghost flex-1" disabled={pending || !phoneNumberId || !token} onClick={test}>
              فحص
            </button>
            <button className="btn-primary flex-1" disabled={pending || !phoneNumberId || !token} onClick={save}>
              <Plug className="w-3.5 h-3.5" /> {pending ? "جارٍ…" : "ربط"}
            </button>
            <button className="btn-ghost" onClick={() => { setOpen(false); setMsg(null); }}>إلغاء</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <button className="btn-primary flex-1" onClick={() => { setMsg(null); setOpen(true); }}>
            <Plug className="w-3.5 h-3.5" /> {state.connected ? "تغيير الربط" : "ربط واتساب"}
          </button>
          {state.connected && (
            <button className="btn-ghost" disabled={pending} onClick={toggle}
              title={state.active ? "إيقاف سُرى على هذا الرقم" : "تشغيل سُرى"}>
              <Power className="w-3.5 h-3.5" style={{ color: state.active ? "#fda4b4" : "#34d399" }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
