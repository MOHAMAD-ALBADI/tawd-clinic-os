import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExpensesManager, type ExpenseRow } from "@/components/finance/expenses-manager";
import { TrendingDown, Receipt, Bot } from "lucide-react";

export const metadata = { title: "المصروفات — طود" };
export const dynamic = "force-dynamic";

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export default async function ExpensesPage() {
  const claims = (await getUserClaims())!;
  const sb = await createServerSupabaseClient();

  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  const period = `${y}-${String(m + 1).padStart(2, "0")}`;

  const { data } = await sb.from("expenses")
    .select("id, category, amount, expense_date, payment_method, description, vendor, ref_type")
    .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
    .gte("expense_date", monthStart).lt("expense_date", nextMonth)
    .order("expense_date", { ascending: false });

  const rows: ExpenseRow[] = (data ?? []).map((e) => ({
    id: e.id, category: e.category, amount: n(e.amount), expense_date: e.expense_date as string,
    payment_method: e.payment_method as string, description: (e.description as string) ?? "",
    vendor: (e.vendor as string) ?? "", ref_type: (e.ref_type as string) ?? "manual",
  }));

  const total = rows.reduce((s, e) => s + e.amount, 0);
  /* Payroll finalisation and stock receipts book their own expenses, so the
     manager can see how much of the month was entered by hand vs by the system. */
  const autoRows = rows.filter((e) => e.ref_type !== "manual");
  const auto = autoRows.reduce((s, e) => s + e.amount, 0);

  const kpis = [
    { label: `مصروفات ${period}`, value: fmt(total), Icon: TrendingDown, color: "#fbbf24" },
    { label: "عدد القيود", value: String(rows.length), Icon: Receipt, color: "var(--accent-1)" },
    { label: "مُرحَّل تلقائياً", value: fmt(auto), Icon: Bot, color: "var(--accent-1)" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      <ExpensesManager expenses={rows} />
    </div>
  );
}
