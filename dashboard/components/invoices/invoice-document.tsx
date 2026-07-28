import { STATUS_META, fmt3 as fmt, type InvoiceStatus } from "@/lib/invoice-meta";
import { METHOD_AR } from "@/lib/payment-methods";

/* The tax invoice itself, as a document.

   It lived inside the manager's route, so the accountant — the person who
   actually issues invoices — had no way to print one. Nothing linked to it from
   their side and their sidebar does not carry that route.

   Extracted rather than copied: a second copy of a legal document drifts, and the
   one that drifts is the one somebody hands to a patient. */

export type DocInvoice = {
  invoice_number: string;
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
  status: string;
  due_date: string | null;
  created_at: string;
  notes: string | null;
};

export type DocItem = {
  id: string; description: string; quantity: number;
  unit_price_snapshot: number; vat_amount: number; total: number;
};

export type DocPayment = { id: string; amount: number; gateway: string; paid_at: string | null };

export type DocClinic = {
  name: string | null; name_ar: string | null;
  vat_number: string | null; phone: string | null; address: string | null;
};

const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB") : "—");

export function InvoiceDocument({
  invoice, items, payments, clinic, patient, adjustments = [],
}: {
  invoice: DocInvoice;
  items: DocItem[];
  payments: DocPayment[];
  clinic: DocClinic | null;
  patient: { name: string | null; phone: string | null } | null;
  /** credit notes and write-offs, which change what is actually owed */
  adjustments?: { id: string; kind: string; amount: number; reason: string }[];
}) {
  const clinicName = clinic?.name_ar ?? clinic?.name ?? "طود";
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const credited = adjustments
    .filter((a) => a.kind === "credit_note" || a.kind === "write_off")
    .reduce((s, a) => s + a.amount, 0);
  const refunded = adjustments
    .filter((a) => a.kind === "refund")
    .reduce((s, a) => s + a.amount, 0);
  const balance = Math.round((Number(invoice.total) - credited - (paidTotal - refunded)) * 1000) / 1000;

  return (
    <div id="invoice-doc" className="mx-auto" style={{ maxWidth: 820 }}>
      <div className="panel" style={{ padding: "2.5rem", background: "var(--surface-1)" }}>
        <div className="flex items-start justify-between gap-6 pb-6" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div>
            <p className="eyebrow mb-1" style={{ color: "var(--color-brand-400)" }}>
              {clinic?.vat_number && Number(invoice.total) < 500
                ? "فاتورة ضريبية مبسطة · SIMPLIFIED TAX INVOICE"
                : "INVOICE · فاتورة"}
            </p>
            <h1 className="text-2xl font-black text-white print:text-black leading-none">{clinicName}</h1>
            {clinic?.address && <p className="text-[12px] mt-2" style={{ color: "var(--text-3)" }}>{clinic.address}</p>}
            {clinic?.phone && <p className="text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>{clinic.phone}</p>}
            {clinic?.vat_number && (
              <p className="text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>
                الرقم الضريبي: {clinic.vat_number}
              </p>
            )}
          </div>
          <div className="text-left">
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>رقم الفاتورة</p>
            <p className="text-lg font-black ltr-nums text-white print:text-black">{invoice.invoice_number}</p>
            <span className="badge badge-brand mt-2 inline-flex">
              {STATUS_META[invoice.status as InvoiceStatus]?.label ?? invoice.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="eyebrow mb-1.5">فاتورة إلى</p>
            <p className="text-[15px] font-bold text-white print:text-black">{patient?.name ?? "—"}</p>
            {patient?.phone && (
              <p className="text-[13px] ltr-nums" style={{ color: "var(--text-2)" }}>{patient.phone}</p>
            )}
          </div>
          <div className="text-left">
            <p className="text-[13px] mb-1" style={{ color: "var(--text-3)" }}>
              تاريخ الإصدار: <span className="ltr-nums text-white print:text-black">{d(invoice.created_at)}</span>
            </p>
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
              تاريخ الاستحقاق: <span className="ltr-nums text-white print:text-black">{d(invoice.due_date)}</span>
            </p>
          </div>
        </div>

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
            {items.map((l) => (
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

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <Line label="المجموع الفرعي" value={`${fmt(invoice.subtotal)} ر.ع`} />
            {Number(invoice.discount_amount) > 0 && (
              <Line label="الخصم" value={`−${fmt(invoice.discount_amount)} ر.ع`} />
            )}
            <Line label="الضريبة" value={`${fmt(invoice.vat_amount)} ر.ع`} />
            <div className="flex justify-between pt-2.5 mt-1" style={{ borderTop: "1px solid var(--hairline)" }}>
              <span className="font-bold text-white print:text-black">الإجمالي</span>
              <span className="font-black ltr-nums text-lg text-gradient-brand print:text-black">
                {fmt(invoice.total)} <span className="text-sm">ر.ع</span>
              </span>
            </div>

            {/* A credit note changes what is owed, and a document that omits it
                is asking the patient for money the clinic already wrote off. */}
            {credited > 0 && (
              <div className="flex justify-between text-[13px] pt-2" style={{ color: "var(--text-3)" }}>
                <span>إشعار دائن / شطب</span>
                <span className="ltr-nums" style={{ color: "#c4b5fd" }}>−{fmt(credited)} ر.ع</span>
              </div>
            )}
            {paidTotal > 0 && (
              <div className="flex justify-between text-[13px] pt-2" style={{ color: "var(--text-3)" }}>
                <span>المدفوع</span>
                <span className="ltr-nums" style={{ color: "var(--color-ok)" }}>−{fmt(paidTotal)} ر.ع</span>
              </div>
            )}
            {refunded > 0 && (
              <div className="flex justify-between text-[13px]" style={{ color: "var(--text-3)" }}>
                <span>مستردّ للمريض</span>
                <span className="ltr-nums" style={{ color: "#c4b5fd" }}>+{fmt(refunded)} ر.ع</span>
              </div>
            )}
            {(paidTotal > 0 || credited > 0) && (
              <div className="flex justify-between text-[13px] font-bold">
                <span className="text-white print:text-black">المتبقّي</span>
                <span className="ltr-nums"
                  style={{ color: balance > 0 ? "var(--color-warn)" : "var(--color-ok)" }}>
                  {fmt(Math.max(0, balance))} ر.ع
                </span>
              </div>
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
                    {METHOD_AR(p.gateway)} · <span className="ltr-nums">{d(p.paid_at)}</span>
                  </span>
                  <span className="ltr-nums font-bold text-white print:text-black">{fmt(p.amount)} ر.ع</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {adjustments.length > 0 && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--hairline-2)" }}>
            <p className="eyebrow mb-2">التسويات</p>
            <div className="space-y-1">
              {adjustments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="truncate" style={{ color: "var(--text-2)" }}>
                    {a.kind === "refund" ? "استرداد" : a.kind === "credit_note" ? "إشعار دائن" : "شطب"}
                    {" — "}{a.reason}
                  </span>
                  <span className="ltr-nums font-bold shrink-0" style={{ color: "#c4b5fd" }}>
                    {fmt(a.amount)} ر.ع
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoice.notes && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--hairline-2)" }}>
            <p className="eyebrow mb-1">ملاحظات</p>
            <p className="text-[13px]" style={{ color: "var(--text-2)" }}>{invoice.notes}</p>
          </div>
        )}

        <p className="text-center text-[11px] mt-8" style={{ color: "var(--text-4)" }}>
          شكراً لثقتكم · {clinicName} · مدعوم بـ سُرى
        </p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="ltr-nums" style={{ color: "var(--text-1)" }}>{value}</span>
    </div>
  );
}
