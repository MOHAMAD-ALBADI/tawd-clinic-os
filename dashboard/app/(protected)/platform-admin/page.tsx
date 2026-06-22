import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Building2, Users, Activity, Zap, CheckCircle } from "lucide-react";

export const metadata = { title: "لوحة المنصة — طود" };

export default async function PlatformAdminPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "platform_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const [clinicsRes, staffRes, appointmentsRes, patientsRes] =
    await Promise.all([
      supabase
        .from("tawd_clinics")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("tawd_staff_users")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("tawd_patients")
        .select("id", { count: "exact", head: true }),
    ]);

  const { data: recentClinics } = await supabase
    .from("tawd_clinics")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2
          className="text-xl font-bold"
          style={{ color: "hsl(var(--foreground))" }}
        >
          لوحة المنصة
        </h2>
        <p
          className="text-sm mt-0.5"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          نظرة عامة على جميع العيادات
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="العيادات المفعّلة"
          value={clinicsRes.count ?? 0}
          variant="gold"
          icon={<Building2 className="w-4 h-4 text-tawd-600" />}
        />
        <KPICard
          label="إجمالي الكوادر"
          value={(staffRes.count ?? 0).toLocaleString("ar-SA")}
          variant="slate"
          icon={<Users className="w-4 h-4 text-slate-500" />}
        />
        <KPICard
          label="إجمالي المواعيد"
          value={(appointmentsRes.count ?? 0).toLocaleString("ar-SA")}
          variant="success"
          icon={<Activity className="w-4 h-4 text-emerald-600" />}
        />
        <KPICard
          label="إجمالي المرضى"
          value={(patientsRes.count ?? 0).toLocaleString("ar-SA")}
          variant="gold"
          icon={<Zap className="w-4 h-4 text-amber-500" />}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* System health */}
        <div
          className="rounded-xl border p-5 card-elevated"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <h3
            className="font-semibold mb-4"
            style={{ color: "hsl(var(--foreground))" }}
          >
            حالة النظام
          </h3>
          <div className="space-y-3">
            {[
              "قاعدة البيانات Supabase",
              "واجهة WhatsApp API",
              "مساعد سُرى AI",
              "خوادم n8n",
              "بريد الإشعارات",
            ].map((service) => (
              <div key={service} className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span
                  className="text-sm flex-1"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  {service}
                </span>
                <span className="text-xs text-emerald-600 font-medium">
                  يعمل
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent clinics */}
        <div
          className="rounded-xl border p-5 card-elevated"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <h3
            className="font-semibold mb-4"
            style={{ color: "hsl(var(--foreground))" }}
          >
            أحدث العيادات
          </h3>
          <div className="space-y-0">
            {(recentClinics ?? []).length === 0 ? (
              <p
                className="text-sm py-4 text-center"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                لا توجد عيادات بعد
              </p>
            ) : (
              (recentClinics ?? []).map((clinic, i) => (
                <div
                  key={clinic.id}
                  className="flex items-center gap-3 py-2.5 border-b last:border-0"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <div className="w-7 h-7 rounded-lg bg-tawd-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-tawd-600" />
                  </div>
                  <span
                    className="text-sm flex-1 truncate"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {clinic.name}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    #{i + 1}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
