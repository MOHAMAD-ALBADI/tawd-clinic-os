"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
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
    const { data: cfg } = await sb
      .from("channel_configs").select("config")
      .eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle();
    const conf = cfg?.config as Record<string, string> | null;
    if (!conf?.resend_key || !conf?.alert_email) return;

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
