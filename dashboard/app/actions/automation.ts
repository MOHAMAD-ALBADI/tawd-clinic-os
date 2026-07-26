"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { n8nPost, n8nErrorMessage } from "@/lib/n8n";
import { revalidatePath } from "next/cache";

/* Turning automations on and off.

   The automation page could show which workflows were running and could not
   change any of them, so the only way to stop a misbehaving workflow was to
   open n8n directly. These are the clinic's reminders, recalls and Sura
   pipeline — the operator needs the switch where the failures are displayed. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

/** WF-05 runs Sura's WhatsApp pipeline and is edited only through its JSON
    definition; toggling it from here is allowed, but it is called out in the UI
    because switching it off silences the receptionist for every clinic. */
export async function setWorkflowActive(workflowId: string, active: boolean) {
  await requirePlatform();
  if (!workflowId) return { ok: false as const, reason: "معرّف الووركفلو مفقود" };

  const res = await n8nPost(`workflows/${workflowId}/${active ? "activate" : "deactivate"}`);
  if (!res.ok) return { ok: false as const, reason: n8nErrorMessage(res.reason) };

  revalidatePath("/platform-admin/automation");
  revalidatePath("/platform-admin");
  return { ok: true as const };
}
