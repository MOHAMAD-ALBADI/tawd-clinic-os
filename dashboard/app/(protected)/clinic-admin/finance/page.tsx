import { getUserClaims } from "@/lib/auth/get-user-claims";
import { clinicToday } from "@/lib/clinic-time";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TrendingUp, TrendingDown, Wallet, PieChart, Banknote, CreditCard, Smartphone, ShieldCheck, AlertTriangle } from "lucide-react";

export const metadata = { title: "المالية — طود" };
export const dynamic = "force-dynamic";

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

const GATEWAY_META: Record<string, { label: string; Icon: typeof Banknote; color: string }> = {
  cash:          { label: "نقداً",        Icon: Banknote,   color: "var(--accent-1)" },
  thawani:       { label: "ثواني",        Icon: Smartphone, color: "#38bdf8" },
  bank_transfer: { label: "تحويل بنكي",   Icon: CreditCard, color: "#a78bfa" },
  insurance:     { label: "تأمين",        Icon: ShieldCheck, color: "#fbbf24" },
};

export default async function FinanceOverviewPage() {
  // the layout already refused anyone who is not the clinic manager
  const claims = (await getUserClaims())!;
  const sb = await createServerSupabaseClient();

  const now = new Date();
  const period = monthKey(now);
  const monthStart = `${period}-01`;
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  // six-month window, this month included
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString().slice(0, 10);

  const [payRes, expRes, invRes] = await Promise.all([
    sb.from("payments").select("amount, gateway, created_at")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("created_at", `${windowStart}T00:00:00`),
    sb.from("expenses").select("amount, category, expense_date")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .gte("expense_date", windowStart),
    // everything still owed, regardless of when it was raised
    sb.from("invoices").select("total, status, due_date")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .in("status", ["sent", "partially_paid", "overdue"]),
  ]);

  const payments = payRes.data ?? [];
  const expenseRows = expRes.data ?? [];

  /* ── this month ── */
  const inMonth = <T,>(rows: T[], date: (r: T) => string) =>
    rows.filter((r) => date(r) >= monthStart && date(r) < nextMonth);

  const monthPayments = inMonth(payments, (p) => (p.created_at as string).slice(0, 10));
  const monthExpenses = inMonth(expenseRows, (e) => e.expense_date as string);

  const revenue = monthPayments.reduce((s, p) => s + n(p.amount), 0);
  const expenses = monthExpenses.reduce((s, e) => s + n(e.amount), 0);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  /* ── how the money came in ── */
  const byGateway = new Map<string, number>();
  for (const p of monthPayments) byGateway.set(p.gateway as string, (byGateway.get(p.gateway as string) ?? 0) + n(p.amount));
  const gateways = [...byGateway.entries()].sort((a, b) => b[1] - a[1]);

  /* ── where it went ── */
  const byCat = new Map<string, number>();
  for (const e of monthExpenses) byCat.set(e.category as string, (byCat.get(e.category as string) ?? 0) + n(e.amount));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  /* ── outstanding ── */
  const today = clinicToday(now);
  const outstanding = (invRes.data ?? []).reduce((s, i) => s + n(i.total), 0);
  const overdueRows = (invRes.data ?? []).filter((i) => i.status === "overdue" || (i.due_date && (i.due_date as string) < today));
  const overdue = overdueRows.reduce((s, i) => s + n(i.total), 0);

  /* ── six-month trend ── */
  const months: { key: string; label: string; rev: number; exp: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: monthKey(d), label: String(d.getUTCMonth() + 1).padStart(2, "0"), rev: 0, exp: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const p of payments) {
    const m = byKey.get((p.created_at as string).slice(0, 7));
    if (m) m.rev += n(p.amount);
  }
  for (const e of expenseRows) {
    const m = byKey.get((e.expense_date as string).slice(0, 7));
    if (m) m.exp += n(e.amount);
  }
  const peak = Math.max(1, ...months.map((m) => Math.max(m.rev, m.exp)));

  const kpis = [
    { label: "الإيراد (الشهر)", value: fmt(revenue), Icon: TrendingUp, color: "var(--accent-1)" },
    { label: "المصروفات", value: fmt(expenses), Icon: TrendingDown, color: "#fbbf24" },
    { label: "صافي الربح", value: fmt(profit), Icon: Wallet, color: profit >= 0 ? "var(--accent-1)" : "#fda4b4" },
    { label: "هامش الربح", value: `${margin}%`, Icon: PieChart, color: profit >= 0 ? "var(--accent-1)" : "#fda4b4" },
  ];

  return (
    <div className="space-y-5">
      <p className="text-[11px] -mt-1" style={{ color: "var(--text-4)" }}>
        شهر <span className="ltr-nums">{period}</span> — الرواتب والمشتريات تُسجَّل كمصروفات تلقائياً
      </p>

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

      {outstanding > 0 && (
        <div className="panel flex items-center gap-3 flex-wrap" style={{ padding: "1rem 1.2rem", borderColor: overdue > 0 ? "rgba(248,113,113,0.28)" : "var(--hairline)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: overdue > 0 ? "#fda4b4" : "#fbbf24" }} />
          <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            غير محصَّل: <span className="font-black ltr-nums text-white">{fmt(outstanding)}</span> ر.ع
          </span>
          {overdue > 0 && (
            <span className="text-[12.5px]" style={{ color: "#fda4b4" }}>
              منها متأخر: <span className="font-black ltr-nums">{fmt(overdue)}</span> ر.ع
              <span className="ltr-nums"> ({overdueRows.length})</span>
            </span>
          )}
        </div>
      )}

      {/* ── six-month trend: revenue against expenses, same scale ── */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="section-title">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>الإيراد مقابل المصروفات — ٦ أشهر</h2>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-3)" }}>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "var(--accent-1)" }} />إيراد</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "#fbbf24" }} />مصروف</span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2" style={{ height: 130 }} dir="ltr">
          {months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="w-full flex items-end justify-center gap-1" style={{ height: "100%" }}>
                <div className="rounded-t" title={`إيراد ${fmt(m.rev)}`}
                  style={{ width: "42%", height: `${(m.rev / peak) * 100}%`, minHeight: m.rev > 0 ? 3 : 0, background: "var(--accent-1)", opacity: 0.85 }} />
                <div className="rounded-t" title={`مصروف ${fmt(m.exp)}`}
                  style={{ width: "42%", height: `${(m.exp / peak) * 100}%`, minHeight: m.exp > 0 ? 3 : 0, background: "#fbbf24", opacity: 0.8 }} />
              </div>
              <span className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>{m.label}</span>
            </div>
          ))}
        </div>
        {peak === 1 && (
          <p className="text-[11.5px] text-center mt-4" style={{ color: "var(--text-4)" }}>
            لا حركة مالية مسجّلة في آخر ٦ أشهر
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── inbound mix ── */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <Banknote className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>طرق التحصيل</h2>
          </div>
          {gateways.length === 0 ? (
            <p className="text-[12.5px] py-6 text-center" style={{ color: "var(--text-4)" }}>لا مدفوعات هذا الشهر</p>
          ) : (
            <div className="space-y-3">
              {gateways.map(([g, amt]) => {
                const meta = GATEWAY_META[g] ?? { label: g, Icon: Banknote, color: "#a1a1aa" };
                return (
                  <div key={g}>
                    <div className="flex items-center justify-between text-[12px] mb-1.5">
                      <span className="flex items-center gap-2 text-white font-semibold">
                        <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />{meta.label}
                      </span>
                      <span className="ltr-nums" style={{ color: "var(--text-3)" }}>
                        {fmt(amt)} ر.ع · {Math.round((amt / revenue) * 100)}%
                      </span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(amt / revenue) * 100}%`, background: meta.color, opacity: 0.75 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── outbound mix ── */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <PieChart className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>أكبر بنود المصروف</h2>
          </div>
          {cats.length === 0 ? (
            <p className="text-[12.5px] py-6 text-center" style={{ color: "var(--text-4)" }}>لا مصروفات هذا الشهر</p>
          ) : (
            <div className="space-y-3">
              {cats.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-white font-semibold">{cat}</span>
                    <span className="ltr-nums" style={{ color: "var(--text-3)" }}>
                      {fmt(amt)} ر.ع · {Math.round((amt / expenses) * 100)}%
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(amt / expenses) * 100}%`, background: "#fbbf24", opacity: 0.7 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
