"use server";

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { revalidatePath } from "next/cache";

export type CampaignAudience = "all" | "loyalty" | "inactive";

/* One invocation sends at most this many. Everything past it stays pending and
   the campaign keeps its "running" badge, so "متابعة الإرسال" has something real
   to do rather than the list quietly stopping at an arbitrary point. */
const BATCH_LIMIT = 300;
const CONCURRENCY = 5;

/** Meta's own words, in the clinic's language.

    131047 is the one that matters: WhatsApp refuses free-form text to anyone who
    has not messaged the clinic in the last 24 hours. Left as the raw English
    string, a whole campaign reads as "the system is broken" when the truth is
    that Meta requires a pre-approved template for those recipients. */
const WA_ERRORS: Record<number, string> = {
  131047: "خارج نافذة الـ٢٤ ساعة — واتساب يمنع الرسائل الحرة لمن لم يراسل العيادة مؤخراً",
  131026: "الرقم غير مسجّل في واتساب",
  131049: "واتساب حجب الرسالة للحد من الرسائل التسويقية",
  100: "بيانات الإرسال غير صحيحة",
  190: "انتهت صلاحية رمز واتساب — جدّده من الإعدادات",
};

function waReason(payload: unknown): string {
  const err = (payload as { error?: { code?: number; message?: string; error_data?: { details?: string } } })?.error;
  if (!err) return "فشل الإرسال";
  return WA_ERRORS[err.code ?? -1] ?? err.error_data?.details ?? err.message ?? "فشل الإرسال";
}

/** Send whatever is still pending on a campaign, then reconcile its counters.

    Counters are recomputed from campaign_recipients rather than tallied in this
    function: a timeout halfway through would otherwise leave the campaign
    claiming a number of sends that the recipient rows do not support. */
async function sendPending(campaignId: string, clinicId: string) {
  const svc = await createServiceRoleClient();

  const [{ data: campaign }, { data: cfg }] = await Promise.all([
    svc.from("broadcast_campaigns")
      .select("id, template_params").eq("id", campaignId).eq("clinic_id", clinicId).single(),
    svc.from("channel_configs")
      .select("config").eq("clinic_id", clinicId).eq("channel", "whatsapp")
      .eq("is_active", true).limit(1).maybeSingle(),
  ]);

  const conf = cfg?.config as Record<string, string> | null;
  const body = ((campaign?.template_params as { body?: string } | null)?.body ?? "").trim();

  if (!conf?.access_token || !conf?.phone_number_id) {
    /* No sender configured. Say so on every pending row instead of leaving them
       "pending" forever with no explanation anywhere. */
    await svc.from("campaign_recipients")
      .update({ status: "failed", error_message: "واتساب غير مربوط بهذه العيادة" })
      .eq("campaign_id", campaignId).eq("status", "pending");
    await finalise(svc, campaignId);
    return { ok: false as const, reason: "واتساب غير مربوط — اربط القناة من الإعدادات ثم أعد المحاولة" };
  }

  const { data: pending } = await svc.from("campaign_recipients")
    .select("id, phone").eq("campaign_id", campaignId).eq("status", "pending")
    .limit(BATCH_LIMIT);

  const queue = pending ?? [];

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    /* A short gap between batches. The launcher has always promised the clinic
       that sending is paced to avoid a WhatsApp block; this is that pacing. */
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    await Promise.all(
      queue.slice(i, i + CONCURRENCY).map(async (r) => {
        const to = (r.phone ?? "").replace(/\D/g, "");
        if (!to) {
          await svc.from("campaign_recipients")
            .update({ status: "failed", error_message: "رقم غير صالح" }).eq("id", r.id);
          return;
        }
        try {
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${conf.access_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
              signal: AbortSignal.timeout(15_000),
            }
          );
          const payload = await res.json().catch(() => null);
          if (!res.ok) {
            await svc.from("campaign_recipients")
              .update({ status: "failed", error_message: waReason(payload) }).eq("id", r.id);
            return;
          }
          await svc.from("campaign_recipients").update({
            status: "sent",
            wa_message_id: (payload as { messages?: { id?: string }[] })?.messages?.[0]?.id ?? null,
            sent_at: new Date().toISOString(),
          }).eq("id", r.id);
        } catch {
          await svc.from("campaign_recipients")
            .update({ status: "failed", error_message: "انقطاع الاتصال بواتساب" }).eq("id", r.id);
        }
      })
    );
  }

  return finalise(svc, campaignId);
}

type Svc = Awaited<ReturnType<typeof createServiceRoleClient>>;

/** Recount from the recipient rows — the only place that knows what happened. */
async function finalise(svc: Svc, campaignId: string) {
  const counts = await Promise.all(
    (["sent", "failed", "pending"] as const).map(async (s) => {
      const { count } = await svc.from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId).eq("status", s);
      return count ?? 0;
    })
  );
  const [sent, failed, pending] = counts;

  await svc.from("broadcast_campaigns").update({
    sent_count: sent,
    failed_count: failed,
    status: pending > 0 ? "running" : "completed",
    completed_at: pending > 0 ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", campaignId);

  return { ok: true as const, sent, failed, pending };
}

/**
 * Launch a WhatsApp broadcast campaign.
 *
 * The dashboard both records and sends. It used to POST to an n8n webhook named
 * `launch-campaign` — a workflow that does not exist and never did, with the
 * failure swallowed by a bare catch. Every campaign was therefore written as
 * "running", showed 0 of N sent, and stayed that way forever.
 */
export async function launchCampaign(data: {
  name: string;
  message: string;
  audience: CampaignAudience;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  if (!data.name?.trim()) throw new Error("اسم الحملة مطلوب");
  if (!data.message?.trim()) throw new Error("نص الرسالة مطلوب");

  const supabase = await createServerSupabaseClient();

  // 1) Compute recipients (active patients with a phone number)
  let q = supabase
    .from("patients")
    .select("id, phone, loyalty_points")
    .eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .not("phone", "is", null);
  if (data.audience === "loyalty") q = q.gt("loyalty_points", 0);
  const { data: patients, error: pErr } = await q;
  if (pErr) throw new Error(pErr.message);

  let recipients = (patients ?? []).filter((p) => p.phone && p.phone.trim());

  /* "غير النشطين" used to apply no filter at all, so it sent to exactly the same
     people as "كل المرضى" — the clinic paid for a targeted campaign and got a
     blanket one. Inactive means no appointment in the last six months. */
  if (data.audience === "inactive") {
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
    const { data: recent } = await supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", claims.clinic_id)
      .gte("slot_time", since);
    const seen = new Set((recent ?? []).map((a) => a.patient_id as string));
    recipients = recipients.filter((p) => !seen.has(p.id));
  }

  if (recipients.length === 0) throw new Error("لا يوجد مرضى مطابقون لهذا الجمهور");

  // 2) Record the campaign
  const { data: campaign, error: cErr } = await supabase
    .from("broadcast_campaigns")
    .insert({
      clinic_id: claims.clinic_id,
      name: data.name.trim(),
      template_name: "custom",
      template_params: { body: data.message.trim() },
      target_filter: { audience: data.audience },
      status: "running",
      total_recipients: recipients.length,
      sent_count: 0,
      failed_count: 0,
      started_at: new Date().toISOString(),
      created_by: claims.sub,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  // 3) Record recipients
  const { error: rErr } = await supabase.from("campaign_recipients").insert(
    recipients.map((p) => ({
      campaign_id: campaign.id,
      patient_id: p.id,
      phone: p.phone as string,
      status: "pending",
    })),
  );
  if (rErr) {
    await supabase.from("broadcast_campaigns").delete().eq("id", campaign.id).eq("clinic_id", claims.clinic_id);
    throw new Error(rErr.message);
  }

  // 4) Send, and wait for it. Serverless discards anything left running after
  //    the response, so a fire-and-forget send here would send nothing.
  const result = await sendPending(campaign.id, claims.clinic_id);

  revalidatePath("/clinic-admin/marketing/campaigns");
  revalidatePath("/clinic-admin/marketing");
  revalidatePath("/clinic-admin");

  if (!result.ok) throw new Error(result.reason);
  return {
    success: true,
    recipients: recipients.length,
    sent: result.sent,
    failed: result.failed,
    pending: result.pending,
  };
}

/** Send the rest of a campaign — what is left after a batch cap or a retry. */
export async function resumeCampaign(campaignId: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  /* Ownership is checked before the service-role client is used for sending —
     the caller must not be able to drive another clinic's campaign. */
  const sb = await createServerSupabaseClient();
  const { data: owned } = await sb.from("broadcast_campaigns")
    .select("id").eq("id", campaignId).eq("clinic_id", claims.clinic_id).maybeSingle();
  if (!owned) return { ok: false as const, reason: "الحملة غير موجودة" };

  const result = await sendPending(campaignId, claims.clinic_id);
  revalidatePath("/clinic-admin/marketing/campaigns");
  if (!result.ok) return { ok: false as const, reason: result.reason };
  return { ok: true as const, sent: result.sent, failed: result.failed, pending: result.pending };
}

/** Retry only the ones that failed (a token refresh or a fixed number). */
export async function retryFailed(campaignId: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const sb = await createServerSupabaseClient();
  const { data: owned } = await sb.from("broadcast_campaigns")
    .select("id").eq("id", campaignId).eq("clinic_id", claims.clinic_id).maybeSingle();
  if (!owned) return { ok: false as const, reason: "الحملة غير موجودة" };

  const svc = await createServiceRoleClient();
  await svc.from("campaign_recipients")
    .update({ status: "pending", error_message: null })
    .eq("campaign_id", campaignId).eq("status", "failed");

  const result = await sendPending(campaignId, claims.clinic_id);
  revalidatePath("/clinic-admin/marketing/campaigns");
  if (!result.ok) return { ok: false as const, reason: result.reason };
  return { ok: true as const, sent: result.sent, failed: result.failed, pending: result.pending };
}
