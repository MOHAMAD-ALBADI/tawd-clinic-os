import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { settleSubscriptionSession } from "@/lib/subscription-settle";

/* Where Thawani sends the clinic after it pays its subscription.

   This is a redirect target, not a webhook: it is reached by the payer's browser
   and carries no signature, so nothing it says is believed. It looks up the
   pending session for the invoice, asks Thawani directly whether that session was
   paid, and only then books the payment. Opening this URL by hand achieves
   nothing.

   It also means the clinic lands back inside TAWD on their own settings page
   rather than on a Thawani page, which is where the old patient-facing flow left
   people. */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  const back = (flag: string) =>
    NextResponse.redirect(new URL(`/clinic-admin/settings?pay=${flag}`, req.nextUrl.origin));

  if (!/^[0-9a-fA-F-]{36}$/.test(ref)) return back("bad");

  const sb = await createServiceRoleClient();
  const { data: links } = await sb.from("payment_links")
    .select("thawani_session_id")
    .eq("platform_invoice_id", ref).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(3);

  for (const l of links ?? []) {
    const sid = l.thawani_session_id as string | null;
    if (!sid) continue;
    const r = await settleSubscriptionSession(sid);
    if (r.settled) return back("paid");
  }

  /* The card may still be settling at the gateway. "Pending" rather than
     "failed", with the check-payment button on the page to try again — telling a
     clinic their payment failed when it is merely slow is the wrong lie. */
  return back("pending");
}
