import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { readSession } from "@/lib/thawani";

/* The one path that turns a Thawani session into a recorded platform payment.

   Two things confirm a subscription payment — the browser returning to our
   callback, and the manager pressing "check payment" when that redirect was lost
   — and a third would be a retry. All of them come through here, so one payment
   cannot be booked twice.

   It lives outside app/actions deliberately. Every exported async function in a
   "use server" file is a network endpoint with an action id; a function that
   writes money into the platform's books should not be reachable by posting to
   the app, even though it verifies with the gateway first. */

const money = (v: number) => Math.round((Number(v) || 0) * 1000) / 1000;

export type Settlement = { settled: boolean; amount: number };

export async function settleSubscriptionSession(sessionId: string): Promise<Settlement> {
  const sb = await createServiceRoleClient();

  const { data: link } = await sb.from("payment_links")
    .select("id, clinic_id, platform_invoice_id, amount, status")
    .eq("thawani_session_id", sessionId).maybeSingle();
  if (!link?.platform_invoice_id) return { settled: false, amount: 0 };

  /* The payer's browser arriving at our success URL is not proof of anything —
     anyone can open that address. Only the gateway's own answer books money. */
  const state = await readSession(sessionId);
  if (!state.ok || !state.paid) return { settled: false, amount: 0 };

  /* The gateway's figure wins over ours: it is what the card was actually
     charged, and if the two disagree the bank's number is the true one. */
  const amount = money(state.amountOmr > 0 ? state.amountOmr : Number(link.amount ?? 0));

  const { error } = await sb.from("platform_payments").insert({
    invoice_id: link.platform_invoice_id,
    clinic_id: link.clinic_id,
    amount_omr: amount,
    method: "thawani",
    paid_at: new Date().toISOString(),
    /* The session id is the idempotency key. A unique index on
       (invoice_id, reference) turns a second confirmation into a no-op rather
       than a second payment. */
    reference: sessionId,
    notes: "دفع إلكتروني عبر ثواني",
  });

  const duplicate = !!error && /duplicate|unique/i.test(error.message);
  if (error && !duplicate) return { settled: false, amount: 0 };

  await sb.from("payment_links")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", link.id);

  /* A duplicate means an earlier confirmation already booked it. That is
     success, not failure. */
  return { settled: true, amount };
}
