import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolvePeriod, withinPeriod } from "@/lib/period";
import { PeriodPicker } from "@/components/finance/period-picker";
import { RevenueBreakdown, type Slice, type MonthPoint } from "@/components/accountant/revenue-breakdown";
import { bucketOf, METHOD_AR } from "@/lib/payment-methods";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "تحليل الإيراد — طود" };
export const dynamic = "force-dynamic";

/* Where the money actually comes from.

   The finance section could say how much came in and never what it came from. A
   clinic decides which services to push, which doctor's diary to protect and
   whether the card machine is worth its fee — and none of those questions had an
   answer anywhere in the product.

   Two different measures are kept apart on purpose. Billed is what was invoiced
   in the period, which is what service and doctor breakdowns must use because a
   line item belongs to the invoice it was raised on. Collected is money that
   actually arrived, which is what the method breakdown must use because a method
   only exists at the moment of payment. Mixing them produces the classic finance
   report where the pie does not add up to the headline. */
export default async function RevenuePage({
  searchParams,
}: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const period = resolvePeriod(await searchParams);

  const invoiceQ = sb.from("invoices")
    .select("id, total, created_at, appt_id, status")
    .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
    .neq("status", "draft").neq("status", "cancelled");

  const paymentQ = sb.from("payments")
    .select("amount, gateway, paid_at")
    .eq("clinic_id", claims.clinic_id).eq("status", "completed");

  const [{ data: invoices }, { data: payments }] = await Promise.all([
    withinPeriod(invoiceQ, "created_at", period).limit(5000),
    withinPeriod(paymentQ, "paid_at", period).limit(8000),
  ]);

  const invIds = (invoices ?? []).map((i) => i.id as string);

  /* Line items carry the service; the appointment carries the doctor. Both are
     read per invoice rather than per appointment, because an invoice raised by
     hand has items and no appointment at all. */
  const [{ data: items }, { data: appts }] = await Promise.all([
    invIds.length
      ? sb.from("invoice_items")
          .select("invoice_id, description, description_ar, total, service_id, services!service_id(name_ar, name)")
          .in("invoice_id", invIds.slice(0, 900))
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    invIds.length
      ? sb.from("appointments")
          .select("id, doctor_id, tawd_staff_users!doctor_id(name, name_ar)")
          .eq("clinic_id", claims.clinic_id)
          .in("id", (invoices ?? []).map((i) => i.appt_id as string).filter(Boolean).slice(0, 900))
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  /* ── by service ── */
  const svcMap = new Map<string, Slice>();
  for (const it of items ?? []) {
    const svc = it.services as unknown as { name_ar?: string; name?: string } | null;
    const label = svc?.name_ar ?? svc?.name
      ?? (it.description_ar as string | null) ?? (it.description as string) ?? "غير مصنّف";
    const cur = svcMap.get(label) ?? { label, total: 0, count: 0 };
    cur.total += Number(it.total ?? 0);
    cur.count += 1;
    svcMap.set(label, cur);
  }

  /* ── by doctor ── */
  const doctorOfAppt = new Map<string, string>();
  for (const a of appts ?? []) {
    const d = a.tawd_staff_users as unknown as { name?: string; name_ar?: string } | null;
    doctorOfAppt.set(a.id as string, d?.name_ar ?? d?.name ?? "غير محدّد");
  }
  const docMap = new Map<string, Slice>();
  for (const inv of invoices ?? []) {
    const label = inv.appt_id
      ? doctorOfAppt.get(inv.appt_id as string) ?? "غير محدّد"
      : "بلا موعد";
    const cur = docMap.get(label) ?? { label, total: 0, count: 0 };
    cur.total += Number(inv.total ?? 0);
    cur.count += 1;
    docMap.set(label, cur);
  }

  /* ── by method (collected, not billed) ── */
  const methodMap = new Map<string, Slice>();
  for (const p of payments ?? []) {
    const label = METHOD_AR(p.gateway as string);
    const cur = methodMap.get(label) ?? { label, total: 0, count: 0 };
    cur.total += Number(p.amount ?? 0);
    cur.count += 1;
    methodMap.set(label, cur);
  }

  /* ── month by month: billed against collected ──
     The gap between the two lines is the collection problem, and it is invisible
     when either is plotted alone. */
  const months = new Map<string, MonthPoint>();
  const touch = (key: string) =>
    months.get(key) ?? { month: key, billed: 0, collected: 0 };
  for (const inv of invoices ?? []) {
    const k = (inv.created_at as string).slice(0, 7);
    const m = touch(k); m.billed += Number(inv.total ?? 0); months.set(k, m);
  }
  for (const p of payments ?? []) {
    const k = (p.paid_at as string).slice(0, 7);
    const m = touch(k); m.collected += Number(p.amount ?? 0); months.set(k, m);
  }

  const sorted = (m: Map<string, Slice>) =>
    [...m.values()].sort((a, b) => b.total - a.total);

  const billedTotal = (invoices ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);
  const collectedTotal = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  /* Cash in hand versus money that lands in a bank — the split that decides how
     much float the clinic actually needs. */
  let drawer = 0;
  for (const p of payments ?? []) {
    if (bucketOf(p.gateway as string) === "drawer") drawer += Number(p.amount ?? 0);
  }

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs"
        style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <p className="eyebrow">REVENUE</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">تحليل الإيراد</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          من أين يأتي الدخل — بالخدمة وبالطبيب وبطريقة الدفع
        </p>
      </div>

      <PeriodPicker active={period.key} from={period.from} to={period.to} label={period.label} />

      <RevenueBreakdown
        billed={billedTotal}
        collected={collectedTotal}
        drawer={drawer}
        invoiceCount={(invoices ?? []).length}
        byService={sorted(svcMap)}
        byDoctor={sorted(docMap)}
        byMethod={sorted(methodMap)}
        months={[...months.values()].sort((a, b) => a.month.localeCompare(b.month))}
        periodLabel={period.label}
      />
    </div>
  );
}
