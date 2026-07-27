import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clinicToday } from "@/lib/clinic-time";
import { arDate } from "@/lib/ar-format";
import { VatReturn, type VatInvoice } from "@/components/accountant/vat-return";
import { ArrowRight, AlertTriangle } from "lucide-react";

export const metadata = { title: "ضريبة القيمة المضافة — طود" };
export const dynamic = "force-dynamic";

/* Oman VAT: 5%, declared QUARTERLY, due within 30 days of the quarter closing.
   Late filing is an administrative penalty of OMR 500–5,000 and late payment
   carries 1% per month. Records must be kept ten years.

   The product charges the tax — vat_amount sits on every invoice — and had
   nowhere to read back what it collected. At filing time the accountant was
   exporting rows by hand, or guessing, against a five-thousand-rial penalty. */

function quarterOf(date: string) {
  const [y, m] = date.split("-").map(Number);
  const q = Math.floor((m - 1) / 3);            // 0..3
  const startMonth = q * 3 + 1;
  const start = `${y}-${String(startMonth).padStart(2, "0")}-01`;
  const endD = new Date(Date.UTC(y, startMonth + 2, 1)); // first day after
  const end = endD.toISOString().slice(0, 10);
  // filing deadline: 30 days after the quarter ends
  const due = new Date(endD.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  return { label: `Q${q + 1} ${y}`, start, end, due };
}

export default async function VatPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sp = await searchParams;
  const today = clinicToday();
  /* ?q=YYYY-MM picks the quarter containing that month; default is the one we
     are in, because that is the one being watched. */
  const anchor = /^\d{4}-\d{2}$/.test(sp.q ?? "") ? `${sp.q}-01` : today;
  const period = quarterOf(anchor);

  const sb = await createServerSupabaseClient();
  const [{ data: clinic }, { data: rows }] = await Promise.all([
    sb.from("tawd_clinics").select("name_ar, name, vat_number, vat_enabled")
      .eq("id", claims.clinic_id).maybeSingle(),
    /* Cancelled invoices are not supplies. Refunded ones are, and their credit
       belongs in the same period they were refunded — flagged rather than
       silently netted, because that is an accountant's call not a query's. */
    sb.from("invoices")
      .select("id, invoice_number, created_at, subtotal, discount_amount, vat_amount, total, status, patients!patient_id(name)")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .neq("status", "draft").neq("status", "cancelled")
      .gte("created_at", `${period.start}T00:00:00+04:00`)
      .lt("created_at", `${period.end}T00:00:00+04:00`)
      .order("created_at").limit(5000),
  ]);

  const invoices: VatInvoice[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    number: (r.invoice_number as string) ?? String(r.id).slice(0, 8),
    date: r.created_at as string,
    patientName: (r.patients as unknown as { name?: string } | null)?.name ?? "—",
    subtotal: Number(r.subtotal ?? 0),
    discount: Number(r.discount_amount ?? 0),
    vat: Number(r.vat_amount ?? 0),
    total: Number(r.total ?? 0),
    status: r.status as string,
  }));

  const daysToDue = Math.ceil((new Date(period.due).getTime() - Date.now()) / 86_400_000);
  const quarterClosed = today >= period.end;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <p className="eyebrow">VAT RETURN</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">ضريبة القيمة المضافة</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          إقرار ربع سنوي — {period.label} · من {arDate.format(new Date(`${period.start}T12:00:00+04:00`))}
        </p>
      </div>

      {/* The clinic is charging tax it cannot account for, or is not registered
          and should not be charging. Either way the accountant must know. */}
      {!clinic?.vat_enabled && (
        <div className="panel flex items-start gap-3" style={{ padding: "1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            ضريبة القيمة المضافة غير مفعّلة لهذه العيادة. التسجيل إلزامي في عُمان فوق ٣٨٬٥٠٠ ر.ع من الإيراد السنوي —
            فعّلها من <Link href="/clinic-admin/settings" className="underline" style={{ color: "var(--accent-1)" }}>الإعدادات</Link> إن كنتم مسجَّلين.
          </p>
        </div>
      )}
      {clinic?.vat_enabled && !clinic?.vat_number && (
        <div className="panel flex items-start gap-3" style={{ padding: "1rem 1.2rem", borderColor: "rgba(248,113,113,0.3)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fda4b4" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            الضريبة مفعّلة بلا رقم تسجيل ضريبي — الفواتير الصادرة لا تستوفي شروط الفاتورة الضريبية في عُمان.
            أضف الرقم من <Link href="/clinic-admin/settings" className="underline" style={{ color: "var(--accent-1)" }}>الإعدادات</Link>.
          </p>
        </div>
      )}

      <VatReturn
        invoices={invoices}
        period={period}
        daysToDue={daysToDue}
        quarterClosed={quarterClosed}
        clinicName={(clinic?.name_ar ?? clinic?.name ?? "") as string}
        vatNumber={(clinic?.vat_number as string | null) ?? null}
      />
    </div>
  );
}
