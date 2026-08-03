import { NextResponse, type NextRequest } from "next/server";
import { runTick } from "@/lib/sura/tick";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { rolesOf } from "@/lib/auth/role-redirect";

/* The agent's heartbeat.
 *
 * Called by Vercel Cron on a schedule, and by the platform owner from the
 * dashboard when demonstrating it. Nothing else may call it: a public
 * endpoint that makes a language model send WhatsApp messages is an open
 * invoice and an open door.
 *
 * Vercel signs its cron requests with CRON_SECRET as a bearer token. The
 * signed-in platform admin is the second accepted caller so the
 * "run now" button works without weakening the first.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const fromCron = Boolean(secret) && bearer === `Bearer ${secret}`;

  if (!fromCron) {
    const claims = await getUserClaims();
    const allowed = claims ? rolesOf(claims).includes("platform_admin") : false;
    if (!allowed) {
      /* 404 rather than 401: an unauthenticated caller learns nothing
         about what does or does not exist here. */
      return new NextResponse(null, { status: 404 });
    }
  }

  const started = Date.now();
  const report = await runTick();

  return NextResponse.json(
    { ...report, ms: Date.now() - started },
    { headers: { "cache-control": "no-store" } },
  );
}
