import "server-only";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/* كشف حساب — one patient's money, in order, with a running balance.

   "I already paid that" had no answer. The invoice ledger knows what was billed,
   the register knows what came in, and the adjustments know what was written off,
   but nothing put the three on one page for one patient — so settling an argument
   over an amount meant three screens, a calculator, and trust.

   A statement is the arithmetic in the order it happened. Every line moves the
   balance in one direction and the direction is not always obvious:

     invoice      the patient owes more
     payment      the patient owes less
     credit note  the patient owes less — the bill was wrong
     write-off    the patient owes less — the clinic gave up on it
     refund       the patient owes MORE. Money went back to them, so the invoice
                  it was taken against is short again. Getting this sign wrong
                  makes a refunded patient look settled when they are not. */

type SB = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type StatementLine = {
  id: string;
  at: string;
  kind: "invoice" | "payment" | "credit_note" | "write_off" | "refund";
  label: string;
  detail: string;
  /** positive increases what the patient owes, negative reduces it */
  delta: number;
  balance: number;
  invoiceNumber: string | null;
  invoiceId: string | null;
  voided?: boolean;
};

export type Statement = {
  lines: StatementLine[];
  billed: number;
  collected: number;
  credited: number;
  refunded: number;
  /** what the patient owes right now */
  balance: number;
  firstAt: string | null;
  lastAt: string | null;
};

const KIND_AR: Record<StatementLine["kind"], string> = {
  invoice: "فاتورة",
  payment: "دفعة",
  credit_note: "إشعار دائن",
  write_off: "شطب",
  refund: "استرداد",
};

export const statementKindAr = (k: StatementLine["kind"]) => KIND_AR[k];

export async function buildStatement(
  sb: SB, clinicId: string, patientId: string,
): Promise<Statement> {
  const [{ data: invoices }, { data: payments }, { data: adjustments }] = await Promise.all([
    sb.from("invoices")
      .select("id, invoice_number, total, status, created_at, notes")
      .eq("clinic_id", clinicId).eq("patient_id", patientId).is("deleted_at", null)
      .order("created_at"),
    sb.from("payments")
      .select("id, amount, gateway, transaction_id, paid_at, status, invoice_id, invoices!invoice_id(invoice_number)")
      .eq("clinic_id", clinicId).eq("status", "completed").order("paid_at"),
    sb.from("invoice_adjustments")
      .select("id, kind, amount, reason, created_at, invoice_id, invoices!invoice_id(invoice_number, patient_id)")
      .eq("clinic_id", clinicId).order("created_at"),
  ]);

  const mine = new Set((invoices ?? []).map((i) => i.id as string));

  const raw: Omit<StatementLine, "balance">[] = [];

  for (const i of invoices ?? []) {
    /* A cancelled invoice was never a charge. Listing it with a zero effect would
       be honest but noisy; listing it at full value would invent a debt. */
    if (i.status === "cancelled") continue;
    raw.push({
      id: `i-${i.id}`,
      at: i.created_at as string,
      kind: "invoice",
      label: KIND_AR.invoice,
      detail: (i.notes as string | null)?.trim() || "خدمات العيادة",
      delta: Number(i.total ?? 0),
      invoiceNumber: (i.invoice_number as string) ?? null,
      invoiceId: i.id as string,
    });
  }

  for (const p of payments ?? []) {
    /* Payments are fetched for the whole clinic and filtered here, because
       PostgREST cannot filter on a joined table's column. */
    if (!mine.has(p.invoice_id as string)) continue;
    const inv = p.invoices as unknown as { invoice_number?: string } | null;
    raw.push({
      id: `p-${p.id}`,
      at: p.paid_at as string,
      kind: "payment",
      label: KIND_AR.payment,
      detail: p.transaction_id ? `مرجع ${p.transaction_id}` : "",
      delta: -Number(p.amount ?? 0),
      invoiceNumber: inv?.invoice_number ?? null,
      invoiceId: (p.invoice_id as string) ?? null,
    });
  }

  for (const a of adjustments ?? []) {
    const inv = a.invoices as unknown as
      { invoice_number?: string; patient_id?: string } | null;
    if (!mine.has(a.invoice_id as string)) continue;
    const kind = a.kind as StatementLine["kind"];
    const amount = Number(a.amount ?? 0);
    raw.push({
      id: `a-${a.id}`,
      at: a.created_at as string,
      kind,
      label: KIND_AR[kind],
      detail: a.reason as string,
      /* A refund puts the money back in the patient's pocket, so the bill is
         unpaid again by that much. The other two reduce the bill itself. */
      delta: kind === "refund" ? amount : -amount,
      invoiceNumber: inv?.invoice_number ?? null,
      invoiceId: (a.invoice_id as string) ?? null,
    });
  }

  raw.sort((x, y) => x.at.localeCompare(y.at));

  let balance = 0;
  const lines: StatementLine[] = raw.map((l) => {
    balance = Math.round((balance + l.delta) * 1000) / 1000;
    return { ...l, balance };
  });

  const sum = (f: (l: StatementLine) => boolean) =>
    Math.round(lines.filter(f).reduce((s, l) => s + Math.abs(l.delta), 0) * 1000) / 1000;

  return {
    lines,
    billed: sum((l) => l.kind === "invoice"),
    collected: sum((l) => l.kind === "payment"),
    credited: sum((l) => l.kind === "credit_note" || l.kind === "write_off"),
    refunded: sum((l) => l.kind === "refund"),
    balance,
    firstAt: lines[0]?.at ?? null,
    lastAt: lines.at(-1)?.at ?? null,
  };
}
