import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { CostsCard } from "@/components/platform/manage-widgets";

export const metadata = { title: "اقتصاد المنصة — طود" };
export const dynamic = "force-dynamic";

export default async function EconomyPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00`;

  /* live n8n runs (24h) — same graceful pattern as the overview */
  async function n8nRuns(): Promise<number | null> {
    const key = process.env.N8N_API_KEY;
    const base = process.env.N8N_BASE_URL ?? "https://n8n.srv1239666.hstgr.cloud/api/v1";
    if (!key) return null;
    try {
      const r = await fetch(`${base}/executions?limit=100`, { headers: { "X-N8N-API-KEY": key }, signal: AbortSignal.timeout(4000), cache: "no-store" });
      const exs = (await r.json()).data as { startedAt: string }[];
      const dayAgo = Date.now() - 86_400_000;
      return exs.filter((e) => new Date(e.startedAt).getTime() > dayAgo).length;
    } catch { return null; }
  }

  const [{ data: costs }, { data: tokenRows }, waRes, { data: subs }, dbSizeRes, convRes, runs24h] = await Promise.all([
    sb.from("platform_costs").select("id, name, monthly_omr").order("created_at"),
    sb.from("ai_usage_metrics").select("tokens_total").gte("recorded_at", monthStart).limit(100000),
    sb.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    sb.from("tawd_subscriptions").select("price_omr, status"),
    sb.rpc("platform_db_size_mb"),
    sb.from("chat_sessions").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    n8nRuns(),
  ]);

  const mrr = (subs ?? []).filter((s) => s.status === "active").reduce((s, x) => s + Number(x.price_omr ?? 0), 0);
  const dbSizeMb = typeof dbSizeRes.data === "number" ? dbSizeRes.data : Number(dbSizeRes.data ?? NaN);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <h2 className="text-xl font-bold text-white">اقتصاد المنصة</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>دخلك، تكاليفك، واستهلاكك — بمكان واحد</p>
      </div>

      <CostsCard
        costs={(costs ?? []) as { id: string; name: string; monthly_omr: number }[]}
        geminiTokensMonth={(tokenRows ?? []).reduce((s, r) => s + Number(r.tokens_total ?? 0), 0)}
        waMessagesMonth={waRes.count ?? 0}
        mrr={mrr}
        dbSizeMb={Number.isFinite(dbSizeMb) ? dbSizeMb : null}
        waConversationsMonth={convRes.count ?? 0}
        n8nRuns24h={runs24h}
      />
    </div>
  );
}
