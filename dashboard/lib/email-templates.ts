import "server-only";
import { esc, type ClinicIdentity } from "@/lib/email";

/* The messages themselves.

   Written as plain tables with inline styles, because email clients are not
   browsers: no external stylesheet is loaded, flexbox and grid are unreliable in
   Outlook, and a class attribute is frequently stripped. Anything clever here
   arrives as a stack of unstyled paragraphs on somebody's phone.

   RTL is set on the container rather than per element, and every number is
   wrapped so it does not get dragged around by the surrounding Arabic. */

const BRAND = "#1d4ed8";
const INK = "#0a0a09";
const MUTED = "#57534e";
const LINE = "#e7e5e4";

const omr = (v: number) =>
  Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Numbers stay left-to-right inside Arabic sentences. */
const num = (s: string | number) =>
  `<span dir="ltr" style="unicode-bidi:isolate">${esc(s)}</span>`;

function shell(clinic: ClinicIdentity, title: string, inner: string): string {
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;padding:0;background:#f5f5f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;
                    font-family:-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right">
        <tr><td style="background:${INK};padding:20px 24px">
          <div style="color:#ffffff;font-size:17px;font-weight:700">${esc(clinic.name)}</div>
          <div style="color:#a8a29e;font-size:12px;margin-top:2px">${esc(title)}</div>
        </td></tr>
        <tr><td style="padding:24px">${inner}</td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid ${LINE};background:#fafaf9">
          <div style="color:${MUTED};font-size:12px;line-height:1.7">
            ${clinic.phone ? `للاستفسار: ${num(clinic.phone)}<br>` : ""}
            ${clinic.replyTo ? `أو ردّوا على هذه الرسالة مباشرة<br>` : ""}
            <span style="color:#a8a29e">${esc(clinic.name)} — مُدار بنظام طَود</span>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function row(label: string, value: string, bold = false): string {
  return `<tr>
    <td style="padding:7px 0;color:${MUTED};font-size:13px">${esc(label)}</td>
    <td style="padding:7px 0;text-align:left;font-size:13px;color:${INK};${bold ? "font-weight:700" : ""}">${value}</td>
  </tr>`;
}

export type InvoiceEmail = {
  number: string;
  patientName: string;
  date: string;
  total: number;
  paid: number;
  outstanding: number;
  vat: number;
  items: { description: string; quantity: number; total: number }[];
};

export function invoiceEmail(clinic: ClinicIdentity, inv: InvoiceEmail) {
  const lines = inv.items.map((i) => `<tr>
      <td style="padding:8px 0;border-top:1px solid ${LINE};font-size:13px;color:${INK}">${esc(i.description)}</td>
      <td style="padding:8px 0;border-top:1px solid ${LINE};font-size:13px;color:${MUTED};text-align:center">${num(i.quantity)}</td>
      <td style="padding:8px 0;border-top:1px solid ${LINE};font-size:13px;color:${INK};text-align:left">${num(omr(i.total))}</td>
    </tr>`).join("");

  const settled = inv.outstanding <= 0.0005;

  const inner = `
    <p style="margin:0 0 4px;font-size:15px;color:${INK}">${esc(inv.patientName)}،</p>
    <p style="margin:0 0 18px;font-size:13px;color:${MUTED};line-height:1.8">
      هذه فاتورتكم رقم ${num(inv.number)} الصادرة بتاريخ ${num(inv.date)}.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <tr>
        <td style="padding-bottom:6px;font-size:11px;color:${MUTED}">البند</td>
        <td style="padding-bottom:6px;font-size:11px;color:${MUTED};text-align:center">الكمية</td>
        <td style="padding-bottom:6px;font-size:11px;color:${MUTED};text-align:left">المبلغ</td>
      </tr>
      ${lines}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border-top:2px solid ${LINE};padding-top:8px">
      ${inv.vat > 0 ? row("منها ضريبة القيمة المضافة", num(omr(inv.vat))) : ""}
      ${row("إجمالي الفاتورة", num(omr(inv.total)), true)}
      ${inv.paid > 0 ? row("المدفوع", `−${num(omr(inv.paid))}`) : ""}
      ${row(settled ? "المتبقّي" : "المبلغ المستحق", num(omr(Math.max(0, inv.outstanding))), true)}
    </table>

    <div style="margin-top:18px;padding:12px 14px;border-radius:10px;
                background:${settled ? "#ecfdf5" : "#fffbeb"};
                border:1px solid ${settled ? "#a7f3d0" : "#fde68a"};
                font-size:13px;color:${INK}">
      ${settled
        ? "الفاتورة مسدّدة بالكامل — شكراً لكم."
        : `المبلغ المستحق ${num(omr(inv.outstanding))} ر.ع، ويمكن سداده عند زيارتكم القادمة.`}
    </div>`;

  /* Subjects are plain text throughout — no num(), no esc(): the provider escapes
     the header itself and a span here would be shown literally. */
  return {
    subject: `فاتورة ${inv.number} — ${clinic.name}`,
    html: shell(clinic, "فاتورة", inner),
  };
}

export type ReceiptEmail = {
  receiptNo: string;
  patientName: string;
  amount: number;
  method: string;
  paidAt: string;
  invoiceNumber: string | null;
};

export function receiptEmail(clinic: ClinicIdentity, r: ReceiptEmail) {
  const inner = `
    <p style="margin:0 0 4px;font-size:15px;color:${INK}">${esc(r.patientName)}،</p>
    <p style="margin:0 0 18px;font-size:13px;color:${MUTED};line-height:1.8">
      استلمنا مبلغكم، وهذا سند القبض.
    </p>

    <div style="text-align:center;padding:20px;border-radius:12px;background:#f5f5f4;margin-bottom:16px">
      <div style="font-size:11px;color:${MUTED};margin-bottom:6px">المبلغ المستلم</div>
      <div style="font-size:30px;font-weight:800;color:${BRAND}">${num(omr(r.amount))}
        <span style="font-size:14px;font-weight:400;color:${MUTED}">ر.ع</span></div>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("رقم السند", num(r.receiptNo))}
      ${r.invoiceNumber ? row("عن الفاتورة", num(r.invoiceNumber)) : ""}
      ${row("طريقة الدفع", esc(r.method))}
      ${row("التاريخ", num(r.paidAt))}
    </table>

    <p style="margin:18px 0 0;font-size:12px;color:${MUTED};line-height:1.7">
      هذا السند إثبات استلام المبلغ المذكور أعلاه فقط، ولا يعني سداد الفاتورة بالكامل.
    </p>`;

  return {
    /* Plain text — a subject line is not markup, and num() emits a span. */
    subject: `سند قبض ${omr(r.amount)} ر.ع — ${clinic.name}`,
    html: shell(clinic, "سند قبض", inner),
  };
}

export type StatementEmail = {
  patientName: string;
  billed: number;
  collected: number;
  balance: number;
  lines: { at: string; label: string; delta: number; balance: number }[];
};

export function statementEmail(clinic: ClinicIdentity, st: StatementEmail) {
  /* The last dozen movements, not the whole history — an email is a summary and
     a hundred rows in one is unreadable on a phone. The clinic holds the full
     statement and can print it. */
  const recent = st.lines.slice(-12);
  const rows = recent.map((l) => `<tr>
      <td style="padding:7px 0;border-top:1px solid ${LINE};font-size:12px;color:${MUTED}">${num(l.at)}</td>
      <td style="padding:7px 0;border-top:1px solid ${LINE};font-size:12.5px;color:${INK}">${esc(l.label)}</td>
      <td style="padding:7px 0;border-top:1px solid ${LINE};font-size:12.5px;text-align:left;
                 color:${l.delta > 0 ? "#b45309" : "#047857"}">
        ${l.delta > 0 ? "" : "−"}${num(omr(Math.abs(l.delta)))}
      </td>
      <td style="padding:7px 0;border-top:1px solid ${LINE};font-size:12.5px;text-align:left;font-weight:700;color:${INK}">
        ${num(omr(l.balance))}
      </td>
    </tr>`).join("");

  const settled = st.balance <= 0.0005;

  const inner = `
    <p style="margin:0 0 4px;font-size:15px;color:${INK}">${esc(st.patientName)}،</p>
    <p style="margin:0 0 18px;font-size:13px;color:${MUTED};line-height:1.8">
      هذا كشف حسابكم لدينا.
    </p>

    <div style="text-align:center;padding:18px;border-radius:12px;
                background:${settled ? "#ecfdf5" : "#fffbeb"};margin-bottom:18px">
      <div style="font-size:11px;color:${MUTED};margin-bottom:6px">الرصيد المستحق</div>
      <div style="font-size:26px;font-weight:800;color:${settled ? "#047857" : "#b45309"}">
        ${num(omr(Math.max(0, st.balance)))}
        <span style="font-size:13px;font-weight:400;color:${MUTED}">ر.ع</span></div>
      ${settled ? `<div style="font-size:12px;color:#047857;margin-top:4px">لا مستحقات — شكراً لكم</div>` : ""}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-bottom:6px;font-size:11px;color:${MUTED}">التاريخ</td>
        <td style="padding-bottom:6px;font-size:11px;color:${MUTED}">الحركة</td>
        <td style="padding-bottom:6px;font-size:11px;color:${MUTED};text-align:left">المبلغ</td>
        <td style="padding-bottom:6px;font-size:11px;color:${MUTED};text-align:left">الرصيد</td>
      </tr>
      ${rows}
    </table>

    ${st.lines.length > recent.length
      ? `<p style="margin:12px 0 0;font-size:12px;color:${MUTED}">
           تُعرض آخر ${num(recent.length)} حركة من أصل ${num(st.lines.length)} — الكشف الكامل متاح في العيادة.
         </p>`
      : ""}`;

  return {
    subject: `كشف حساب — ${clinic.name}`,
    html: shell(clinic, "كشف حساب", inner),
  };
}
