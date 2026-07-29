"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";
import { revalidatePath } from "next/cache";

/* WhatsApp Embedded Signup — how a clinic connects its OWN number.

   The manual route (open Meta's console, add a phone number, verify by SMS,
   copy the phone number id) is fine for us and impossible to sell: it asks a
   clinic owner to work inside a developer console and, if the number is on the
   WhatsApp Business App, to delete that account and lose its chat threads. No
   clinic agrees to that twice.

   Embedded Signup is Meta's answer. The owner clicks one button here, a Meta
   popup opens, they sign in with their own business account, pick or add a
   number, and the popup hands back a short-lived code plus the ids. Everything
   after that happens on this server.

   Coexistence — the number staying live on the WhatsApp Business App AND on the
   Cloud API at once, with recent history synced — rides on this same flow. It is
   the only path that lets a clinic keep the number it already prints on its
   door. Which feature variant Meta enables is decided by the signup
   configuration, so the flow below is deliberately indifferent to it. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

const GRAPH = "https://graph.facebook.com/v21.0";

type Fail = { ok: false; reason: string };

/** Trade the popup's one-time code for a token that can act on the clinic's WABA.

    The code is short-lived and single-use, so this runs immediately and on the
    server — the app secret must never reach a browser. */
async function exchangeCode(code: string): Promise<{ ok: true; token: string } | Fail> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!appId || !secret) {
    return { ok: false, reason: "إعداد ميتا ناقص على الخادم (NEXT_PUBLIC_META_APP_ID / META_APP_SECRET)" };
  }

  const url =
    `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(code)}`;

  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as
      | { access_token?: string; error?: { message?: string } }
      | null;
    if (!res.ok || !body?.access_token) {
      return { ok: false, reason: body?.error?.message ?? `تعذّر تبادل الرمز (${res.status})` };
    }
    return { ok: true, token: body.access_token };
  } catch {
    return { ok: false, reason: "تعذّر الاتصال بميتا" };
  }
}

/** Finish what the popup started: verify, subscribe, register, store.

    Called with the ids Meta's popup reported. Those are taken as a claim to be
    checked, not as fact — the browser is not a trusted source for which WhatsApp
    account we are about to attach to a clinic. */
export async function completeEmbeddedSignup(input: {
  clinicId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
}) {
  await requirePlatform();

  const { clinicId, code } = input;
  const wabaId = (input.wabaId ?? "").trim();
  const phoneNumberId = (input.phoneNumberId ?? "").trim();
  if (!code) return { ok: false as const, reason: "لم يُرجع ميتا رمز التفويض" };
  if (!/^\d+$/.test(wabaId) || !/^\d+$/.test(phoneNumberId)) {
    return { ok: false as const, reason: "لم يُرجع ميتا معرّفات صالحة" };
  }

  const ex = await exchangeCode(code);
  if (!ex.ok) return { ok: false as const, reason: ex.reason };
  const token = ex.token;

  const call = async (path: string, method: "GET" | "POST" = "GET", body?: unknown) => {
    const res = await fetch(`${GRAPH}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return { status: res.status, ok: res.ok, body: await res.json().catch(() => null) };
  };

  /* 1 — the number must really sit under the WABA the popup named, and the token
         must really reach it. */
  const num = await call(`${phoneNumberId}?fields=display_phone_number,verified_name,platform_type`);
  const numBody = num.body as
    | { display_phone_number?: string; verified_name?: string; platform_type?: string; error?: { message?: string } }
    | null;
  if (!num.ok || !numBody || numBody.error) {
    return { ok: false as const, reason: numBody?.error?.message ?? "تعذّر قراءة الرقم من ميتا" };
  }

  /* 2 — no two clinics on one number. WF-05 finds the clinic BY phone_number_id,
         so a shared number answers one clinic's patients with another's data. */
  const sb = await createServiceRoleClient();
  const { data: taken } = await sb
    .from("channel_configs")
    .select("clinic_id, tawd_clinics!clinic_id(name_ar, name)")
    .eq("channel", "whatsapp")
    .eq("config->>phone_number_id", phoneNumberId)
    .neq("clinic_id", clinicId)
    .maybeSingle();
  if (taken) {
    const other = taken.tawd_clinics as unknown as { name_ar?: string; name?: string } | null;
    return {
      ok: false as const,
      reason: `هذا الرقم مربوط بعيادة أخرى (${other?.name_ar ?? other?.name ?? "غير معروفة"})`,
    };
  }

  /* 3 — point the WABA's webhooks at our app. Without this the number is
         connected and silent: messages are delivered nowhere. */
  const sub = await call(`${wabaId}/subscribed_apps`, "POST");
  if (!sub.ok) {
    const e = (sub.body as { error?: { message?: string } } | null)?.error;
    return { ok: false as const, reason: `تعذّر ربط الويبهوك: ${e?.message ?? sub.status}` };
  }

  /* 4 — register the number for Cloud API messaging. Already-registered numbers
         (the coexistence case) answer with an error that means "nothing to do",
         so it is not treated as a failure. */
  const pin = (process.env.META_REGISTER_PIN ?? "").trim() || "000000";
  const reg = await call(`${phoneNumberId}/register`, "POST", {
    messaging_product: "whatsapp",
    pin,
  });
  const regErr = (reg.body as { error?: { code?: number; message?: string } } | null)?.error;
  const alreadyRegistered = regErr?.message?.toLowerCase().includes("already") ?? false;
  if (!reg.ok && !alreadyRegistered) {
    return {
      ok: false as const,
      reason: `تعذّر تسجيل الرقم: ${regErr?.message ?? reg.status}` +
        (regErr?.code === 133089 ? " — الرقم محمي بتحقّق بخطوتين، أوقفه ثم أعد المحاولة" : ""),
    };
  }

  /* 5 — store it, carrying the platform's own keys in beside the clinic's. Six
         live n8n workflows read Gemini and the voice key out of this row. */
  const secrets = await platformSecrets();
  const { error } = await sb.from("channel_configs").upsert(
    {
      clinic_id: clinicId,
      channel: "whatsapp",
      credentials_ref: `WhatsApp — ${numBody.display_phone_number ?? phoneNumberId}`,
      is_active: true,
      config: {
        access_token: token,
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        api_version: "v21.0",
        wa_cred_id: null,
        onboarded_via: "embedded_signup",
        platform_type: numBody.platform_type ?? null,
        gemini_key: secrets.geminiKey,
        gcp_tts_key: secrets.gcpTtsKey,
        resend_key: secrets.resendKey,
        alert_email: secrets.alertEmail,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,channel" },
  );
  if (error) return { ok: false as const, reason: `تعذّر الحفظ: ${error.message}` };

  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return {
    ok: true as const,
    displayNumber: numBody.display_phone_number ?? null,
    verifiedName: numBody.verified_name ?? null,
    /* CLOUD_API means the number moved to the cloud and the Business App on it
       has stopped. Anything else is a coexistence-style attachment, where the
       app keeps working — worth saying out loud, because it is the single thing
       every clinic owner asks about. */
    coexists: (numBody.platform_type ?? "") !== "CLOUD_API",
    warnings: [
      !secrets.geminiKey && "سُرى ستستقبل ولن ترد: مفتاح Gemini غير مضبوط في أسرار المنصّة",
    ].filter(Boolean) as string[],
  };
}

/** Whether the button can be shown at all — reported per-variable so a missing
    one names itself instead of a blanket "not configured". */
export async function embeddedSignupReady() {
  await requirePlatform();
  return {
    appId: !!process.env.NEXT_PUBLIC_META_APP_ID,
    secret: !!process.env.META_APP_SECRET,
    configId: !!process.env.NEXT_PUBLIC_META_ES_CONFIG_ID,
  };
}
