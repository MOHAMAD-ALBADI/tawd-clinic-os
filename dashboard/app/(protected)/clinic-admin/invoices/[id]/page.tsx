import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PrintInvoiceButton } from "@/components/invoices/print-button";
import { ChevronRight } from "lucide-react";

export const metadata = { title: "فاتورة — طود" };

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", sent: "مُرسلة", paid: "مدفوعة", partially_paid: "مدفوعة جزئياً",
  overdue: "متأخرة", cancelled: "ملغاة", refunded: "مستردة",
};

const fmt = (n: number) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB") : "—");

type Item = { id: string; description: string; quantity: number; unit_price_snapshot: number; vat_amount: number; total: number };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const [{ data: inv }, { data: items }, { data: clinic }] = await Promise.all([
    supabase.from("invoices")
      .select("id,invoice_number,subtotal,discount_amount,vat_amount,total,status,due_date,created_at,notes,patients(name,phone)")
      .eq("id", id).eq("clinic_id", claims.clinic_id).maybeSingle(),
    supabase.from("invoice_items")
      .select("id,description,quantity,unit_price_snapshot,vat_amount,total")
      .eq("invoice_id", id).eq("clinic_id", claims.clinic_id).order("sort_order"),
    supabase.from("tawd_clinics")
      .select("name,name_ar,vat_number,phone,address").eq("id", claims.clinic_id).maybeSingle(),
  ]);

  if (!inv) notFound();

  const patient = inv.patients as unknown as { name: string; phone: string | null } | null;
  const lines = (items ?? []) as Item[];
  const clinicName = clinic?.name_ar ?? clinic?.name ?? "طود";

  return (
    <div className="animate-fade-in">
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between mb-4 no-print">
        <Link href="/clinic-admin/invoices" className="btn-ghost">
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
              <p className="eyebrow mb-1" style={{ color: "var(--color-brand-400)" }}>INVOICE · فاتورة</p>
              <h1 className="text-2xl font-black text-white print:text-black leading-none">{clinicName}</h1>
              {clinic?.address && <p className="text-[12px] mt-2" style={{ color: "var(--text-3)" }}>{clinic.address}</p>}
              {clinic?.phone && <p className="text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>{clinic.phone}</p>}
              {clinic?.vat_number && <p className="text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>الرقم الضريبي: {clinic.vat_number}</p>}
            </div>
            <div className="text-left">
              <p className="text-[12px]" style={{ color: "var(--text-3)" }}>رقم الفاتورة</p>
              <p className="text-lg font-black ltr-nums text-white print:text-black">{inv.invoice_number}</p>
              <span className="badge badge-brand mt-2 inline-flex">{STATUS_LABEL[inv.status] ?? inv.status}</span>
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
                <th className="text-left py-2.5 eyebrow">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--hairline-2)" }}>
                  <td className="py-3 text-[13px] text-white print:text-black">{l.description}</td>
                  <td className="py-3 text-center text-[13px] ltr-nums" style={{ color: "var(--text-2)" }}>{l.quantity}</td>
                  <td className="py-3 text-left text-[13px] ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(l.unit_price_snapshot)}</td>
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
            </div>
          </div>

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
