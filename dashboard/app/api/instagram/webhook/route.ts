import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { agentFor, think, reply, log, alreadySeen } from "@/lib/ig-agent";

/* Where Instagram delivers DMs sent to TAWD's account.

   Two jobs on one URL, which is Meta's design, not a choice:
     GET  — the one-off handshake when the webhook is first subscribed
     POST — every message from then on */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The subscription handshake. Meta sends a challenge and expects it echoed back
    verbatim, but only if the token matches the one configured in the console. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.IG_VERIFY_TOKEN;

  if (
    expected &&
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === expected
  ) {
    /* Plain text, not JSON — Meta compares the body byte for byte. */
    return new NextResponse(p.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Is this really from Meta?

    The URL is public, so without checking the signature anyone could post a
    fabricated message and make the assistant reply to a stranger — on our
    account, in our voice, burning our tokens. The header is an HMAC of the raw
    body with the app secret, so the body must be read as text and hashed BEFORE
    it is parsed. */
function signed(raw: string, header: string | null): boolean {
  const secret = process.env.IG_APP_SECRET;
  /* No secret configured means we cannot verify. Refuse rather than trust:
     an unauthenticated writer to this endpoint is worse than a dead one. */
  if (!secret || !header) return false;

  const sent = header.startsWith("sha256=") ? header.slice(7) : header;
  const mine = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(sent, "hex");
  const b = Buffer.from(mine, "hex");
  /* Constant-time: a plain === leaks how much of the signature was right. */
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Write down something that arrived but went nowhere.

    Every reason a webhook fails to produce a reply looks identical from the
    outside — nothing happens. These rows are what turn "it doesn't work" into a
    specific cause. */
async function trace(kind: string, raw: string, extra?: string | null) {
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const sb = await createServiceRoleClient();
    await sb.from("ig_conversations").insert({
      ig_user_id: "__trace__",
      sender_id: "__trace__",
      direction: "in",
      message_text: `[${kind}] ${raw.slice(0, 900)}`,
      status: "failed",
      error: extra ? `sig=${extra.slice(0, 60)}` : kind,
    });
  } catch { /* diagnostics must never break the endpoint */ }
}

type Entry = {
  id?: string;
  messaging?: {
    sender?: { id?: string };
    recipient?: { id?: string };
    message?: { mid?: string; text?: string; is_echo?: boolean };
  }[];
};

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!signed(raw, req.headers.get("x-hub-signature-256"))) {
    /* Recorded, not just refused.

       A silent 403 is indistinguishable from Meta never calling at all, and
       those two have completely different fixes. Writing the rejection down is
       the difference between diagnosing this in one attempt and guessing. */
    await trace("rejected-signature", raw, req.headers.get("x-hub-signature-256"));
    return new NextResponse("bad signature", { status: 403 });
  }

  let body: { entry?: Entry[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  /* Meta retries anything that is not answered quickly, so the work happens
     after the 200 rather than before it. A slow reply here turns one message
     into three. */
  /* Serverless kills the function as soon as the response is returned, so a
     queued microtask can be dropped before it ever runs. The work is awaited
     instead — Meta allows a few seconds, and a reply that never happened is
     worse than one that took two. */
  await handle(body).catch(async (e) => {
    await trace("handler-threw", e instanceof Error ? e.message : String(e));
  });
  return NextResponse.json({ ok: true });
}

async function handle(body: { entry?: Entry[] }) {
  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      const senderId = m.sender?.id;
      const recipientId = m.recipient?.id ?? entry.id;
      const text = m.message?.text?.trim();
      const mid = m.message?.mid ?? null;

      /* Our own outgoing messages come back as echoes. Answering them would put
         the assistant in a conversation with herself. */
      if (m.message?.is_echo) continue;
      if (!senderId || !recipientId || !text) continue;
      if (await alreadySeen(mid)) continue;

      const agent = await agentFor(recipientId);
      if (!agent) {
        /* The commonest silent failure: the id Instagram puts in `recipient`
           is not the id the agent row was created with. Recording the id we
           actually received is what makes that fixable in one step instead of
           a guessing game. */
        await trace("no-agent-for-recipient", JSON.stringify({ recipientId, senderId, text }));
        continue;
      }

      await log({
        igUserId: recipientId, senderId, direction: "in", text, messageId: mid,
      });

      /* A human has taken the conversation over. Staying quiet is the whole
         point of the switch. */
      if (agent.paused) {
        await log({
          igUserId: recipientId, senderId, direction: "out",
          text: "(موقوفة — الرد اليدوي مفعّل)", status: "skipped",
        });
        continue;
      }

      const answer = await think(agent, senderId, text);
      if (!answer) {
        await log({
          igUserId: recipientId, senderId, direction: "out",
          text: "(تعذّر توليد رد)", status: "failed", error: "gemini",
        });
        continue;
      }

      const sent = await reply(senderId, answer);
      await log({
        igUserId: recipientId, senderId, direction: "out", text: answer,
        status: sent.ok ? "ok" : "failed", error: sent.error ?? null,
      });
    }
  }
}
