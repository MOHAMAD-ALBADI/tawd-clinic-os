import "server-only";

/* Thawani (ثواني) — Oman's card gateway.

   Two different things go through it and they must not be confused:

     a CLINIC paying TAWD for its subscription. This is what the gateway is
     primarily for here, and it is core to the platform.

     a PATIENT paying a clinic invoice. Optional, sold as a module, because most
     clinics take money at the desk and will never want it.

   Both need the same three facts — the base URL, that Thawani prices in baisa,
   and the shape of a checkout URL — so those live here once. Getting the baisa
   conversion wrong is a factor-of-a-thousand error in either direction, which is
   not the sort of thing to copy into two files. */

const BASE = process.env.THAWANI_BASE_URL || "https://uatcheckout.thawani.om";

export type ThawaniConfig = { configured: boolean; live: boolean; baseUrl: string };

export function thawaniConfig(): ThawaniConfig {
  return {
    configured: !!process.env.THAWANI_SECRET_KEY && !!process.env.THAWANI_PUBLIC_KEY,
    /* The UAT host is the sandbox. A clinic being told "paid" for money that
       never moved is worse than no integration, so which environment the keys
       point at is shown rather than assumed. */
    live: !BASE.includes("uat"),
    baseUrl: BASE,
  };
}

/** Our own origin, for the pages Thawani sends the payer back to.

    Not Thawani's base URL — the payer has to land back inside TAWD, or nothing
    on our side ever learns the payment happened. */
export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export type SessionResult =
  | { ok: true; sessionId: string; url: string }
  | { ok: false; reason: string };

/** Open a checkout session. `amountOmr` is in rials; Thawani wants baisa. */
export async function createSession(input: {
  reference: string;
  productName: string;
  amountOmr: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<SessionResult> {
  const secret = process.env.THAWANI_SECRET_KEY;
  const publicKey = process.env.THAWANI_PUBLIC_KEY;
  if (!secret || !publicKey) {
    return { ok: false, reason: "مفاتيح ثواني غير مضبوطة — أضِفها في إعدادات النشر" };
  }
  const baisa = Math.round(input.amountOmr * 1000);
  if (!(baisa > 0)) return { ok: false, reason: "قيمة غير صالحة للدفع" };

  try {
    const res = await fetch(`${BASE}/api/v1/checkout/session`, {
      method: "POST",
      headers: { "thawani-api-key": secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        client_reference_code: input.reference,
        mode: "payment",
        products: [{ name: input.productName, unit_amount: baisa, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as
      { data?: { session_id?: string }; session_id?: string };
    const sessionId = body.data?.session_id ?? body.session_id ?? null;
    if (!res.ok || !sessionId) {
      return { ok: false, reason: "رفضت ثواني إنشاء الجلسة — تحقّق من المفاتيح" };
    }
    return { ok: true, sessionId, url: `${BASE}/pay/${sessionId}?key=${publicKey}` };
  } catch {
    return { ok: false, reason: "تعذّر الوصول إلى ثواني" };
  }
}

export type SessionState =
  | { ok: true; paid: boolean; amountOmr: number; status: string }
  | { ok: false; reason: string };

/** Ask Thawani what actually happened to a session.

    The browser coming back to our success_url is not proof of payment — anyone
    can open that URL. The gateway is asked directly, with the secret key, and
    only its answer books money. */
export async function readSession(sessionId: string): Promise<SessionState> {
  const secret = process.env.THAWANI_SECRET_KEY;
  if (!secret) return { ok: false, reason: "مفاتيح ثواني غير مضبوطة" };
  try {
    const res = await fetch(`${BASE}/api/v1/checkout/session/${sessionId}`, {
      headers: { "thawani-api-key": secret },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: "لم تُعرف الجلسة عند ثواني" };
    const body = (await res.json()) as {
      data?: { payment_status?: string; total_amount?: number };
    };
    const status = body.data?.payment_status ?? "unknown";
    return {
      ok: true,
      paid: status === "paid",
      amountOmr: Math.round(Number(body.data?.total_amount ?? 0)) / 1000,
      status,
    };
  } catch {
    return { ok: false, reason: "تعذّر الوصول إلى ثواني" };
  }
}
