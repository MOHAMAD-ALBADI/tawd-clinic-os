import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { SubscriptionsManager, type SubRow, type PlanOption } from "@/components/platform/subscriptions-manager";
import { Coins, TrendingUp, AlertTriangle, Hourglass, Megaphone } from "lucide-react";

export const metadata = { title: "الاشتراكات — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function SubscriptionsPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: subs }, { data: clinics }, { data: planRows }] = await Promise.all([
    sb.from("tawd_subscriptions").select("clinic_id, plan, status, price_omr, trial_ends_at, current_period_end"),
    sb.from("tawd_clinics").select("id, name, name_ar"),
    sb.from("platform_plans").select("code, name_ar, price_omr").eq("is_active", true).order("sort_order"),
  ]);
  const plans: PlanOption[] = (planRows ?? []).map((p) => ({
    code: p.code as string, name_ar: p.name_ar as string, price_omr: Number(p.price_omr ?? 0),
  }));

  const byId = new Map((clinics ?? []).map((c) => [c.id, c.name_ar ?? c.name ?? "—"]));

  const rows: SubRow[] = (subs ?? []).map((s) => {
    const end = (s.status === "trial" ? s.trial_ends_at : s.current_period_end) as string | null;
    return {
      clinicId: s.clinic_id as string,
      clinicName: byId.get(s.clinic_id as string) ?? "—",
      plan: (s.plan as string) ?? "starter",
      status: (s.status as string) ?? "trial",
      priceOmr: Number(s.price_omr ?? 0),
      periodEnd: end,
      daysLeft: end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000) : null,
    };
    /* soonest to expire first — the ones needing a decision float to the top */
  }).sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

  /* Only `active` is committed revenue. past_due is a customer whose payment
     failed — real money, but not yet collected, so it is counted apart rather
     than folded in or dropped. */
  const mrr = rows.filter((r) => r.status === "active").reduce((s, r) => s + r.priceOmr, 0);
  const atRisk = rows.filter((r) => r.status === "past_due").reduce((s, r) => s + r.priceOmr, 0);
  const expired = rows.filter((r) => r.daysLeft !== null && r.daysLeft <= 0).length;
  const trials = rows.filter((r) => r.status === "trial").length;

  const kpis = [
    { label: "الدخل الشهري (ر.ع)", value: fmt(mrr), Icon: Coins, color: "var(--accent-1)" },
    { label: "الدخل السنوي (ر.ع)", value: fmt(mrr * 12), Icon: TrendingUp, color: "var(--accent-1)" },
    { label: "تجارب جارية", value: String(trials), Icon: Hourglass, color: trials > 0 ? "#fbbf24" : "var(--text-3)" },
    { label: "منتهية تحتاج تجديد", value: String(expired), Icon: AlertTriangle, color: expired > 0 ? "#fda4b4" : "var(--text-3)" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">SUBSCRIPTIONS</p>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">الاشتراكات</h1>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
            الأقرب انتهاءً أولاً — غيّر الباقة والسعر، مدّد التجربة، أو جدّد شهراً
          </p>
        </div>
        <Link href="/platform-admin/broadcast" className="btn-ghost">
          <Megaphone className="w-3.5 h-3.5" /> مراسلة غير المجدّدين
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.7rem", color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {atRisk > 0 && (
        <div className="panel flex items-center gap-3 flex-wrap"
          style={{ padding: "1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
          <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            دخل متأخر السداد: <span className="font-black ltr-nums" style={{ color: "#fbbf24" }}>{fmt(atRisk)}</span> ر.ع
            شهرياً — عملاء لم يلغوا لكن دفعتهم لم تصل، وغير محسوبين أعلاه.
          </span>
        </div>
      )}

      <SubscriptionsManager rows={rows} plans={plans} />
    </div>
  );
}
