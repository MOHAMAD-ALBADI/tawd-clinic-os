import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DollarSign, TrendingUp, CreditCard, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "لوحة المالية — طود" };

export default async function AccountantPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "accountant") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.substring(0, 7) + "-01";

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, total, status, created_at")
    .eq("clinic_id", claims.clinic_id)
    .gte("created_at", `${monthStart}T00:00:00`)
    .order("created_at", { ascending: false });

  const allInvoices = invoices ?? [];
  const paidInvoices    = allInvoices.filter((i) => i.status === "paid");
  const pendingInvoices = allInvoices.filter((i) => ["sent", "partially_paid", "overdue"].includes(i.status));
  const totalRevenue    = paidInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const todayRevenue    = paidInvoices
    .filter((i) => i.created_at?.startsWith(today))
    .reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
        لوحة المالية
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="إيرادات الشهر"
          value={formatCurrency(totalRevenue)}
          change={12}
          changeLabel="عن الشهر الماضي"
          variant="gold"
          icon={<DollarSign className="w-4 h-4 text-tawd-600" />}
        />
        <KPICard
          label="إيرادات اليوم"
          value={formatCurrency(todayRevenue)}
          variant="success"
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
        />
        <KPICard
          label="فواتير الشهر"
          value={allInvoices.length}
          subLabel="فاتورة"
          variant="gold"
          icon={<CreditCard className="w-4 h-4 text-amber-500" />}
        />
        <KPICard
          label="بانتظار التحصيل"
          value={pendingInvoices.length}
          variant="danger"
          icon={<AlertCircle className="w-4 h-4 text-red-500" />}
        />
      </div>

      <div
        className="rounded-xl border p-5 card-elevated"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            آخر الفواتير
          </h3>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            هذا الشهر
          </span>
        </div>

        {paidInvoices.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>
            لا توجد فواتير مدفوعة هذا الشهر
          </p>
        ) : (
          <div>
            {paidInvoices.slice(0, 10).map((inv, i) => (
              <div
                key={inv.id ?? i}
                className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      فاتورة مدفوعة
                    </p>
                    <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {inv.created_at ? formatDate(inv.created_at) : "—"}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold ltr-nums text-emerald-600">
                  {formatCurrency(inv.total ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
