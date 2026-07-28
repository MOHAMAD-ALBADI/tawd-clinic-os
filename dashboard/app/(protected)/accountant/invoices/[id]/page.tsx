import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PrintInvoiceButton } from "@/components/invoices/print-button";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "فاتورة — طود" };
export const dynamic = "force-dynamic";

/* The tax invoice, on the accountant's side of the product.

   The printable document existed only under the manager's routes and nothing
   anywhere linked to it, so the person who issues invoices could not produce one
   for a patient who asked. Same document, same component — the accountant's copy
   is not a second version that can drift from the manager's. */
export default async function AccountantInvoicePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const [{ data: inv }, { data: items }, { data: clinic }, { data: pays }, { data: adjs }] =
    await Promise.all([
      sb.from("invoices")
        .select("id,invoice_number,subtotal,discount_amount,vat_amount,total,status,due_date,created_at,notes,patients!patient_id(name,phone)")
        .eq("id", id).eq("clinic_id", claims.clinic_id).maybeSingle(),
      sb.from("invoice_items")
        .select("id,description,quantity,unit_price_snapshot,vat_amount,total")
        .eq("invoice_id", id).eq("clinic_id", claims.clinic_id).order("sort_order"),
      sb.from("tawd_clinics")
        .select("name,name_ar,vat_number,phone,address").eq("id", claims.clinic_id).maybeSingle(),
      sb.from("payments")
        .select("id,amount,gateway,paid_at").eq("invoice_id", id).eq("clinic_id", claims.clinic_id)
        .eq("status", "completed").order("paid_at"),
      /* Shown on the document, because a credit note changes what is owed and a
         sheet that omits it asks the patient for money already written off. */
      sb.from("invoice_adjustments")
        .select("id,kind,amount,reason").eq("invoice_id", id).eq("clinic_id", claims.clinic_id)
        .order("created_at"),
    ]);

  if (!inv) notFound();

  const patient = inv.patients as unknown as { name: string; phone: string | null } | null;

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-4 no-print">
        <Link href="/accountant/invoices" className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-3)" }}>
          <ArrowRight className="w-3.5 h-3.5" /> رجوع للفواتير
        </Link>
        <PrintInvoiceButton />
      </div>

      <InvoiceDocument
        invoice={{
          invoice_number: inv.invoice_number as string,
          subtotal: Number(inv.subtotal ?? 0),
          discount_amount: Number(inv.discount_amount ?? 0),
          vat_amount: Number(inv.vat_amount ?? 0),
          total: Number(inv.total ?? 0),
          status: inv.status as string,
          due_date: (inv.due_date as string | null) ?? null,
          created_at: inv.created_at as string,
          notes: (inv.notes as string | null) ?? null,
        }}
        items={(items ?? []).map((l) => ({
          id: l.id as string,
          description: l.description as string,
          quantity: Number(l.quantity ?? 1),
          unit_price_snapshot: Number(l.unit_price_snapshot ?? 0),
          vat_amount: Number(l.vat_amount ?? 0),
          total: Number(l.total ?? 0),
        }))}
        payments={(pays ?? []).map((p) => ({
          id: p.id as string,
          amount: Number(p.amount ?? 0),
          gateway: p.gateway as string,
          paid_at: (p.paid_at as string | null) ?? null,
        }))}
        adjustments={(adjs ?? []).map((a) => ({
          id: a.id as string,
          kind: a.kind as string,
          amount: Number(a.amount ?? 0),
          reason: a.reason as string,
        }))}
        clinic={clinic
          ? {
              name: (clinic.name as string | null) ?? null,
              name_ar: (clinic.name_ar as string | null) ?? null,
              vat_number: (clinic.vat_number as string | null) ?? null,
              phone: (clinic.phone as string | null) ?? null,
              address: (clinic.address as string | null) ?? null,
            }
          : null}
        patient={patient ? { name: patient.name, phone: patient.phone } : null}
      />
    </div>
  );
}
