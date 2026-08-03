import { createServiceRoleClient } from "@/lib/supabase/server";

/* Reading and writing a conversation.
 *
 * Kept out of the route so the route stays about answering, and so the
 * console's own loader and the answering path cannot drift into two
 * different ideas of what a stored turn looks like.
 *
 * Persistence must never be able to fail a reply. If the write fails,
 * the user still gets their answer and we lose a row — the opposite
 * trade, where a database hiccup swallows an answer the model already
 * produced and was already paid for, is indefensible.
 */

export type StoredDoc = { url: string; label: string };
export type StoredFile = { name: string; mime: string };

export type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  doc: StoredDoc | null;
  files: StoredFile[];
  error: string | null;
  created_at: string;
};

export type ConversationHead = {
  id: string;
  title: string;
  updated_at: string;
};

type SB = Awaited<ReturnType<typeof createServiceRoleClient>>;

/** A conversation's first user message becomes its name. */
export function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "محادثة جديدة";
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

export async function listConversations(
  sb: SB, userId: string, clinicId: string, limit = 30,
): Promise<ConversationHead[]> {
  const { data } = await sb
    .from("sura_conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ConversationHead[];
}

export async function loadTurns(
  sb: SB, convId: string, userId: string,
): Promise<Turn[] | null> {
  /* Ownership checked here rather than trusted from the caller. The
     service-role client bypasses RLS, so every read through it has to
     re-state the condition the policy would have applied. */
  const { data: conv } = await sb
    .from("sura_conversations")
    .select("id")
    .eq("id", convId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conv) return null;

  const { data } = await sb
    .from("sura_messages")
    .select("id, role, content, doc, files, error, created_at")
    .eq("conv_id", convId)
    .order("created_at", { ascending: true })
    .limit(200);

  return (data ?? []).map((m) => ({
    id: m.id as string,
    role: m.role as "user" | "assistant",
    content: (m.content as string) ?? "",
    doc: (m.doc as StoredDoc | null) ?? null,
    files: ((m.files as StoredFile[]) ?? []),
    error: (m.error as string | null) ?? null,
    created_at: m.created_at as string,
  }));
}

/** Creates the conversation if this is the first turn. Returns its id. */
export async function ensureConversation(
  sb: SB, convId: string | null, userId: string, clinicId: string, firstQuestion: string,
): Promise<string | null> {
  try {
    if (convId) {
      const { data } = await sb
        .from("sura_conversations")
        .select("id")
        .eq("id", convId)
        .eq("user_id", userId)
        .maybeSingle();
      if (data) return convId;
      /* An id we do not own, or one that has been deleted. Falling
         through to create a fresh conversation is better than refusing
         the question over a stale tab. */
    }
    const { data } = await sb
      .from("sura_conversations")
      .insert({ user_id: userId, clinic_id: clinicId, title: titleFrom(firstQuestion) })
      .select("id")
      .single();
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}

export async function saveTurn(
  sb: SB,
  convId: string,
  clinicId: string,
  turn: {
    role: "user" | "assistant";
    content: string;
    doc?: StoredDoc | null;
    files?: StoredFile[];
    error?: string | null;
  },
): Promise<void> {
  try {
    await sb.from("sura_messages").insert({
      conv_id: convId,
      clinic_id: clinicId,
      role: turn.role,
      content: turn.content.slice(0, 20_000),
      doc: turn.doc ?? null,
      files: turn.files ?? [],
      error: turn.error ?? null,
    });
    await sb
      .from("sura_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);
  } catch {
    /* Losing a row is survivable; losing the answer is not. */
  }
}

export async function deleteConversation(
  sb: SB, convId: string, userId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("sura_conversations")
    .delete()
    .eq("id", convId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}
