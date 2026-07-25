import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AddInvoiceTrigger } from "@/components/invoices/invoice-form-trigger";
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions";
import { STATUS_META, fmt3 as fmt, type InvoiceStatus } from "@/lib/invoice-meta";
import { FileText, Calendar, Clock } from "lucide-react";

export const metadata = { title: "الفواتير — طود" };
export const dynamic = "force-dynamic";

type Invoice = {
  id: string; total: number; subtotal: number; vat_amount: number;
  status: string; due_date: string | null; created_at: string; invoice_number: string;
  patients: { name: string } | null;
};

export default async function InvoicesPage() {
  const claims = (await getUserClaims())!; // the finance layout already gated this
  const supabase = await createServerSupabaseClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [{ data, count }, { data: monthPayData }, { data: monthData }, { data: patientsData }, { data: servicesData }] = await Promise.all([
    supabase.from("invoices")
      .select("id,invoice_number,total,subtotal,vat_amount,status,due_date,created_at,patients(name)", { count: "exact" })
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(100),
    /* Revenue is money received, not invoices flagged paid — the two diverge on a
       partially paid invoice, and the day-close reconciles against payments. */
    supabase.from("payments").select("amount").eq("clinic_id", claims.clinic_id)
      .eq("status", "completed").gte("paid_at", monthStart),
    supabase.from("invoices").select("total,status").eq("clinic_id", claims.clinic_id).is("deleted_at", null).gte("created_at", monthStart),
    supabase.from("patients").select("id,name,phone").eq("clinic_id", claims.clinic_id).is("deleted_at", null).eq("is_archived", false).order("name"),
    supabase.from("services").select("id,name,price").eq("clinic_id", claims.clinic_id).is("deleted_at", null).eq("is_active", true).order("name"),
  ]);

  const invoices  = (data ?? []) as unknown as Invoice[];
  const monthInvs = monthData ?? [];
  const patients  = (patientsData ?? []) as { id: string; name: string; phone: string | null }[];
  const services  = (servicesData ?? []) as { id: string; name: string; price: number }[];

  /* Per-invoice settled amount, so the row menu knows what is still owed and can
     stop a clinic collecting more than the invoice is worth. */
  const paidByInvoice = new Map<string, number>();
  if (invoices.length) {
    const { data: pays } = await supabase.from("payments")
      .select("invoice_id, amount").eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .in("invoice_id", invoices.map((i) => i.id));
    for (const p of pays ?? []) {
      const k = p.invoice_id as string;
      paidByInvoice.set(k, (paidByInvoice.get(k) ?? 0) + (Number(p.amount) || 0));
    }
  }

  const totalRevenue = (monthPayData ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalPending = monthInvs.filter((i) => ["sent", "partially_paid", "overdue"].includes(i.status)).reduce((s, i) => s + (i.total ?? 0), 0);
  const countOverdue = invoices.filter((i) => i.status === "overdue").length;
  const countPaid    = invoices.filter((i) => i.status === "paid").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 -mt-1">
        <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
          فوترة الخدمات وتحصيلها — الفاتورة المدفوعة تُقيَّد إيراداً وتُنشئ عمولة الطبيب تلقائياً
        </p>
        <AddInvoiceTrigger patients={patients} services={services} />
      </div>

      {/* Hero row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 panel-feature" style={{ padding: "1.75rem 2rem" }}>
          <p className="eyebrow mb-3">محصَّل هذا الشهر</p>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-black ltr-nums leading-none text-gradient-brand"
              style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.5rem)", letterSpacing: "-0.04em" }}>
              {fmt(totalRevenue)}
            </span>
            <span className="text-lg font-bold" style={{ color: "var(--color-brand-400)" }}>ر.ع</span>
          </div>
          <p className="text-[11px] mb-5" style={{ color: "var(--text-3)" }}>دفعات وصلت فعلاً — لا فواتير مؤشَّرة يدوياً</p>
          <div className="flex items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--hairline)" }}>
            <Clock className="w-3.5 h-3.5" style={{ color: "var(--color-warn)" }} />
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>معلّق التحصيل:</span>
            <span className="text-[12px] font-bold ltr-nums" style={{ color: "var(--color-warn)" }}>{fmt(totalPending)} ر.ع</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 panel" style={{ padding: "1.25rem" }}>
          <p className="eyebrow mb-4">توزيع الحالات</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(STATUS_META).filter(([k]) => k !== "cancelled").map(([status, cfg]) => {
              const n = invoices.filter((i) => i.status === status).length;
              return (
                <div key={status} className="text-center rounded-2xl py-3 px-1 panel-2">
                  <p className="text-[18px] font-black ltr-nums leading-none mb-1 text-white">{n}</p>
                  <p className="text-[9px] font-bold" style={{ color: "var(--text-3)" }}>{cfg.label}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4 flex-wrap" style={{ borderTop: "1px solid var(--hairline)" }}>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-ok)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>مدفوعة</span>
              <span className="text-[13px] font-black ltr-nums" style={{ color: "var(--color-ok)" }}>{countPaid}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-bad)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>متأخرة</span>
              <span className="text-[13px] font-black ltr-nums" style={{ color: "var(--color-bad)" }}>{countOverdue}</span>
            </div>
            <div className="flex items-center gap-1.5 ms-auto">
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>الإجمالي</span>
              <span className="text-[13px] font-black ltr-nums text-white">{count ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div>
            <p className="eyebrow">LEDGER</p>
            <p className="text-sm font-bold text-white mt-0.5">سجل الفواتير</p>
          </div>
          <span className="badge badge-brand ltr-nums">{count ?? 0}</span>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.16)" }}>
              <FileText className="w-5 h-5" style={{ color: "var(--color-brand-400)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>لا توجد فواتير بعد — أنشئ أول فاتورة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.012)" }}>
                  {["الفاتورة", "المريض", "التاريخ", "الإجمالي", "الحالة", ""].map((h, i) => (
                    <th key={i} className="text-right py-3 px-6 eyebrow">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const s = STATUS_META[inv.status as InvoiceStatus] ?? STATUS_META.draft;
                  const patient = inv.patients as { name: string } | null;
                  return (
                    <tr key={inv.id} className="row-hover" style={{ borderTop: "1px solid var(--hairline-2)" }}>
                      <td className="py-3.5 px-6 font-mono text-[12px] ltr-nums" style={{ color: "var(--text-2)" }}>{inv.invoice_number}</td>
                      <td className="py-3.5 px-6 font-semibold text-[13px] text-white">{patient?.name ?? "—"}</td>
                      <td className="py-3.5 px-6">
                        <span className="flex items-center gap-1.5 text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>
                          <Calendar className="w-3 h-3" />{new Date(inv.created_at).toLocaleDateString("en-US")}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-bold text-[13px] ltr-nums" style={{ color: "var(--color-brand-300)" }}>
                        {fmt(inv.total ?? 0)} <span className="text-[10px] font-normal" style={{ color: "var(--text-4)" }}>ر.ع</span>
                      </td>
                      <td className="py-3.5 px-6"><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td className="py-3.5 px-4"><InvoiceRowActions id={inv.id} status={inv.status} total={inv.total ?? 0} paid={paidByInvoice.get(inv.id) ?? 0} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
