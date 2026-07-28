import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clinicToday } from "@/lib/clinic-time";
import {
  PaymentsRegister, type RegisterPayment,
} from "@/components/accountant/payments-register";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "الدفعات — طود" };
export const dynamic = "force-dynamic";

const CAP = 400;

/* The register of money received.

   The product could take a payment and then never show it again except inside a
   total. This page is the other half of that: every payment, who paid, how much,
   which patient, on which invoice, by which method, against which slip, and taken
   by which member of staff — with the one control that was missing, undoing a row
   that was entered wrong. */
export default async function PaymentsPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();

  const { data: rows, count } = await sb
    .from("payments")
    /* One literal string, not a concatenation: the client infers the row type
       from the select text, and anything it cannot read at compile time collapses
       the whole result to an error type. */
    .select("id, amount, gateway, transaction_id, paid_at, status, received_by, voided_at, voided_by, void_reason, invoice_id, invoices!invoice_id(invoice_number, patient_id, patients!patient_id(name))",
      { count: "exact" })
    .eq("clinic_id", claims.clinic_id)
    .order("paid_at", { ascending: false })
    .limit(CAP);

  /* Which days are already reconciled. A payment inside one of them cannot be
     voided — those totals were counted against a drawer, a terminal report and a
     bank statement, and changing them afterwards makes a signed-off close untrue. */
  const [{ data: closes }, { data: staff }] = await Promise.all([
    sb.from("cashier_day_closes").select("close_date").eq("clinic_id", claims.clinic_id),
    sb.from("tawd_staff_users").select("id, name, name_ar").eq("clinic_id", claims.clinic_id),
  ]);
  const closedDays = new Set((closes ?? []).map((c) => c.close_date as string));

  const staffNames: Record<string, string> = {};
  for (const s of staff ?? []) {
    staffNames[s.id as string] = (s.name_ar ?? s.name) as string;
  }

  const payments: RegisterPayment[] = (rows ?? []).map((p) => {
    const inv = p.invoices as unknown as
      { invoice_number?: string; patient_id?: string | null; patients?: { name?: string } | null } | null;
    /* The clinic's own day, not UTC's — Oman is +4, so a payment taken at 1am
       belongs to the day the clinic calls it, not to yesterday. */
    const day = clinicToday(new Date(p.paid_at as string));
    return {
      id: p.id as string,
      amount: Number(p.amount ?? 0),
      method: p.gateway as string,
      reference: (p.transaction_id as string | null) ?? null,
      paidAt: p.paid_at as string,
      invoiceId: (p.invoice_id as string | null) ?? null,
      invoiceNumber: inv?.invoice_number ?? "—",
      patientId: inv?.patient_id ?? null,
      patientName: inv?.patients?.name ?? "—",
      receivedBy: (p.received_by as string | null) ?? null,
      voided: !!p.voided_at || p.status === "voided",
      voidReason: (p.void_reason as string | null) ?? null,
      voidedBy: (p.voided_by as string | null) ?? null,
      day,
      dayClosed: closedDays.has(day),
    };
  });

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs"
        style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <p className="eyebrow">PAYMENTS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">الدفعات</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          كل مبلغ دخل العيادة — من دفعه، كم، على أي فاتورة، ومن استلمه
        </p>
      </div>

      <PaymentsRegister
        payments={payments}
        capped={(count ?? 0) > CAP}
        staffNames={staffNames}
      />
    </div>
  );
}
