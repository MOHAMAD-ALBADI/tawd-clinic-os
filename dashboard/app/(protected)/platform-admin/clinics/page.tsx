import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Building2 } from "lucide-react";

export const metadata = { title: "العيادات — طود" };

type Clinic = { id: string; name: string; name_ar?: string; country?: string; is_active: boolean };

export default async function ClinicsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "platform_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data, count } = await supabase
    .from("tawd_clinics")
    .select("id, name, name_ar, country, is_active", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100);

  const clinics = (data ?? []) as Clinic[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>العيادات</h2>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{count ?? 0} عيادة مسجّلة</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clinics.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(20,184,166,0.1)" }}>
                <Building2 className="w-5 h-5" style={{ color: "#14b8a6" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{c.name_ar ?? c.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{c.country ?? "—"}</p>
              </div>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
                style={{
                  background: c.is_active ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                  color: c.is_active ? "#059669" : "#DC2626",
                }}
              >
                {c.is_active ? "نشط" : "موقوف"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
