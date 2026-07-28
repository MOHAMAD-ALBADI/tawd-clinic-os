import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { BillingBoard, type InvoiceRow } from "@/components/platform/billing-board";
import { emailStatus } from "@/lib/email";
import { ArrowRight, Banknote, Hourglass, AlertTriangle, TrendingUp } from "lucide-react";

export const metadata = { title: "التحصيل — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function BillingPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const yearStart = `${now.getUTCFullYear()}-01-01`;
  const monthStart = `${thisMonth}-01`;

  const [{ data: invoices }, { data: payments }, { data: clinics }] = await Promise.all([
    sb.from("platform_invoices")
      .select("id, number, clinic_id, period_start, period_end, total_omr, status, issued_at, due_at")
      .order("issued_at", { ascending: false }).limit(300),
    sb.from("platform_payments")
      .select("id, invoice_id, amount_omr, method, paid_at, reference")
      .order("paid_at", { ascending: false }).limit(1000),
    sb.from("tawd_clinics").select("id, name, name_ar"),
  ]);

  const nameOf = new Map((clinics ?? []).map((c) => [c.id as string, (c.name_ar ?? c.name) as string]));
  const payByInvoice = new Map<string, InvoiceRow["payments"]>();
  for (const p of payments ?? []) {
    const list = payByInvoice.get(p.invoice_id as string) ?? [];
    list.push({
      id: p.id as string,
      amount: Number(p.amount_omr ?? 0),
      method: p.method as string,
      paidAt: p.paid_at as string,
      reference: (p.reference as string | null) ?? null,
    });
    payByInvoice.set(p.invoice_id as string, list);
  }

  const rows: InvoiceRow[] = (invoices ?? []).map((i) => {
    const pays = payByInvoice.get(i.id as string) ?? [];
    return {
      id: i.id as string,
      number: i.number as string,
      clinicId: i.clinic_id as string,
      clinicName: nameOf.get(i.clinic_id as string) ?? "—",
      periodStart: i.period_start as string,
      periodEnd: i.period_end as string,
      total: Number(i.total_omr ?? 0),
      paid: pays.reduce((s, p) => s + p.amount, 0),
      status: i.status as string,
      issuedAt: i.issued_at as string,
      dueAt: (i.due_at as string | null) ?? null,
      payments: pays,
    };
  });

  /* Collected is the sum of payments received, not of invoices marked paid.
     Those are different numbers the moment a partial payment exists, and the
     one that matters is what reached the bank. */
  const collectedMonth = (payments ?? [])
    .filter((p) => (p.paid_at as string) >= monthStart)
    .reduce((s, p) => s + Number(p.amount_omr ?? 0), 0);
  const collectedYear = (payments ?? [])
    .filter((p) => (p.paid_at as string) >= yearStart)
    .reduce((s, p) => s + Number(p.amount_omr ?? 0), 0);

  const outstanding = rows
    .filter((r) => r.status === "open")
    .reduce((s, r) => s + (r.total - r.paid), 0);
  const overdue = rows
    .filter((r) => r.status === "open" && r.dueAt && new Date(r.dueAt).getTime() < Date.now())
    .reduce((s, r) => s + (r.total - r.paid), 0);

  const kpis = [
    { label: "محصَّل هذا الشهر (ر.ع)", value: fmt(collectedMonth), Icon: Banknote, color: "#34d399" },
    { label: "محصَّل هذه السنة (ر.ع)", value: fmt(collectedYear), Icon: TrendingUp, color: "var(--accent-1)" },
    { label: "مستحق لم يصل (ر.ع)", value: fmt(outstanding), Icon: Hourglass, color: outstanding > 0 ? "#fbbf24" : "var(--text-3)" },
    { label: "متأخر عن موعده (ر.ع)", value: fmt(overdue), Icon: AlertTriangle, color: overdue > 0 ? "#fda4b4" : "var(--text-3)" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لنظرة المنصة
      </Link>

      <div>
        <p className="eyebrow">COLLECTIONS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">التحصيل</h1>
        {/* The distinction this page exists to make. */}
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ما وصلك فعلاً — لا ما اتُّفق عليه. «الدخل الشهري» في الصفحات الأخرى هو الاتفاق؛ هنا الفواتير والدفعات
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

      <BillingBoard invoices={rows} thisMonth={thisMonth} emailReady={emailStatus().configured} />
    </div>
  );
}
