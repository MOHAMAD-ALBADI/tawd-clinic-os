import { redirect } from "next/navigation";
import { getUserClaims }             from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LoyaltyEditor, type LoyaltySettings } from "./loyalty-editor";

export const metadata = { title: "الولاء — التسويق — طود" };
export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();

  const [settingsRes, pointsRes] = await Promise.all([
    sb
      .from("loyalty_settings")
      .select("is_active, points_per_omr, redemption_rate, min_redeem_points, max_redeem_pct, expiry_months")
      .eq("clinic_id", claims.clinic_id)
      .maybeSingle(),
    sb
      .from("loyalty_points")
      .select("patient_id, points")
      .eq("clinic_id", claims.clinic_id),
  ]);

  const d = settingsRes.data;
  /* PostgREST returns NUMERIC as a string, so these need coercing before they
     reach an input or an arithmetic example. */
  const settings: LoyaltySettings = d
    ? {
        is_active: !!d.is_active,
        points_per_omr: Number(d.points_per_omr ?? 1),
        redemption_rate: Number(d.redemption_rate ?? 0.03),
        min_redeem_points: Number(d.min_redeem_points ?? 100),
        max_redeem_pct: Number(d.max_redeem_pct ?? 30),
        expiry_months: Number(d.expiry_months ?? 6),
      }
    : null;

  const rows = pointsRes.data ?? [];
  /* Only live balances. A "lifetime earned" figure summed from current balances
     was the same number wearing a different label. */
  const withBalance = rows.filter((r) => (r.points ?? 0) > 0);
  const members = new Set(withBalance.map((r) => r.patient_id)).size;
  const totalBal = withBalance.reduce((s, r) => s + (r.points ?? 0), 0);

  return <LoyaltyEditor settings={settings} stats={{ members, totalBal }} />;
}
