import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  LoyaltyManager, type LoyaltyHolder, type LoyaltyTxn, type LoyaltyConfig,
} from "@/components/accountant/loyalty-manager";

export const metadata = { title: "نقاط الولاء — طود" };
export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();

  const [{ data: people }, { data: txns }, { data: settings }, { data: activity }] = await Promise.all([
    sb.from("patients").select("id, name, phone, loyalty_points")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .gt("loyalty_points", 0).order("loyalty_points", { ascending: false }).limit(500),
    /* The ledger the page never showed. Points are redeemable against a bill,
       so a movement is a financial event and needs a visible history. */
    sb.from("loyalty_transactions")
      .select("id, patient_id, type, points, balance_after, note, created_at, patients!patient_id(name)")
      .eq("clinic_id", claims.clinic_id)
      .order("created_at", { ascending: false }).limit(60),
    sb.from("loyalty_settings")
      .select("is_active, points_per_omr, redemption_rate, min_redeem_points, max_redeem_pct, expiry_months")
      .eq("clinic_id", claims.clinic_id).maybeSingle(),
    /* Last movement per patient, for the expiry countdown. Expiry is lazy — a
       balance is zeroed the next time the patient is touched, not on a schedule —
       so nothing anywhere warned that points were about to die, and the first
       anyone knew was a patient at the desk being told their balance is nil. */
    sb.from("loyalty_transactions")
      .select("patient_id, created_at")
      .eq("clinic_id", claims.clinic_id)
      .order("created_at", { ascending: false }).limit(4000),
  ]);

  /* First row per patient wins — the list is already newest-first. */
  const lastActivity = new Map<string, string>();
  for (const t of activity ?? []) {
    const pid = t.patient_id as string;
    if (!lastActivity.has(pid)) lastActivity.set(pid, t.created_at as string);
  }

  const expiryMonths = settings?.expiry_months ? Number(settings.expiry_months) : null;

  const holders: LoyaltyHolder[] = (people ?? []).map((p) => {
    const id = p.id as string;
    const last = lastActivity.get(id) ?? null;
    let daysLeft: number | null = null;
    if (expiryMonths && last) {
      const dies = new Date(last);
      dies.setMonth(dies.getMonth() + expiryMonths);
      daysLeft = Math.ceil((dies.getTime() - Date.now()) / 86_400_000);
    }
    return {
      id,
      name: (p.name as string) ?? "مريض",
      phone: (p.phone as string | null) ?? null,
      points: Number(p.loyalty_points ?? 0),
      lastActivity: last,
      daysToExpiry: daysLeft,
    };
  });

  const recent: LoyaltyTxn[] = (txns ?? []).map((t) => ({
    id: t.id as string,
    patientName: (t.patients as unknown as { name?: string } | null)?.name ?? "مريض",
    type: t.type as string,
    points: Number(t.points ?? 0),
    balanceAfter: Number(t.balance_after ?? 0),
    note: (t.note as string | null) ?? null,
    createdAt: t.created_at as string,
  }));

  /* No settings row means the loop is off — the same "absent row = disabled"
     rule the earn/redeem code already follows. */
  const config: LoyaltyConfig = {
    active: !!settings?.is_active,
    pointsPerOmr: Number(settings?.points_per_omr ?? 0),
    redemptionRate: Number(settings?.redemption_rate ?? 0),
    minRedeem: Number(settings?.min_redeem_points ?? 0),
    maxRedeemPct: Number(settings?.max_redeem_pct ?? 0),
    expiryMonths,
  };

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">LOYALTY</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">نقاط الولاء</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          الأرصدة والتزامها المالي وسجل الحركات — والتعديل اليدوي عند الحاجة
        </p>
      </div>

      <LoyaltyManager holders={holders} recent={recent} config={config} />
    </div>
  );
}
