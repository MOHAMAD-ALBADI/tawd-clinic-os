"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { MessageCircle, CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import { completeEmbeddedSignup } from "@/app/actions/embedded-signup";

/* The one-button way a clinic connects its own WhatsApp number.

   Meta's popup reports the ids it created over postMessage, and the SDK returns
   a one-time code separately through its callback. BOTH are needed and they
   arrive by different routes at different moments, so each is stashed as it
   lands and the server is called once the pair is complete — waiting inside
   either handler for the other would deadlock. */

declare global {
  interface Window {
    FB?: {
      init: (o: Record<string, unknown>) => void;
      login: (cb: (r: { authResponse?: { code?: string } }) => void, o: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type Result = {
  displayNumber: string | null;
  verifiedName: string | null;
  coexists: boolean;
  warnings: string[];
};

export function EmbeddedSignup({
  clinicId,
  appId,
  configId,
}: {
  clinicId: string;
  appId: string | null;
  configId: string | null;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [done, setDone] = useState<Result | null>(null);

  /* Refs, not state: both halves can arrive within the same tick and a state
     update would not be visible to the other handler in time. */
  const codeRef = useRef<string | null>(null);
  const idsRef = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);
  const sentRef = useRef(false);

  function tryFinish() {
    if (sentRef.current) return;
    const code = codeRef.current;
    const ids = idsRef.current;
    if (!code || !ids) return;
    sentRef.current = true;

    setMsg({ text: "جارٍ إتمام الربط مع ميتا…" });
    start(async () => {
      const r = await completeEmbeddedSignup({ clinicId, code, ...ids });
      if (!r.ok) {
        setMsg({ text: r.reason, bad: true });
        /* Let the operator try again — the code is spent, so the whole popup
           has to be reopened, and a stuck flag would prevent that silently. */
        sentRef.current = false;
        codeRef.current = null;
        idsRef.current = null;
        return;
      }
      setMsg(null);
      setDone({
        displayNumber: r.displayNumber,
        verifiedName: r.verifiedName,
        coexists: r.coexists,
        warnings: r.warnings,
      });
      router.refresh();
    });
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      /* Only Meta's own frames. Without this check any page could post a
         fabricated WABA id and have it attached to a clinic. */
      if (!/^https:\/\/(www\.)?facebook\.com$/.test(e.origin)) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (d.event === "FINISH" || d.event === "FINISH_ONLY_WABA") {
          idsRef.current = {
            wabaId: String(d.data?.waba_id ?? ""),
            phoneNumberId: String(d.data?.phone_number_id ?? ""),
          };
          tryFinish();
        } else if (d.event === "CANCEL") {
          setMsg({ text: `أُلغي الربط عند خطوة: ${d.data?.current_step ?? "غير معروفة"}`, bad: true });
        } else if (d.event === "ERROR") {
          setMsg({ text: d.data?.error_message ?? "خطأ من ميتا أثناء الربط", bad: true });
        }
      } catch {
        /* not our message */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  function launch() {
    if (!window.FB || !configId) return;
    setMsg(null);
    setDone(null);
    codeRef.current = null;
    idsRef.current = null;
    sentRef.current = false;

    window.FB.login(
      (r) => {
        const code = r?.authResponse?.code;
        if (!code) {
          setMsg({ text: "لم يُكمل التفويض — أُغلقت النافذة قبل الموافقة", bad: true });
          return;
        }
        codeRef.current = code;
        tryFinish();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: "3" },
      },
    );
  }

  if (!appId || !configId) {
    return (
      <div className="panel" style={{ padding: "1.25rem" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-2">
          <MessageCircle className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          ربط واتساب العيادة بنقرة
        </h3>
        <p className="flex items-start gap-1.5 text-[12px]" style={{ color: "#fbbf24" }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          غير مُهيّأ بعد — ينقص{" "}
          {[!appId && "NEXT_PUBLIC_META_APP_ID", !configId && "NEXT_PUBLIC_META_ES_CONFIG_ID"]
            .filter(Boolean)
            .join(" و ")}{" "}
          في متغيّرات البيئة
        </p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
          setReady(true);
        }}
      />

      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
        <MessageCircle className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        ربط واتساب العيادة بنقرة
      </h3>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
        صاحب العيادة يسجّل دخوله بحساب أعماله ويختار رقمه — لا يفتح لوحة ميتا ولا ينسخ معرّفات
      </p>

      {done ? (
        <div
          className="rounded-xl px-3 py-2.5"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.07)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)" }}
        >
          <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--accent-1)" }}>
            <CheckCircle2 className="w-4 h-4" /> رُبط {done.displayNumber ?? ""}
          </p>
          {done.verifiedName && (
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
              الاسم المعتمد: {done.verifiedName}
            </p>
          )}
          <p className="text-[11px] mt-1.5" style={{ color: done.coexists ? "#34d399" : "#fbbf24" }}>
            {done.coexists
              ? "تطبيق واتساب الأعمال ما زال يعمل على هذا الرقم — سُرى تعمل بجانبه"
              : "الرقم انتقل للسحابة — تطبيق واتساب الأعمال توقّف عليه"}
          </p>
          {done.warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 text-[11px] mt-1.5" style={{ color: "#fbbf24" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
            </p>
          ))}
        </div>
      ) : (
        <>
          {msg && (
            <p
              className="flex items-start gap-1.5 text-[12px] mb-2.5 font-semibold"
              style={{ color: msg.bad ? "#fda4b4" : "var(--text-2)" }}
            >
              {msg.bad && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {msg.text}
            </p>
          )}
          <button className="btn-primary w-full" disabled={!ready || busy} onClick={launch}>
            <Plug className="w-4 h-4" />
            {busy ? "جارٍ الربط…" : ready ? "ربط واتساب العيادة" : "جارٍ تحميل ميتا…"}
          </button>
        </>
      )}
    </div>
  );
}
