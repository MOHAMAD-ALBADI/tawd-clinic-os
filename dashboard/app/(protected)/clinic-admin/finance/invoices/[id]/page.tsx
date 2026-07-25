import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PrintInvoiceButton } from "@/components/invoices/print-button";
import { STATUS_META, GATEWAY_AR, fmt3 as fmt, type InvoiceStatus } from "@/lib/invoice-meta";
import { ChevronRight } from "lucide-react";

export const metadata = { title: "فاتورة — طود" };
export const dynamic = "force-dynamic";
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB") : "—");

type Item = { id: string; description: string; quantity: number; unit_price_snapshot: number; vat_amount: number; total: number };
type Payment = { id: string; amount: number; gateway: string; paid_at: string | null };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "accountant"))) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const [{ data: inv }, { data: items }, { data: clinic }, { data: pays }] = await Promise.all([
    supabase.from("invoices")
      .select("id,invoice_number,subtotal,discount_amount,vat_amount,total,status,due_date,created_at,notes,patients(name,phone)")
      .eq("id", id).eq("clinic_id", claims.clinic_id).maybeSingle(),
    supabase.from("invoice_items")
      .select("id,description,quantity,unit_price_snapshot,vat_amount,total")
      .eq("invoice_id", id).eq("clinic_id", claims.clinic_id).order("sort_order"),
    supabase.from("tawd_clinics")
      .select("name,name_ar,vat_number,phone,address").eq("id", claims.clinic_id).maybeSingle(),
    supabase.from("payments")
      .select("id,amount,gateway,paid_at").eq("invoice_id", id).eq("clinic_id", claims.clinic_id)
      .eq("status", "completed").order("paid_at"),
  ]);

  if (!inv) notFound();

  const patient = inv.patients as unknown as { name: string; phone: string | null } | null;
  const lines = (items ?? []) as Item[];
  const clinicName = clinic?.name_ar ?? clinic?.name ?? "طود";

  const payments = (pays ?? []) as Payment[];
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const balance = Math.round((Number(inv.total ?? 0) - paidTotal) * 1000) / 1000;

  return (
    <div className="animate-fade-in">
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between mb-4 no-print">
        <Link href="/clinic-admin/finance/invoices" className="btn-ghost">
          <ChevronRight className="w-4 h-4" /> رجوع للفواتير
        </Link>
        <PrintInvoiceButton />
      </div>

      {/* The printable document */}
      <div id="invoice-doc" className="mx-auto" style={{ maxWidth: 820 }}>
        <div className="panel" style={{ padding: "2.5rem", background: "var(--surface-1)" }}>
          {/* Header */}
          <div className="flex items-start justify-between gap-6 pb-6" style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div>
              <p className="eyebrow mb-1" style={{ color: "var(--color-brand-400)" }}>
                {clinic?.vat_number && Number(inv.total) < 500 ? "فاتورة ضريبية مبسطة · SIMPLIFIED TAX INVOICE" : "INVOICE · فاتورة"}
              </p>
              <h1 className="text-2xl font-black text-white print:text-black leading-none">{clinicName}</h1>
              {clinic?.address && <p className="text-[12px] mt-2" style={{ color: "var(--text-3)" }}>{clinic.address}</p>}
              {clinic?.phone && <p className="text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>{clinic.phone}</p>}
              {clinic?.vat_number && <p className="text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>الرقم الضريبي: {clinic.vat_number}</p>}
            </div>
            <div className="text-left">
              <p className="text-[12px]" style={{ color: "var(--text-3)" }}>رقم الفاتورة</p>
              <p className="text-lg font-black ltr-nums text-white print:text-black">{inv.invoice_number}</p>
              <span className="badge badge-brand mt-2 inline-flex">{STATUS_META[inv.status as InvoiceStatus]?.label ?? inv.status}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-6 py-6">
            <div>
              <p className="eyebrow mb-1.5">فاتورة إلى</p>
              <p className="text-[15px] font-bold text-white print:text-black">{patient?.name ?? "—"}</p>
              {patient?.phone && <p className="text-[13px] ltr-nums" style={{ color: "var(--text-2)" }}>{patient.phone}</p>}
            </div>
            <div className="text-left">
              <p className="text-[13px] mb-1" style={{ color: "var(--text-3)" }}>تاريخ الإصدار: <span className="ltr-nums text-white print:text-black">{d(inv.created_at)}</span></p>
              <p className="text-[13px]" style={{ color: "var(--text-3)" }}>تاريخ الاستحقاق: <span className="ltr-nums text-white print:text-black">{d(inv.due_date)}</span></p>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full mb-6">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                <th className="text-right py-2.5 eyebrow">البند</th>
                <th className="text-center py-2.5 eyebrow">الكمية</th>
                <th className="text-left py-2.5 eyebrow">السعر</th>
                {/* A tax invoice has to show the tax on each line, not only the sum */}
                <th className="text-left py-2.5 eyebrow">الضريبة</th>
                <th className="text-left py-2.5 eyebrow">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--hairline-2)" }}>
                  <td className="py-3 text-[13px] text-white print:text-black">{l.description}</td>
                  <td className="py-3 text-center text-[13px] ltr-nums" style={{ color: "var(--text-2)" }}>{l.quantity}</td>
                  <td className="py-3 text-left text-[13px] ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(l.unit_price_snapshot)}</td>
                  <td className="py-3 text-left text-[13px] ltr-nums" style={{ color: "var(--text-2)" }}>
                    {Number(l.vat_amount) > 0 ? fmt(l.vat_amount) : "معفى"}
                  </td>
                  <td className="py-3 text-left text-[13px] ltr-nums font-bold text-white print:text-black">{fmt(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-[13px]"><span style={{ color: "var(--text-3)" }}>المجموع الفرعي</span><span className="ltr-nums" style={{ color: "var(--text-1)" }}>{fmt(inv.subtotal)} ر.ع</span></div>
              {Number(inv.discount_amount) > 0 && <div className="flex justify-between text-[13px]"><span style={{ color: "var(--text-3)" }}>الخصم</span><span className="ltr-nums" style={{ color: "var(--text-1)" }}>−{fmt(inv.discount_amount)} ر.ع</span></div>}
              <div className="flex justify-between text-[13px]"><span style={{ color: "var(--text-3)" }}>الضريبة</span><span className="ltr-nums" style={{ color: "var(--text-1)" }}>{fmt(inv.vat_amount)} ر.ع</span></div>
              <div className="flex justify-between pt-2.5 mt-1" style={{ borderTop: "1px solid var(--hairline)" }}>
                <span className="font-bold text-white print:text-black">الإجمالي</span>
                <span className="font-black ltr-nums text-lg text-gradient-brand print:text-black">{fmt(inv.total)} <span className="text-sm">ر.ع</span></span>
              </div>

              {/* What has actually been collected. Whoever is holding this sheet
                  needs the balance, not just the invoice value. */}
              {paidTotal > 0 && (
                <>
                  <div className="flex justify-between text-[13px] pt-2" style={{ color: "var(--text-3)" }}>
                    <span>المدفوع</span>
                    <span className="ltr-nums" style={{ color: "var(--color-ok)" }}>−{fmt(paidTotal)} ر.ع</span>
                  </div>
                  <div className="flex justify-between text-[13px] font-bold">
                    <span className="text-white print:text-black">المتبقّي</span>
                    <span className="ltr-nums" style={{ color: balance > 0 ? "var(--color-warn)" : "var(--color-ok)" }}>
                      {fmt(balance)} ر.ع
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {payments.length > 0 && (
            <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--hairline-2)" }}>
              <p className="eyebrow mb-2">الدفعات المستلمة</p>
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[12.5px]">
                    <span style={{ color: "var(--text-2)" }}>
                      {GATEWAY_AR[p.gateway] ?? p.gateway} · <span className="ltr-nums">{d(p.paid_at)}</span>
                    </span>
                    <span className="ltr-nums font-bold text-white print:text-black">{fmt(p.amount)} ر.ع</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inv.notes && (
            <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--hairline-2)" }}>
              <p className="eyebrow mb-1">ملاحظات</p>
              <p className="text-[13px]" style={{ color: "var(--text-2)" }}>{inv.notes}</p>
            </div>
          )}

          <p className="text-center text-[11px] mt-8" style={{ color: "var(--text-4)" }}>
            شكراً لثقتكم · {clinicName} · مدعوم بـ سُرى
          </p>
        </div>
      </div>
    </div>
  );
}
