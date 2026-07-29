"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
const THROTTLE_MINUTES = 15;

/** TAWD's own error tracker — the Sentry-equivalent, built in-house because Sentry's
    free signup is geo-blocked for the founder's region. Catches what escapes React's
    render boundary (window.onerror / unhandledrejection, wired via ErrorTracker) and
    React render errors themselves (wired via app/global-error.tsx). Writes to the
    existing `tawd_error_logs` table and emails the founder via the same Resend
    key/address n8n's WF-ErrorHandler already uses (channel_configs.config).
    UNAUTHENTICATED-SAFE: must work on /login and the public /book pages too, so it
    uses the service-role client and never throws — a logging failure must never
    cascade into a second crash. */
export async function logAppError(input: {
  message: string;
  stack?: string;
  severity?: ErrorSeverity;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = await createServiceRoleClient();
    const message = (input.message || "خطأ غير معروف").slice(0, 2000);

    const { data: recent } = await sb
      .from("tawd_error_logs")
      .select("id")
      .eq("workflow_id", "dashboard-app")
      .eq("error_message", message)
      .gte("created_at", new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString())
      .limit(1);
    const shouldEmail = !recent?.length;

    await sb.from("tawd_error_logs").insert({
      workflow_id: "dashboard-app",
      error_message: message,
      error_stack: input.stack?.slice(0, 4000) ?? null,
      severity: input.severity ?? "medium",
      context: input.context ?? null,
      resolved: false,
    });

    if (shouldEmail) await sendAlertEmail(sb, message, input.stack, input.context);
  } catch {
    /* logging must never throw */
  }
}

async function sendAlertEmail(
  sb: Awaited<ReturnType<typeof createServiceRoleClient>>,
  message: string,
  stack?: string,
  context?: Record<string, unknown>
) {
  try {
    /* Platform keys from the platform table, not from a clinic's channel row. */
    const secrets = await platformSecrets();
    if (!secrets.resendKey || !secrets.alertEmail) return;
    const conf = { resend_key: secrets.resendKey, alert_email: secrets.alertEmail };

    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    const html = `
      <div style="font-family:sans-serif;direction:rtl;text-align:right">
        <h2 style="color:#e11d48">🚨 خطأ في لوحة تحكم طود</h2>
        <p><b>الرسالة:</b> ${esc(message)}</p>
        ${context ? `<p><b>السياق:</b> ${esc(JSON.stringify(context))}</p>` : ""}
        ${stack ? `<pre style="background:#f4f4f5;padding:12px;border-radius:8px;overflow:auto;direction:ltr;text-align:left;font-size:12px">${esc(stack.slice(0, 1500))}</pre>` : ""}
      </div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${conf.resend_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "TAWD Alerts <onboarding@resend.dev>",
        to: [conf.alert_email],
        subject: "🚨 خطأ في لوحة تحكم طود",
        html,
      }),
    });
  } catch {
    /* best-effort */
  }
}

/** Founder marks a dashboard-app error as reviewed. */
export async function resolveAppError(id: string) {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) return { ok: false as const, reason: "غير مصرح" };
  const sb = await createServiceRoleClient();
  const { error } = await sb.from("tawd_error_logs")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id).eq("workflow_id", "dashboard-app");
  if (error) return { ok: false as const, reason: "تعذّر التحديث" };
  revalidatePath("/platform-admin/automation");
  return { ok: true as const };
}

/** Close a Sura workflow error once its cause is dealt with.

    The log had no way out: every row was written 'open' and nothing ever closed
    one, so fifty-two accumulated from bugs fixed weeks earlier and the health
    signal built on that count sat permanently red. A light that is always on is
    one everybody learns to ignore, which is exactly when a real fire looks
    ordinary.

    The note is required. "Resolved" with no reason is indistinguishable from
    "dismissed because it was annoying", and six weeks later nobody can tell
    whether the underlying fault was actually fixed. */
export async function resolveSuraError(id: string, note: string) {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) {
    return { ok: false as const, reason: "غير مصرح" };
  }
  const why = note.trim();
  if (why.length < 3) return { ok: false as const, reason: "اكتب سبب الإغلاق" };

  const sb = await createServiceRoleClient();
  const { error } = await sb.from("sura_errors")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: claims.sub,
      resolve_note: why,
    })
    .eq("id", id);
  if (error) return { ok: false as const, reason: "تعذّر التحديث" };

  revalidatePath("/platform-admin/automation");
  revalidatePath("/platform-admin");
  return { ok: true as const };
}
