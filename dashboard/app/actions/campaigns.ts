"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { revalidatePath } from "next/cache";

export type CampaignAudience = "all" | "loyalty" | "inactive";

/**
 * Launch a WhatsApp broadcast campaign.
 * The DASHBOARD is the control plane: it computes recipients, records the
 * campaign + recipients, then triggers the n8n webhook which does the actual
 * sending in the background. The user never touches n8n.
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

  const recipients = (patients ?? []).filter((p) => p.phone && p.phone.trim());
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

  // 4) Trigger n8n to send in the background (fire-and-forget; failure here
  //    doesn't lose the campaign — it stays "running" and can be retried).
  const base = process.env.N8N_BASE_URL;
  if (base) {
    try {
      await fetch(`${base}/webhook/launch-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaign.id, clinic_id: claims.clinic_id }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // n8n unreachable — campaign recorded; can be re-triggered later.
    }
  }

  revalidatePath("/clinic-admin/marketing/campaigns");
  revalidatePath("/clinic-admin/marketing");
  revalidatePath("/clinic-admin");
  return { success: true, recipients: recipients.length };
}
