"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import type { AudienceFilter, Recipient } from "@/lib/broadcast-audience";
import { audienceLabel, resolveBody } from "@/lib/broadcast-audience";

/* Messaging every clinic owner at once.

   The previous version was a textarea and a Send button: no record of what was
   sent, no way to see who received it, and three fixed audience buttons. This
   keeps the same one-shot simplicity but makes each send an object that can be
   looked at afterwards — which matters the first time a customer says "nobody
   told me about the price change". */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

type ClinicRow = {
  id: string; name: string; name_ar: string | null; phone: string | null;
  plan: string; status: string;
};

/** Resolve a segment into the clinics it actually hits.

    Run on the server for both the preview and the send, from the same function,
    so the count shown on screen is the count that gets messaged. */
async function resolveAudience(filter: AudienceFilter): Promise<{
  recipients: Recipient[];
  skippedNoPhone: number;
}> {
  const sb = await createServiceRoleClient();

  let q = sb.from("tawd_clinics").select("id, name, name_ar, phone, plan, status");
  if (filter.statuses?.length) q = q.in("status", filter.statuses);
  if (filter.plans?.length) q = q.in("plan", filter.plans);
  const { data: clinics } = await q;

  const rows = (clinics ?? []) as ClinicRow[];
  const ids = rows.map((c) => c.id);
  if (!ids.length) return { recipients: [], skippedNoPhone: 0 };

  const [{ data: subs }, { data: wa }, { data: appts }] = await Promise.all([
    sb.from("tawd_subscriptions")
      .select("clinic_id, status, trial_ends_at, current_period_end").in("clinic_id", ids),
    sb.from("channel_configs")
      .select("clinic_id, is_active").eq("channel", "whatsapp").in("clinic_id", ids),
    /* "Idle" means no appointment booked recently — the one signal that
       separates a clinic using the system from a clinic that signed up. */
    sb.from("appointments")
      .select("clinic_id, created_at").in("clinic_id", ids)
      .gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const lastActivity = new Map<string, number>();
  for (const a of appts ?? []) {
    const t = new Date(a.created_at as string).getTime();
    const prev = lastActivity.get(a.clinic_id as string) ?? 0;
    if (t > prev) lastActivity.set(a.clinic_id as string, t);
  }
  const waOn = new Set((wa ?? []).filter((r) => r.is_active).map((r) => r.clinic_id as string));

  const now = Date.now();
  let skippedNoPhone = 0;
  const recipients: Recipient[] = [];

  for (const c of rows) {
    if (filter.whatsappLinkedOnly && !waOn.has(c.id)) continue;

    if (filter.idleDays && filter.idleDays > 0) {
      const last = lastActivity.get(c.id);
      const idle = last ? (now - last) / 86_400_000 : Infinity;
      if (idle < filter.idleDays) continue;
    }

    const s = (subs ?? []).find((x) => x.clinic_id === c.id);
    const end = s ? (s.status === "trial" ? s.trial_ends_at : s.current_period_end) : null;
    const daysLeft = end ? Math.ceil((new Date(end as string).getTime() - now) / 86_400_000) : null;

    if (filter.expiringWithinDays != null) {
      if (daysLeft === null || daysLeft > filter.expiringWithinDays) continue;
    }

    /* A clinic with no phone number cannot be reached and is reported rather
       than silently dropped — otherwise "sent to 12" quietly means 12 of 20. */
    const phone = (c.phone ?? "").replace(/\D/g, "");
    if (!phone) { skippedNoPhone++; continue; }

    recipients.push({
      clinicId: c.id,
      label: (c.name_ar ?? c.name) as string,
      phone,
      plan: c.plan,
      status: c.status,
      daysLeft,
    });
  }

  return { recipients, skippedNoPhone };
}

/** What this segment hits right now — used to fill the audience panel. */
export async function previewAudience(filter: AudienceFilter) {
  await requirePlatform();
  const { recipients, skippedNoPhone } = await resolveAudience(filter);
  return {
    ok: true as const,
    skippedNoPhone,
    recipients: recipients.map((r) => ({
      clinicId: r.clinicId, label: r.label, plan: r.plan,
      status: r.status, daysLeft: r.daysLeft,
    })),
  };
}

async function sendOne(
  conf: Record<string, string>, to: string, body: string,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conf.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    if (res.ok) return { sent: true };
    /* Meta's own reason, not "HTTP 400" — outside the 24-hour window it says so,
       and that is the difference between a bug and a policy. */
    const j = await res.json().catch(() => null);
    const detail = j?.error?.message ? String(j.error.message).slice(0, 160) : `HTTP ${res.status}`;
    return { sent: false, error: detail };
  } catch {
    return { sent: false, error: "تعذّر الاتصال بواتساب" };
  }
}

async function platformSender() {
  const sb = await createServiceRoleClient();
  const { data: cfg } = await sb.from("channel_configs")
    .select("config").eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle();
  return (cfg?.config as Record<string, string> | null) ?? null;
}

/** Send the message to one number — yours — before sending it to customers. */
export async function sendBroadcastTest(body: string, phone: string) {
  await requirePlatform();
  const text = body.trim();
  if (!text) return { ok: false as const, reason: "الرسالة فارغة" };
  const to = phone.replace(/\D/g, "");
  if (!to) return { ok: false as const, reason: "أدخل رقماً للاختبار" };

  const conf = await platformSender();
  if (!conf?.access_token || !conf?.phone_number_id) {
    return { ok: false as const, reason: "لا يوجد مرسل واتساب مفعّل للمنصة" };
  }

  const r = await sendOne(conf, to, resolveBody(text, {
    clinicId: "", label: "عيادة تجريبية", phone: to, plan: "pro", status: "active", daysLeft: 7,
  }));
  return r.sent ? { ok: true as const } : { ok: false as const, reason: r.error ?? "لم تُرسَل" };
}

export async function sendBroadcast(input: {
  title: string;
  body: string;
  filter: AudienceFilter;
}) {
  const claims = await requirePlatform();
  const sb = await createServiceRoleClient();

  const title = input.title.trim() || "رسالة بلا عنوان";
  const text = input.body.trim();
  if (!text) return { ok: false as const, reason: "الرسالة فارغة" };

  const conf = await platformSender();
  if (!conf?.access_token || !conf?.phone_number_id) {
    return { ok: false as const, reason: "لا يوجد مرسل واتساب مفعّل للمنصة" };
  }

  const { recipients, skippedNoPhone } = await resolveAudience(input.filter);
  if (!recipients.length) {
    return { ok: false as const, reason: "لا عيادة تطابق هذا الجمهور — عدّل الفلاتر" };
  }

  /* The record is written before the first message goes out. A crash halfway
     through leaves a broadcast row with partial results, which is recoverable;
     writing it afterwards would leave messages sent and no trace of them. */
  const { data: bc, error: bcErr } = await sb.from("platform_broadcasts").insert({
    title,
    body: text,
    audience: input.filter as unknown as Record<string, unknown>,
    audience_label: audienceLabel(input.filter),
    total: recipients.length,
    sent_by: claims.sub,
  }).select("id").single();
  if (bcErr || !bc) return { ok: false as const, reason: "تعذّر تسجيل الحملة" };

  const results: { clinicId: string; label: string; sent: boolean; error?: string }[] = [];
  const targetRows: Record<string, unknown>[] = [];

  for (const r of recipients) {
    const resolved = resolveBody(text, r);
    const out = await sendOne(conf, r.phone, resolved);
    results.push({ clinicId: r.clinicId, label: r.label, sent: out.sent, error: out.error });
    targetRows.push({
      broadcast_id: bc.id,
      clinic_id: r.clinicId,
      clinic_label: r.label,
      phone: r.phone,
      resolved_body: resolved,
      sent: out.sent,
      error: out.error ?? null,
    });
  }

  const sentCount = results.filter((r) => r.sent).length;
  await sb.from("platform_broadcast_targets").insert(targetRows);
  await sb.from("platform_broadcasts").update({
    sent_count: sentCount,
    failed_count: results.length - sentCount,
  }).eq("id", bc.id);

  revalidatePath("/platform-admin/broadcast");
  return { ok: true as const, broadcastId: bc.id as string, sentCount, results, skippedNoPhone };
}

/** Per-recipient outcome for one past send. */
export async function broadcastDetail(broadcastId: string) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("platform_broadcast_targets")
    .select("clinic_label, phone, sent, error, resolved_body")
    .eq("broadcast_id", broadcastId)
    .order("sent", { ascending: true });
  return { ok: true as const, targets: data ?? [] };
}
