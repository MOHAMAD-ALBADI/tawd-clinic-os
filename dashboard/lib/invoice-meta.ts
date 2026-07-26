/* Invoice vocabulary shared by the actions, the ledger, the row menu and the
   printable document — the status labels used to be copy-pasted into three files.

   Lives outside app/actions because a "use server" file may only export async
   functions; exporting a constant from one crashes at runtime while typecheck and
   build both pass. */

export type InvoiceStatus =
  | "draft" | "sent" | "paid" | "partially_paid"
  | "overdue" | "cancelled" | "refunded";

/** Statuses a human may set by hand. "paid" and "partially_paid" are absent on
    purpose: they follow from recorded payments, never from an opinion. */
export const MANUAL_STATUSES: InvoiceStatus[] = ["draft", "sent", "overdue", "cancelled"];

export const STATUS_META: Record<InvoiceStatus, { label: string; cls: string; color: string }> = {
  draft:          { label: "مسودة",        cls: "badge-mute",  color: "#a1a1aa" },
  sent:           { label: "مُرسلة",        cls: "badge-info",  color: "#38bdf8" },
  paid:           { label: "مدفوعة",        cls: "badge-ok",    color: "#4ADE80" },
  partially_paid: { label: "مدفوعة جزئياً", cls: "badge-warn",  color: "#fbbf24" },
  overdue:        { label: "متأخرة",        cls: "badge-bad",   color: "#F87171" },
  cancelled:      { label: "ملغاة",         cls: "badge-mute",  color: "#71717a" },
  refunded:       { label: "مستردة",        cls: "badge-brand", color: "var(--accent-1)" },
};

/** Oman's standard VAT rate. Health services are largely exempt, so this is
    opt-in per line rather than applied to everything. */
export const OMAN_VAT_RATE = 0.05;

export const GATEWAY_AR: Record<string, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل بنكي",
  thawani: "ثواني (بطاقة)",
  insurance: "تأمين",
};

export const fmt3 = (n: number) =>
  Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
