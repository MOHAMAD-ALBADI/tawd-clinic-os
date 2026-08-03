import { NextResponse, type NextRequest } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { listConversations, loadTurns, deleteConversation } from "@/lib/sura/conversations";

export const dynamic = "force-dynamic";

/* The conversation list, and one conversation's turns.
 *
 * Separate from /ask on purpose: asking is slow and expensive, and
 * opening yesterday's thread should not go anywhere near a model.
 */

export async function GET(req: NextRequest) {
  const claims = await getUserClaims();
  if (!claims?.clinic_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = await createServiceRoleClient();
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const turns = await loadTurns(sb, id, claims.sub);
    if (!turns) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ turns });
  }

  return NextResponse.json({
    conversations: await listConversations(sb, claims.sub, claims.clinic_id),
  });
}

export async function DELETE(req: NextRequest) {
  const claims = await getUserClaims();
  if (!claims?.clinic_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const sb = await createServiceRoleClient();
  const ok = await deleteConversation(sb, id, claims.sub);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
