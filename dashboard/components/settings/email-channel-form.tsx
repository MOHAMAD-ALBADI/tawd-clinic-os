"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { saveEmailChannel } from "@/app/actions/clinic-settings";

/** The email channel.

    Two things are reported separately because their fixes are different: the
    platform has not finished setting up sending at all, versus this clinic has
    not switched it on. Showing one message for both would send a manager looking
    for a setting that is not theirs. */
export function EmailChannelForm({ initial }: {
  initial: {
    configured: boolean;
    enabled: boolean;
    fromName: string | null;
    replyTo: string | null;
    clinicName: string;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [fromName, setFromName] = useState(initial.fromName ?? "");
  const [replyTo, setReplyTo] = useState(initial.replyTo ?? "");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const shown = fromName.trim() || initial.clinicName;

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveEmailChannel({
        enabled,
        fromName: fromName.trim() || null,
        replyTo: replyTo.trim() || null,
      });
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setMsg({ text: "حُفظت إعدادات البريد ✓" });
      setTimeout(() => setMsg(null), 4000);
      router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="section-title mb-1">
        <Mail className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>البريد الإلكتروني</h2>
      </div>
      <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
        لإرسال الفواتير وسندات القبض وكشوف الحساب للمرضى
      </p>

      {!initial.configured ? (
        <p className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          الإرسال غير مفعّل على مستوى المنصة بعد — تواصلوا مع فريق طَود.
        </p>
      ) : (
        <>
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <button type="button" onClick={() => setEnabled((v) => !v)}
              className="w-9 h-5 rounded-full relative transition-colors shrink-0"
              style={{ background: enabled ? "var(--accent-2)" : "rgba(255,255,255,0.12)" }}
              aria-label="تفعيل البريد">
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ insetInlineStart: enabled ? "calc(100% - 1.125rem)" : "0.125rem" }} />
            </button>
            <span className="text-[13px]" style={{ color: enabled ? "#ffffff" : "var(--text-4)" }}>
              {enabled ? "مفعّل — يظهر زر «بريد» على الفواتير والسندات" : "معطّل"}
            </span>
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
                الاسم الظاهر للمريض
              </label>
              <input className="field" value={fromName} onChange={(e) => setFromName(e.target.value)}
                placeholder={initial.clinicName} />
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
                بريد الرد (اختياري)
              </label>
              <input className="field ltr-nums" dir="ltr" type="email" value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)} placeholder="info@clinic.om" />
            </div>
          </div>

          {/* What the patient will actually see in their inbox — worth showing,
              because "from name" and "reply-to" are abstract until they are. */}
          <div className="mt-4 px-3.5 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
            <p className="text-[10px] mb-1.5" style={{ color: "var(--text-4)" }}>كما ستصل للمريض</p>
            <p className="text-[13px] font-bold text-white">{shown}</p>
            <p className="text-[11.5px]" style={{ color: "var(--text-4)" }}>
              فاتورة INV-1042 — {shown}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--text-4)" }}>
              {replyTo.trim()
                ? <>ردّ المريض يصل إلى <span className="ltr-nums">{replyTo.trim()}</span></>
                : "بدون بريد رد، لن يستطيع المريض الرد على الرسالة"}
            </p>
          </div>

          {msg && (
            <p className="flex items-center gap-1.5 text-[12px] mt-4"
              style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
              {msg.bad ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {msg.text}
            </p>
          )}

          <button className="btn-primary mt-4" disabled={pending} onClick={save}>
            <Save className="w-4 h-4" /> {pending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </>
      )}
    </div>
  );
}
