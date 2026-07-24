import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExpensesManager, type ExpenseRow } from "@/components/finance/expenses-manager";
import { TrendingUp, TrendingDown, Wallet, PieChart } from "lucide-react";

export const metadata = { title: "المالية — طود" };

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export default async function FinancePage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  const period = `${y}-${String(m + 1).padStart(2, "0")}`;

  const [payRes, expRes] = await Promise.all([
    sb.from("payments").select("amount")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("created_at", monthStart + "T00:00:00").lt("created_at", nextMonth + "T00:00:00"),
    sb.from("expenses")
      .select("id, category, amount, expense_date, payment_method, description, vendor, ref_type")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .gte("expense_date", monthStart).lt("expense_date", nextMonth)
      .order("expense_date", { ascending: false }),
  ]);

  const revenue = (payRes.data ?? []).reduce((s, p) => s + n(p.amount), 0);
  const expenseRows: ExpenseRow[] = (expRes.data ?? []).map((e) => ({
    id: e.id, category: e.category, amount: n(e.amount), expense_date: e.expense_date as string,
    payment_method: e.payment_method as string, description: (e.description as string) ?? "",
    vendor: (e.vendor as string) ?? "", ref_type: (e.ref_type as string) ?? "manual",
  }));
  const expenses = expenseRows.reduce((s, e) => s + e.amount, 0);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const byCat = new Map<string, number>();
  for (const e of expenseRows) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  const kpis = [
    { label: "الإيراد (الشهر)", value: fmt(revenue), Icon: TrendingUp, color: "#5dd9cb" },
    { label: "المصروفات", value: fmt(expenses), Icon: TrendingDown, color: "#fbbf24" },
    { label: "صافي الربح", value: fmt(profit), Icon: Wallet, color: profit >= 0 ? "#5dd9cb" : "#fda4b4" },
    { label: "هامش الربح", value: `${margin}%`, Icon: PieChart, color: profit >= 0 ? "#5dd9cb" : "#fda4b4" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">FINANCE</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">المالية</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          الإيراد والمصروفات وصافي الربح — شهر <span className="ltr-nums">{period}</span> (الرواتب والمشتريات تُسجَّل تلقائياً)
        </p>
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

      {cats.length > 0 && (
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4"><PieChart className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} /><h2>المصروفات حسب الفئة</h2></div>
          <div className="space-y-2.5">
            {cats.map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="text-white font-semibold">{cat}</span>
                  <span className="ltr-nums" style={{ color: "var(--text-3)" }}>{fmt(amt)} ر.ع</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full" style={{ width: `${expenses > 0 ? (amt / expenses) * 100 : 0}%`, background: "var(--accent-1)", opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ExpensesManager expenses={expenseRows} />
    </div>
  );
}
