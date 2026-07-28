import "server-only";
import { esc } from "@/lib/email";

/* What TAWD sends its clinics.

   Tables with inline styles, because email clients are not browsers: no external
   stylesheet is fetched, flexbox is unreliable in Outlook, and class attributes
   are frequently stripped. Anything clever arrives as a stack of unstyled
   paragraphs on somebody's phone.

   RTL sits on the container, and numbers are isolated so Arabic text around them
   does not drag them out of order. */

const INK = "#0a0a09";
const MUTED = "#57534e";
const LINE = "#e7e5e4";
const BRAND = "#1d4ed8";

const omr = (v: number) =>
  Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const num = (s: string | number) =>
  `<span dir="ltr" style="unicode-bidi:isolate">${esc(s)}</span>`;

function shell(heading: string, inner: string): string {
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;padding:0;background:#f5f5f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;
                    font-family:-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right">
        <tr><td style="background:${INK};padding:20px 24px">
          <div style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.3px">طَود</div>
          <div style="color:#a8a29e;font-size:12px;margin-top:2px">${esc(heading)}</div>
        </td></tr>
        <tr><td style="padding:24px">${inner}</td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid ${LINE};background:#fafaf9">
          <div style="color:${MUTED};font-size:12px;line-height:1.7">
            هذه رسالة من فريق طَود بخصوص اشتراك عيادتكم.<br>
            <span style="color:#a8a29e">للاستفسار، ردّوا على هذه الرسالة مباشرة.</span>
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

function button(href: string, label: string): string {
  /* An anchor styled as a button, not a <button> — a form control in an email is
     either stripped or inert. */
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td style="border-radius:10px;background:${BRAND}">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;
         font-size:14px;font-weight:700;text-decoration:none;border-radius:10px">${esc(label)}</a>
    </td></tr></table>`;
}

export type InvoiceMail = {
  clinicName: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  total: number;
  outstanding: number;
  dueAt: string | null;
  payUrl: string;
};

export function subscriptionInvoiceMail(m: InvoiceMail) {
  const inner = `
    <p style="margin:0 0 4px;font-size:15px;color:${INK}">${esc(m.clinicName)}،</p>
    <p style="margin:0 0 18px;font-size:13px;color:${MUTED};line-height:1.8">
      صدرت فاتورة اشتراككم في طَود عن الفترة
      ${num(m.periodStart)} إلى ${num(m.periodEnd)}.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid ${LINE};border-radius:10px;padding:14px 16px">
      ${row("رقم الفاتورة", num(m.number))}
      ${row("إجمالي الفاتورة", `${num(omr(m.total))} ر.ع`)}
      ${m.dueAt ? row("تاريخ الاستحقاق", num(m.dueAt)) : ""}
      ${row("المبلغ المستحق", `${num(omr(m.outstanding))} ر.ع`, true)}
    </table>

    ${button(m.payUrl, "عرض الفاتورة والسداد")}

    <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.7">
      يمكنكم السداد بالبطاقة من داخل لوحة التحكم، أو بالتحويل البنكي وإبلاغنا به.
    </p>`;

  return {
    subject: `فاتورة اشتراك ${m.number} — طَود`,
    html: shell("فاتورة اشتراك", inner),
  };
}

export type DunningMail = {
  clinicName: string;
  number: string;
  outstanding: number;
  dueAt: string | null;
  daysLate: number;
  payUrl: string;
};

export function dunningMail(m: DunningMail) {
  /* Three tones on one template rather than three templates: the words change,
     the facts do not, and a clinic reading two differently-shaped emails about
     the same invoice is a clinic that thinks there are two invoices. */
  const firm = m.daysLate >= 14;
  const inner = `
    <p style="margin:0 0 4px;font-size:15px;color:${INK}">${esc(m.clinicName)}،</p>
    <p style="margin:0 0 18px;font-size:13px;color:${MUTED};line-height:1.8">
      ${m.daysLate <= 0
        ? `نذكّركم بأن فاتورة اشتراككم ${num(m.number)} تستحق السداد قريباً.`
        : `فاتورة اشتراككم ${num(m.number)} متأخرة عن موعد سدادها بـ ${num(m.daysLate)} يوماً.`}
    </p>

    <div style="padding:16px;border-radius:10px;text-align:center;
                background:${firm ? "#fef2f2" : "#fffbeb"};
                border:1px solid ${firm ? "#fecaca" : "#fde68a"};margin-bottom:18px">
      <div style="font-size:11px;color:${MUTED};margin-bottom:6px">المبلغ المستحق</div>
      <div style="font-size:28px;font-weight:800;color:${firm ? "#b91c1c" : "#b45309"}">
        ${num(omr(m.outstanding))}
        <span style="font-size:13px;font-weight:400;color:${MUTED}">ر.ع</span></div>
      ${m.dueAt ? `<div style="font-size:12px;color:${MUTED};margin-top:4px">
        استحقّت في ${num(m.dueAt)}</div>` : ""}
    </div>

    ${button(m.payUrl, "السداد الآن")}

    <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.7">
      ${firm
        ? "يُرجى السداد لتفادي إيقاف الخدمة مؤقتاً. إن كان هناك ما يمنع السداد، تواصلوا معنا وسنجد حلاً."
        : "إن كنتم قد سدّدتم بالفعل، تجاهلوا هذه الرسالة مشكورين."}
    </p>`;

  return {
    subject: m.daysLate > 0
      ? `تذكير: فاتورة ${m.number} متأخرة — طَود`
      : `تذكير بسداد فاتورة ${m.number} — طَود`,
    html: shell("تذكير بالسداد", inner),
  };
}

export type WelcomeMail = {
  clinicName: string;
  managerName: string;
  loginUrl: string;
  email: string;
  tempPassword: string | null;
};

export function welcomeMail(m: WelcomeMail) {
  const inner = `
    <p style="margin:0 0 4px;font-size:15px;color:${INK}">أهلاً ${esc(m.managerName)}،</p>
    <p style="margin:0 0 18px;font-size:13px;color:${MUTED};line-height:1.8">
      حساب <b style="color:${INK}">${esc(m.clinicName)}</b> جاهز على طَود.
      هذه بيانات الدخول لحسابكم كمدير للعيادة.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid ${LINE};border-radius:10px;padding:14px 16px">
      ${row("البريد", num(m.email))}
      ${m.tempPassword ? row("كلمة المرور المؤقتة", num(m.tempPassword), true) : ""}
    </table>

    ${button(m.loginUrl, "الدخول للوحة التحكم")}

    ${m.tempPassword ? `<p style="margin:0 0 12px;font-size:12px;color:#b45309;line-height:1.7">
      غيّروا كلمة المرور بعد أول دخول من «ملفي الشخصي».
    </p>` : ""}

    <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.7">
      من اللوحة تضيفون الأطباء والخدمات وتبدأون استقبال الحجوزات. نحن معكم في كل خطوة.
    </p>`;

  return {
    subject: `حساب ${m.clinicName} جاهز — طَود`,
    html: shell("مرحباً بكم", inner),
  };
}
