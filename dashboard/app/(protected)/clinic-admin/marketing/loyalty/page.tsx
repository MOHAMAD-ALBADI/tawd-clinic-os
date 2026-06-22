import { redirect } from "next/navigation";
import { getUserClaims }             from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LoyaltyEditor }             from "./loyalty-editor";

export const metadata = { title: "الولاء — التسويق — طود" };

export default async function LoyaltyPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();

  const [settingsRes, pointsRes] = await Promise.all([
    sb
      .from("loyalty_settings")
      .select("*")
      .eq("clinic_id", claims.clinic_id)
      .maybeSingle(),
    sb
      .from("loyalty_points")
      .select("patient_id, points")
      .eq("clinic_id", claims.clinic_id),
  ]);

  const settings = settingsRes.data;
  const rows     = pointsRes.data ?? [];

  const members    = new Set(rows.map((r) => r.patient_id)).size;
  const totalBal   = rows.reduce((s, r) => s + (r.points ?? 0), 0);
  const lifetimePts = rows.filter((r) => r.points > 0).reduce((s, r) => s + r.points, 0);

  return (
    <LoyaltyEditor
      settings={settings}
      stats={{ members, totalBal, lifetimePts }}
    />
  );
}
