"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";

/* Editing what Sura says on the TAWD account, and taking over when needed. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

export async function saveAgent(input: {
  igUserId: string;
  persona: string;
  isActive: boolean;
  paused: boolean;
}) {
  await requirePlatform();
  const persona = input.persona.trim();
  /* An empty persona would leave the model with no instructions at all and it
     would answer as a generic assistant, in our name. */
  if (persona.length < 40) {
    return { ok: false as const, reason: "التعليمات قصيرة جداً — اكتب شخصية واضحة" };
  }

  const sb = await createServiceRoleClient();
  const { error } = await sb.from("ig_agent")
    .update({
      persona,
      is_active: input.isActive,
      paused: input.paused,
      updated_at: new Date().toISOString(),
    })
    .eq("ig_user_id", input.igUserId);
  if (error) return { ok: false as const, reason: "تعذّر الحفظ" };

  revalidatePath("/platform-admin/instagram");
  return { ok: true as const };
}

/** Try the persona without messaging anyone.

    Editing a prompt blind and finding out how it reads from a real prospect is
    an expensive way to learn. */
export async function tryAgent(igUserId: string, message: string) {
  await requirePlatform();
  const { agentFor, think } = await import("@/lib/ig-agent");

  const agent = await agentFor(igUserId);
  if (!agent) return { ok: false as const, reason: "الحساب غير مفعّل" };

  /* A fixed sender id keeps rehearsal out of real conversation history. */
  const answer = await think(agent, "__preview__", message.trim());
  if (!answer) return { ok: false as const, reason: "تعذّر توليد رد — تحقّق من مفتاح Gemini" };
  return { ok: true as const, answer };
}
