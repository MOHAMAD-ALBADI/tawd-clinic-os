import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { CostsCard } from "@/components/platform/manage-widgets";
import { n8nGet } from "@/lib/n8n";
import { AlertTriangle } from "lucide-react";

export const metadata = { title: "اقتصاد المنصة — طود" };
export const dynamic = "force-dynamic";

export default async function EconomyPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00`;

  /* live n8n runs (24h) — shared helper normalises the /api/v1 base */
  async function n8nRuns(): Promise<number | null> {
    const res = await n8nGet<{ data: { startedAt: string }[] }>("executions?limit=100", 4000);
    if (!res.ok) return null;
    const dayAgo = Date.now() - 86_400_000;
    return (res.data.data ?? []).filter((e) => new Date(e.startedAt).getTime() > dayAgo).length;
  }

  const [{ data: costs }, tokensRes, waRes, { data: subs }, dbSizeRes, convRes, runs24h] = await Promise.all([
    sb.from("platform_costs").select("id, name, monthly_omr").order("created_at"),
    /* Summed in Postgres. This used to pull up to 100,000 rows and add them in
       JS, which silently truncated — downward — once a month exceeded that. */
    sb.rpc("platform_tokens_since", { p_since: monthStart }),
    sb.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    sb.from("tawd_subscriptions").select("price_omr, status"),
    sb.rpc("platform_db_size_mb"),
    sb.from("chat_sessions").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    n8nRuns(),
  ]);

  /* MRR counted only `active`, so the moment a clinic's payment failed its
     revenue vanished from the dashboard — indistinguishable from that clinic
     having cancelled. Those two need opposite responses: one is a phone call
     about a card, the other is a lost customer. Split, not merged. */
  const committed = (subs ?? [])
    .filter((s) => s.status === "active")
    .reduce((t, x) => t + Number(x.price_omr ?? 0), 0);
  const atRisk = (subs ?? [])
    .filter((s) => s.status === "past_due")
    .reduce((t, x) => t + Number(x.price_omr ?? 0), 0);
  const atRiskCount = (subs ?? []).filter((s) => s.status === "past_due").length;

  const dbSizeMb = typeof dbSizeRes.data === "number" ? dbSizeRes.data : Number(dbSizeRes.data ?? NaN);
  const tokensMonth = Number(tokensRes.data ?? 0) || 0;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none">اقتصاد المنصة</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>دخلك، تكاليفك، واستهلاكك — بمكان واحد</p>
      </div>

      {atRiskCount > 0 && (
        <div className="panel flex items-center gap-3 flex-wrap"
          style={{ padding: "1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
          <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            <span className="font-black ltr-nums text-white">{atRiskCount}</span> عيادة متأخرة السداد —
            دخل معرّض للخطر <span className="font-black ltr-nums" style={{ color: "#fbbf24" }}>{atRisk.toFixed(3)}</span> ر.ع شهرياً.
            غير محسوب في الدخل الشهري أدناه.
          </span>
        </div>
      )}

      <CostsCard
        costs={(costs ?? []) as { id: string; name: string; monthly_omr: number }[]}
        geminiTokensMonth={tokensMonth}
        waMessagesMonth={waRes.count ?? 0}
        mrr={committed}
        dbSizeMb={Number.isFinite(dbSizeMb) ? dbSizeMb : null}
        waConversationsMonth={convRes.count ?? 0}
        n8nRuns24h={runs24h}
      />
    </div>
  );
}
