"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { revalidatePath } from "next/cache";

export type InvoiceStatus =
  | "draft" | "sent" | "paid" | "partially_paid"
  | "overdue" | "cancelled" | "refunded";

export type InvoiceLineInput = {
  description: string;
  service_id?: string | null;
  quantity?: number;
  unit_price: number;
  vat_rate?: number; // e.g. 0.05
};

function revalidateInvoices() {
  revalidatePath("/clinic-admin/invoices");
  revalidatePath("/clinic-admin");
  revalidatePath("/accountant");
  revalidatePath("/accountant/invoices");
}

/* Generate a readable per-clinic invoice number: INV-YYYYMM-NNNN */
async function nextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clinicId: string,
): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `INV-${ym}-${seq}`;
}

export async function createInvoice(data: {
  patient_id: string;
  appt_id?: string | null;
  items: InvoiceLineInput[];
  status?: InvoiceStatus;
  due_date?: string | null;
  discount_amount?: number;
  notes?: string;
}) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  if (!data.patient_id) throw new Error("اختر المريض");
  if (!data.items?.length) throw new Error("أضف بنداً واحداً على الأقل");

  const supabase = await createServerSupabaseClient();

  const lines = data.items.map((it, i) => {
    const qty = it.quantity ?? 1;
    const line = qty * it.unit_price;
    const vatRate = it.vat_rate ?? 0;
    const vat = +(line * vatRate).toFixed(3);
    return {
      description: it.description?.trim() || "بند",
      description_ar: it.description?.trim() || null,
      service_id: it.service_id || null,
      quantity: qty,
      unit_price_snapshot: it.unit_price,
      vat_rate_snapshot: vatRate,
      vat_amount: vat,
      total: +(line + vat).toFixed(3),
      sort_order: i,
    };
  });

  const subtotal = +lines.reduce((s, l) => s + l.quantity * l.unit_price_snapshot, 0).toFixed(3);
  const vatTotal = +lines.reduce((s, l) => s + l.vat_amount, 0).toFixed(3);
  const discount = +(data.discount_amount ?? 0).toFixed(3);
  const total = +(subtotal + vatTotal - discount).toFixed(3);

  const invoice_number = await nextInvoiceNumber(supabase, claims.clinic_id);

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      clinic_id:       claims.clinic_id,
      patient_id:      data.patient_id,
      appt_id:         data.appt_id || null,
      invoice_number,
      subtotal,
      discount_amount: discount,
      vat_amount:      vatTotal,
      total,
      status:          data.status ?? "sent",
      due_date:        data.due_date || null,
      notes:           data.notes?.trim() || null,
    })
    .select("id, invoice_number, total")
    .single();
  if (error) throw new Error(error.message);

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(lines.map((l) => ({ ...l, invoice_id: inv.id, clinic_id: claims.clinic_id })));
  if (itemsError) {
    // Roll back the header so we never leave an orphan invoice.
    await supabase.from("invoices").delete().eq("id", inv.id).eq("clinic_id", claims.clinic_id);
    throw new Error(itemsError.message);
  }

  revalidateInvoices();
  return { success: true, invoice: inv };
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidateInvoices();
  return { success: true };
}

/* Soft delete — financial records are never hard-deleted. */
export async function deleteInvoice(id: string) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidateInvoices();
  return { success: true };
}
