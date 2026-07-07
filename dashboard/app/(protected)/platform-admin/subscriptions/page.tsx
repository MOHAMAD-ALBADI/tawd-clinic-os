import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { SubscriptionCard } from "@/components/platform/manage-widgets";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";

export const metadata = { title: "الاشتراكات — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function SubscriptionsPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: subs }, { data: clinics }] = await Promise.all([
    sb.from("tawd_subscriptions").select("clinic_id, plan, status, price_omr, trial_ends_at, current_period_end"),
    sb.from("tawd_clinics").select("id, name, name_ar"),
  ]);

  const rows = (subs ?? []).map((s) => {
    const c = (clinics ?? []).find((x) => x.id === s.clinic_id);
    const end = s.status === "trial" ? s.trial_ends_at : s.current_period_end;
    const days = end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000) : null;
    return { ...s, clinicName: (c?.name_ar ?? c?.name ?? "—") as string, days };
  }).sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  const mrr = rows.filter((r) => r.status === "active").reduce((s, r) => s + Number(r.price_omr ?? 0), 0);
  const overdue = rows.filter((r) => (r.days ?? 1) <= 0).length;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">الاشتراكات</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            MRR: <span className="font-bold ltr-nums text-white">{fmt(mrr)} ر.ع</span>
            {" · "}منتهية: <span className="font-bold ltr-nums" style={{ color: overdue > 0 ? "#fda4b4" : "#5dd9cb" }}>{overdue}</span>
          </p>
        </div>
        <Link href="/platform-admin/broadcast" className="btn-ghost">📣 مراسلة غير المجددين</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.clinic_id} className="space-y-2">
            <Link href={`/platform-admin/clinics/${r.clinic_id}`} className="section-title">
              <TawdBarsGlyph size={12} />
              <h2>{r.clinicName}</h2>
            </Link>
            <SubscriptionCard
              clinicId={r.clinic_id}
              plan={r.plan as string}
              status={r.status as string}
              priceOmr={Number(r.price_omr ?? 0)}
              periodEnd={(r.status === "trial" ? r.trial_ends_at : r.current_period_end) as string | null}
            />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm" style={{ color: "var(--text-4)" }}>لا اشتراكات بعد</p>}
      </div>
    </div>
  );
}
