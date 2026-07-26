import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { CostsCard } from "@/components/platform/manage-widgets";
import { n8nGet } from "@/lib/n8n";
import { AlertTriangle, TrendingUp } from "lucide-react";

export const metadata = { title: "اقتصاد المنصة — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

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

  const [{ data: costs }, tokensRes, waRes, { data: subs }, dbSizeRes, convRes, runs24h, { data: signups }] = await Promise.all([
    sb.from("platform_costs").select("id, name, monthly_omr").order("created_at"),
    /* Summed in Postgres. This used to pull up to 100,000 rows and add them in
       JS, which silently truncated — downward — once a month exceeded that. */
    sb.rpc("platform_tokens_since", { p_since: monthStart }),
    sb.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    sb.from("tawd_subscriptions").select("price_omr, status"),
    sb.rpc("platform_db_size_mb"),
    sb.from("chat_sessions").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    n8nRuns(),
    /* Real history. There is no MRR ledger — subscriptions store only current
       state — so a revenue trend would have to be invented. Signup dates are
       actual recorded facts, so the chart shows customer growth instead of a
       fabricated revenue curve. */
    sb.from("tawd_clinics").select("created_at, status").order("created_at"),
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

  /* Unit economics — the numbers that say whether the business works, as
     opposed to how big it is. */
  const paying = (subs ?? []).filter((s) => s.status === "active").length;
  const totalCost = (costs ?? []).reduce((s, c) => s + Number(c.monthly_omr ?? 0), 0);
  const arpu = paying > 0 ? committed / paying : 0;
  const costPerClinic = paying > 0 ? totalCost / paying : 0;
  const marginPct = committed > 0 ? Math.round(((committed - totalCost) / committed) * 100) : 0;

  /* Customer count at the end of each of the last six months, from real signup
     dates. Cumulative, because what matters is how many clinics you have — not
     how many joined in one month. */
  const months: { label: string; count: number }[] = [];
  const nowD = new Date();
  for (let i = 5; i >= 0; i--) {
    const cutoff = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - i + 1, 1)).getTime();
    months.push({
      label: String(new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - i, 1)).getUTCMonth() + 1).padStart(2, "0"),
      count: (signups ?? []).filter((c) => new Date(c.created_at as string).getTime() < cutoff).length,
    });
  }
  const peak = Math.max(1, ...months.map((m) => m.count));

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

      {/* Unit economics. Size tells you how far you have come; these tell you
          whether the thing works. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "متوسط دخل العيادة (ر.ع)", value: fmt(arpu), hint: "ARPU" },
          { label: "تكلفتك لكل عيادة (ر.ع)", value: fmt(costPerClinic), hint: "كل التكاليف ÷ العيادات الدافعة" },
          { label: "هامش الربح", value: `${marginPct}%`, hint: "بعد كل التكاليف الثابتة" },
          { label: "عيادات دافعة", value: String(paying), hint: "اشتراكات نشطة فقط" },
        ].map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--text-4)" }}>{k.label}</p>
            <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.6rem", color: "var(--accent-1)" }}>{k.value}</p>
            <p className="text-[10.5px] mt-1.5" style={{ color: "var(--text-4)" }}>{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="section-title mb-1">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>نمو العملاء — ٦ أشهر</h2>
        </div>
        <p className="text-[11px] mb-5" style={{ color: "var(--text-4)" }}>
          عدد العيادات في نهاية كل شهر، من تواريخ اشتراكها الفعلية
        </p>
        <div className="flex items-end justify-between gap-2" style={{ height: 110 }} dir="ltr">
          {months.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[11px] ltr-nums font-bold" style={{ color: "var(--text-3)" }}>{m.count}</span>
              <div className="w-full rounded-t" title={`${m.count} عيادة`}
                style={{
                  height: `${(m.count / peak) * 100}%`,
                  minHeight: m.count > 0 ? 3 : 0,
                  background: "var(--accent-1)",
                  opacity: i === months.length - 1 ? 0.95 : 0.5,
                }} />
              <span className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

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
