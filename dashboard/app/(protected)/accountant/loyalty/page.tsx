import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Star } from "lucide-react";

export const metadata = { title: "نقاط الولاء — طود" };

type Patient = { id: string; name: string; loyalty_points: number };

export default async function LoyaltyPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("patients")
    .select("id, name, loyalty_points")
    .eq("clinic_id", claims.clinic_id)
    .gt("loyalty_points", 0)
    .order("loyalty_points", { ascending: false })
    .limit(100);

  const patients = (data ?? []) as Patient[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>نقاط الولاء</h2>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{patients.length} مريض لديهم نقاط</p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Star className="w-10 h-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>لا يوجد مرضى لديهم نقاط ولاء</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(var(--muted) / 0.4)", borderBottom: "1px solid hsl(var(--border))" }}>
                {["المريض", "النقاط"].map((h) => (
                  <th key={h} className="text-right py-3 px-5 text-[12px] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < patients.length - 1 ? "1px solid hsl(var(--border))" : undefined }}>
                  <td className="py-3.5 px-5 font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.name}</td>
                  <td className="py-3.5 px-5">
                    <span className="flex items-center gap-1.5 font-bold ltr-nums" style={{ color: "#0f766e" }}>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      {p.loyalty_points.toLocaleString("ar-SA")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
