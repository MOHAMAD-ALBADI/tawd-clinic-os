/* Invoice vocabulary shared by the actions, the ledger, the row menu and the
   printable document — the status labels used to be copy-pasted into three files.

   Lives outside app/actions because a "use server" file may only export async
   functions; exporting a constant from one crashes at runtime while typecheck and
   build both pass. */

export type InvoiceStatus =
  | "draft" | "sent" | "paid" | "partially_paid"
  | "overdue" | "cancelled" | "refunded" | "written_off";

/** Statuses a human may set by hand. "paid", "partially_paid", "refunded" and
    "written_off" are absent on purpose: they follow from recorded payments and
    recorded adjustments, never from an opinion. */
export const MANUAL_STATUSES: InvoiceStatus[] = ["draft", "sent", "overdue", "cancelled"];

export const STATUS_META: Record<InvoiceStatus, { label: string; cls: string; color: string }> = {
  draft:          { label: "مسودة",        cls: "badge-mute",  color: "#a1a1aa" },
  sent:           { label: "مُرسلة",        cls: "badge-info",  color: "#38bdf8" },
  paid:           { label: "مدفوعة",        cls: "badge-ok",    color: "#4ADE80" },
  partially_paid: { label: "مدفوعة جزئياً", cls: "badge-warn",  color: "#fbbf24" },
  overdue:        { label: "متأخرة",        cls: "badge-bad",   color: "#F87171" },
  cancelled:      { label: "ملغاة",         cls: "badge-mute",  color: "#71717a" },
  refunded:       { label: "مستردة",        cls: "badge-brand", color: "var(--accent-1)" },
  written_off:    { label: "مشطوبة",        cls: "badge-mute",  color: "#a78bfa" },
};

/* The three ways an invoice can go backwards.

   They are easy to confuse and expensive to confuse, so each one carries the
   sentence that tells them apart — shown in the dialog, not left in a comment
   for the person who has to choose. */
export type AdjustmentKind = "refund" | "credit_note" | "write_off";

export const ADJUSTMENT_META: Record<AdjustmentKind, {
  label: string; short: string; hint: string; colour: string;
}> = {
  refund: {
    label: "استرداد",
    short: "فلوس ترجع للمريض",
    hint: "المريض دفع فعلاً وترجّعون له مبلغه. المبلغ يخرج من الصندوق، فلا يزيد عمّا حُصّل. "
        + "الاسترداد لا يعدّل الفاتورة — إن كانت الفاتورة نفسها خطأ فأصدروا إشعار دائن كذلك.",
    colour: "#a78bfa",
  },
  credit_note: {
    label: "إشعار دائن",
    short: "تصحيح مبلغ الفاتورة",
    hint: "الفاتورة صدرت بمبلغ أكبر من الصحيح، فيُنزَّل الفرق منها. لا تتحرك أي فلوس — "
        + "المستحق على المريض هو ما ينقص.",
    colour: "#38bdf8",
  },
  write_off: {
    label: "شطب",
    short: "دين يئستم من تحصيله",
    hint: "دين لن يُحصَّل، فيخرج من المستحقات ويُسجَّل خسارة في المصروفات تحت «ديون معدومة». "
        + "الفاتورة تبقى في السجل ولا تُحذف.",
    colour: "#fda4b4",
  },
};

export const REFUND_METHODS: { value: "cash" | "bank_transfer" | "thawani"; label: string }[] = [
  { value: "cash",          label: "نقداً من الصندوق" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "thawani",       label: "عكس عملية البطاقة" },
];

/** Oman's standard VAT rate. Health services are largely exempt, so this is
    opt-in per line rather than applied to everything. */
export const OMAN_VAT_RATE = 0.05;

/* GATEWAY_AR lived here and is gone. It had no entry for `card`, so once the
   clinic's own terminal became its own method a payment taken on it rendered as
   the untranslated word "card" on three screens — the manager's finance hub, the
   invoice document and the invoice row menu.

   That is the cost of a second vocabulary: it does not fail when a value is
   added, it just quietly stops covering it. METHOD_AR in lib/payment-methods.ts
   is the only one now. */

export const fmt3 = (n: number) =>
  Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
