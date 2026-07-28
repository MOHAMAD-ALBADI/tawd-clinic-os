import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/* Sura answering DMs on TAWD's own Instagram.

   Same idea as the clinic's Sura and deliberately not the same code: that one
   reads a schedule, checks for double-booking and writes an appointment. Pointed
   at this account it would try to book a dental slot for someone asking what
   TAWD costs. Same pipeline shape — receive, think, reply — different brain.

   The persona lives in the database, not here. A business changes how it talks
   far more often than it changes its code, and asking for a deploy to reword a
   sentence means the wording never gets fixed. */

const IG_API = "https://graph.instagram.com/v21.0";

export type Agent = {
  igUserId: string;
  username: string | null;
  persona: string;
  paused: boolean;
};

/** The agent configured for the account a message arrived at.

    Matched on the recipient id rather than "the first active row", because that
    shortcut is exactly what makes a multi-account setup deliver one person's
    messages to another's assistant. */
export async function agentFor(igUserId: string): Promise<Agent | null> {
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("ig_agent")
    .select("ig_user_id, username, persona, paused, is_active")
    .eq("ig_user_id", igUserId).eq("is_active", true).maybeSingle();
  if (!data) return null;
  return {
    igUserId: data.ig_user_id as string,
    username: (data.username as string | null) ?? null,
    persona: data.persona as string,
    paused: !!data.paused,
  };
}

/** The Gemini key already lives in the clinic's channel config, where the
    dashboard's own Ask-Sura reads it from. One key, one place. */
async function geminiKey(): Promise<string | null> {
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("channel_configs")
    .select("config").eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle();
  return ((data?.config ?? {}) as Record<string, string>).gemini_key ?? null;
}

/** The last few turns with this person, oldest first.

    Without it every reply starts from nothing: someone answers "عيادة أسنان،
    ٣ أطباء" to a question the assistant has already forgotten asking. Six turns
    is enough for a DM and short enough to stay cheap. */
async function recentTurns(igUserId: string, senderId: string) {
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("ig_conversations")
    .select("direction, message_text")
    .eq("ig_user_id", igUserId).eq("sender_id", senderId)
    .eq("status", "ok")
    .order("created_at", { ascending: false }).limit(6);
  return (data ?? []).reverse();
}

export async function think(agent: Agent, senderId: string, text: string): Promise<string | null> {
  const key = await geminiKey();
  if (!key) return null;

  const history = await recentTurns(agent.igUserId, senderId);
  const transcript = history
    .map((t) => `${t.direction === "in" ? "الشخص" : "سُرى"}: ${t.message_text}`)
    .join("\n");

  const prompt = `${agent.persona}

${transcript ? `المحادثة حتى الآن:\n${transcript}\n` : ""}
رسالة جديدة من الشخص:
${text}

اكتبي ردّك فقط، بدون مقدمات ولا شرح، وبما لا يتجاوز أربع جُمل.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const out = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Send a DM back.

    Instagram's send endpoint sits on the account itself, not on a page — this is
    the Instagram-Login flavour of the API, where `me` IS the business account. */
export async function reply(senderId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "IG_ACCESS_TOKEN غير مضبوط" };

  try {
    const res = await fetch(`${IG_API}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipient: { id: senderId }, message: { text } }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: body.slice(0, 300) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

export async function log(row: {
  igUserId: string;
  senderId: string;
  direction: "in" | "out";
  text: string;
  messageId?: string | null;
  status?: "ok" | "failed" | "skipped";
  error?: string | null;
}) {
  const sb = await createServiceRoleClient();
  /* Ignore the duplicate-key error on purpose: it is the retry guard doing its
     job, not a failure worth surfacing. */
  await sb.from("ig_conversations").insert({
    ig_user_id: row.igUserId,
    sender_id: row.senderId,
    direction: row.direction,
    message_text: row.text,
    message_id: row.messageId ?? null,
    status: row.status ?? "ok",
    error: row.error ?? null,
  });
}

/** Has this exact message already been handled?

    Meta retries any webhook it did not get a fast 200 from, and an assistant that
    answers the same question three times reads as broken. */
export async function alreadySeen(messageId: string | null): Promise<boolean> {
  if (!messageId) return false;
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("ig_conversations")
    .select("id").eq("message_id", messageId).eq("direction", "in").limit(1);
  return !!data?.length;
}
