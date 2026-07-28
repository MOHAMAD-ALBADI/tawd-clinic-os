import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolvePeriod, withinPeriodDate } from "@/lib/period";
import { PeriodPicker } from "@/components/finance/period-picker";
import { ExpensesManager, type ExpenseRow } from "@/components/finance/expenses-manager";
import { ArrowRight, TrendingDown, Receipt, Bot } from "lucide-react";

export const metadata = { title: "المصروفات — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

/* The bookkeeper's own screen.

   Expenses existed only under the manager's routes, so the accountant — the
   person who actually keeps the books — could not see them, let alone enter one.
   They could tell you what came in and had no access to what went out, which is
   half a set of books.

   Same component the manager uses, so there is one expense screen and not two
   that drift. It differs in one way and deliberately: it takes the period control
   the rest of the finance section now has, instead of being pinned to this
   calendar month. */
export default async function AccountantExpensesPage({
  searchParams,
}: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const period = resolvePeriod(await searchParams);

  const q = sb.from("expenses")
    .select("id, category, amount, expense_date, payment_method, description, vendor, ref_type")
    .eq("clinic_id", claims.clinic_id).is("deleted_at", null);

  /* expense_date is a plain date, not a timestamp — the clinic-local bounds
     apply directly and converting them to instants first would shift them. */
  const { data } = await withinPeriodDate(q, "expense_date", period)
    .order("expense_date", { ascending: false }).limit(2000);

  const rows: ExpenseRow[] = (data ?? []).map((e) => ({
    id: e.id as string,
    category: e.category as string,
    amount: Number(e.amount ?? 0),
    expense_date: e.expense_date as string,
    payment_method: e.payment_method as string,
    description: (e.description as string) ?? "",
    vendor: (e.vendor as string) ?? "",
    ref_type: (e.ref_type as string) ?? "manual",
  }));

  const total = rows.reduce((s, e) => s + e.amount, 0);
  /* Payroll runs, stock receipts and bad-debt write-offs book their own expenses.
     Separating them says how much of the period was typed in by a human. */
  const auto = rows.filter((e) => e.ref_type !== "manual").reduce((s, e) => s + e.amount, 0);

  const kpis = [
    { label: "إجمالي المصروفات", value: fmt(total), Icon: TrendingDown, color: "#fbbf24" },
    { label: "عدد القيود", value: String(rows.length), Icon: Receipt, color: "var(--accent-1)" },
    { label: "مُرحَّل تلقائياً", value: fmt(auto), Icon: Bot, color: "var(--accent-1)" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs"
        style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <p className="eyebrow">EXPENSES</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">المصروفات</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ما يخرج من العيادة — الرواتب واستلام المخزون والديون المعدومة تُرحَّل هنا تلقائياً
        </p>
      </div>

      <PeriodPicker active={period.key} from={period.from} to={period.to} label={period.label} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none"
              style={{ fontSize: "1.7rem", color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <ExpensesManager expenses={rows} />
    </div>
  );
}
