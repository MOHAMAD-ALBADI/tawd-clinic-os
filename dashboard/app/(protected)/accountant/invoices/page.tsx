import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvoiceLedger, type LedgerInvoice } from "@/components/accountant/invoice-ledger";

export const metadata = { title: "الفواتير — طود" };
export const dynamic = "force-dynamic";

const CAP = 500;

export default async function InvoicesPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();

  /* invoice_number and the patient were both in reach and neither was shown.
     A ledger that identifies invoices by the first eight characters of a UUID
     and never names who owes cannot be used to chase anything. */
  const { data: rows, count } = await sb
    .from("invoices")
    .select("id, invoice_number, total, adjusted_amount, status, created_at, due_date, patient_id, patients!patient_id(name, phone)",
            { count: "exact" })
    .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(CAP);

  const ids = (rows ?? []).map((r) => r.id as string);
  const [{ data: pays }, { data: adjs }] = ids.length
    ? await Promise.all([
        sb.from("payments").select("invoice_id, amount")
          .eq("clinic_id", claims.clinic_id).eq("status", "completed").in("invoice_id", ids),
        /* Refunds are read per invoice rather than taken from adjusted_amount:
           a refund un-collects money without reducing what was invoiced, so it
           belongs on the paid side of the arithmetic, not the billed side. */
        sb.from("invoice_adjustments").select("invoice_id, amount")
          .eq("clinic_id", claims.clinic_id).eq("kind", "refund").in("invoice_id", ids),
      ])
    : [{ data: [] as Record<string, unknown>[] }, { data: [] as Record<string, unknown>[] }];

  const paidOf = new Map<string, number>();
  for (const p of pays ?? []) {
    const k = p.invoice_id as string;
    paidOf.set(k, (paidOf.get(k) ?? 0) + Number(p.amount ?? 0));
  }
  const refundedOf = new Map<string, number>();
  for (const a of adjs ?? []) {
    const k = a.invoice_id as string;
    refundedOf.set(k, (refundedOf.get(k) ?? 0) + Number(a.amount ?? 0));
  }

  const invoices: LedgerInvoice[] = (rows ?? []).map((r) => {
    const p = r.patients as unknown as { name?: string; phone?: string | null } | null;
    return {
      id: r.id as string,
      number: (r.invoice_number as string) ?? `#${String(r.id).slice(0, 8).toUpperCase()}`,
      patientId: (r.patient_id as string | null) ?? null,
      patientName: p?.name ?? "—",
      patientPhone: p?.phone ?? null,
      total: Number(r.total ?? 0),
      paid: Number((paidOf.get(r.id as string) ?? 0).toFixed(3)),
      refunded: Number((refundedOf.get(r.id as string) ?? 0).toFixed(3)),
      adjusted: Number(r.adjusted_amount ?? 0),
      status: r.status as string,
      createdAt: r.created_at as string,
      dueDate: (r.due_date as string | null) ?? null,
    };
  });

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">RECEIVABLES</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">الفواتير</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          المستحق وأعماره — وتسجيل الدفعة من نفس السطر
        </p>
      </div>

      <InvoiceLedger invoices={invoices} capped={(count ?? 0) > CAP} />
    </div>
  );
}
