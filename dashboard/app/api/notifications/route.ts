import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { notificationsFor } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export type { NotifItem } from "@/lib/notifications";

/* Role-aware, LIVE notifications — no placeholders.
 *
 * The computation moved to lib/notifications so that Sura reads the same
 * list. It was unreachable from anywhere but this route, which is why
 * she answered "there are no alerts" to a screen showing sixteen. */
export async function GET() {
  const claims = await getUserClaims();
  if (!claims) return NextResponse.json({ items: [], count: 0 }, { status: 401 });

  const items = await notificationsFor(claims);
  return NextResponse.json({ items, count: items.length });
}
