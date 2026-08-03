import { NextResponse, type NextRequest } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* Did the work survive the connection?
 *
 * A wide request takes two to four minutes: gather, generate a cover,
 * write the body. The platform cuts a function at five, and the browser
 * holds the request open the whole time — so a run that finished the
 * document at 3:56 and was killed at 4:10 left the owner watching a
 * spinner over a report that already existed.
 *
 * The document is written to the database before the answer is composed,
 * which means it outlives the request that made it. This route lets the
 * page ask "was anything produced for me since I pressed send?" and
 * recover it instead of asking for it all over again.
 *
 * Scoped to the caller's clinic and the caller themself: a document is
 * the analysis someone asked for, not a clinic-wide bulletin.
 */
export async function GET(req: NextRequest) {
  const claims = await getUserClaims();
  if (!claims?.clinic_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = req.nextUrl.searchParams.get("since");
  if (!since || Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "missing since" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("sura_documents")
    .select("id, title, created_at")
    .eq("clinic_id", claims.clinic_id)
    .eq("user_id", claims.sub)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ doc: null });

  return NextResponse.json({
    doc: { url: `/print/doc/${data.id}`, label: data.title },
  });
}
