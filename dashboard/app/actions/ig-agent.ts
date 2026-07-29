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

/** Connect another Instagram account — a clinic's, or a second one of ours.

    The id has to be the one Instagram puts in the webhook's `recipient`, not the
    one `/me` returns. One account has both, they are different numbers, and
    using the wrong one produces an assistant that receives everything and
    answers nothing. So it is not typed: the token is exchanged for it here. */
export async function connectInstagram(input: {
  accessToken: string;
  persona: string;
  clinicId?: string | null;
}) {
  await requirePlatform();
  const token = input.accessToken.trim();
  const persona = input.persona.trim();
  if (!token) return { ok: false as const, reason: "رمز الوصول مطلوب" };
  if (persona.length < 40) {
    return { ok: false as const, reason: "التعليمات قصيرة جداً — اكتب شخصية واضحة" };
  }

  let igUserId: string;
  let username: string | null = null;
  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=user_id,username`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(12_000) },
    );
    const body = (await res.json().catch(() => null)) as
      | { user_id?: string; id?: string; username?: string; error?: { message?: string } }
      | null;
    if (!res.ok || !body || body.error) {
      return { ok: false as const, reason: body?.error?.message ?? "الرمز غير صالح" };
    }
    /* user_id is the IGSID — the one the webhook sends. `id` is the app-scoped
       id, which is what /me returns by default and is the wrong number here. */
    igUserId = (body.user_id ?? "").toString();
    username = body.username ?? null;
    if (!igUserId) {
      return { ok: false as const, reason: "لم تُرجع ميتا معرّف الحساب (user_id) — تأكد أن الرمز من نوع Instagram Login" };
    }
  } catch {
    return { ok: false as const, reason: "تعذّر الاتصال بإنستغرام" };
  }

  const sb = await createServiceRoleClient();
  const { error } = await sb.from("ig_agent").upsert(
    {
      ig_user_id: igUserId,
      username,
      access_token: token,
      persona,
      clinic_id: input.clinicId ?? null,
      is_active: true,
      paused: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ig_user_id" },
  );
  if (error) return { ok: false as const, reason: `تعذّر الحفظ: ${error.message}` };

  revalidatePath("/platform-admin/instagram");
  if (input.clinicId) revalidatePath(`/platform-admin/clinics/${input.clinicId}`);
  return { ok: true as const, igUserId, username };
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
