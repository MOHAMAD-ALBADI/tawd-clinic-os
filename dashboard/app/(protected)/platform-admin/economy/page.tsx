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

  const [{ data: costs }, { data: tokenRows }, waRes, { data: subs }] = await Promise.all([
    sb.from("platform_costs").select("id, name, monthly_omr").order("created_at"),
    sb.from("ai_usage_metrics").select("tokens_total").gte("recorded_at", monthStart).limit(100000),
    sb.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    sb.from("tawd_subscriptions").select("price_omr, status"),
  ]);

  const mrr = (subs ?? []).filter((s) => s.status === "active").reduce((s, x) => s + Number(x.price_omr ?? 0), 0);

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
      />
    </div>
  );
}
