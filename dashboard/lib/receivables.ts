import "server-only";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/* What patients actually owe, computed once.

   Six screens worked this out for themselves — the manager's dashboard, the
   finance hub, the accountant's overview, the front desk, the patient directory
   and the debt-chase queue — and all six summed the face value of every open
   invoice. Two things were therefore wrong everywhere:

     a part-paid invoice counted in full, so a patient who had paid 90 of 100
     still appeared to owe 100;

     a credit note was invisible, so an invoice corrected downwards kept
     showing its original debt.

   Both inflate receivables, and one of them inflates the figure the clinic
   chases patients over. Worse, the copies could disagree with each other, which
   is how a revenue headline ends up contradicting every other screen.

   So the rule lives here: owed = net_total − payments, floored at zero, and
   net_total is the generated column that already has credit notes and write-offs
   taken out of it. */

type SB = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** Statuses that still represent money someone owes. Cancelled, refunded and
    written-off invoices are settled business, one way or another. */
export const OPEN_STATUSES = ["sent", "partially_paid", "overdue"] as const;

export type OpenInvoice = {
  id: string;
  patientId: string | null;
  /** the visit this invoice was raised for, if any */
  apptId: string | null;
  /** still collectable: net_total less payments received */
  owed: number;
  /** what was invoiced, for display next to what is left */
  total: number;
  status: string;
  createdAt: string;
  dueDate: string | null;
};

/* PostgREST puts `in` lists in the URL, so a few thousand uuids in one call is a
   request no server will accept. Chunked rather than capped: a truncated payment
   list would silently overstate every debt in the tail. */
const CHUNK = 150;

export async function paymentsByInvoice(sb: SB, clinicId: string, ids: string[]) {
  const paid = new Map<string, number>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await sb.from("payments").select("invoice_id, amount")
      .eq("clinic_id", clinicId).eq("status", "completed")
      .in("invoice_id", ids.slice(i, i + CHUNK));
    for (const p of data ?? []) {
      const k = p.invoice_id as string;
      paid.set(k, (paid.get(k) ?? 0) + Number(p.amount ?? 0));
    }
  }
  return paid;
}

/** Every open invoice with money still on it. */
export async function loadOpenReceivables(
  sb: SB,
  clinicId: string,
  opts: { patientIds?: string[]; limit?: number } = {},
): Promise<OpenInvoice[]> {
  let q = sb.from("invoices")
    .select("id, patient_id, appt_id, total, net_total, status, created_at, due_date")
    .eq("clinic_id", clinicId).is("deleted_at", null)
    .in("status", OPEN_STATUSES as unknown as string[])
    .limit(opts.limit ?? 3000);

  if (opts.patientIds) {
    if (!opts.patientIds.length) return [];
    q = q.in("patient_id", opts.patientIds);
  }

  const { data: rows } = await q;
  const invoices = rows ?? [];
  if (!invoices.length) return [];

  const paid = await paymentsByInvoice(sb, clinicId, invoices.map((r) => r.id as string));

  return invoices
    .map((r) => ({
      id: r.id as string,
      patientId: (r.patient_id as string | null) ?? null,
      apptId: (r.appt_id as string | null) ?? null,
      owed: Math.max(0, Number(r.net_total ?? r.total ?? 0) - (paid.get(r.id as string) ?? 0)),
      total: Number(r.total ?? 0),
      status: r.status as string,
      createdAt: r.created_at as string,
      dueDate: (r.due_date as string | null) ?? null,
    }))
    /* A fully-paid invoice whose status never rolled forward is not a debt. */
    .filter((r) => r.owed > 0.0005);
}

/** Total owed per patient — the badge at the front desk and in the directory. */
export function owedByPatient(rows: OpenInvoice[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.patientId) continue;
    m.set(r.patientId, (m.get(r.patientId) ?? 0) + r.owed);
  }
  return m;
}

export const sumOwed = (rows: OpenInvoice[]) => rows.reduce((s, r) => s + r.owed, 0);

/** Past its due date, or already flagged overdue. */
export const isLate = (r: OpenInvoice, today: string) =>
  r.status === "overdue" || (!!r.dueDate && r.dueDate < today);
