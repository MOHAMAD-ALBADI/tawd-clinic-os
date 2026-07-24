"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* Inventory management is a clinic-admin surface (like services + staff).
   Stock is scoped by RLS to the caller's clinic on every table + RPC. */
async function requireAdmin() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}

function revalidateInventory() {
  revalidatePath("/clinic-admin/inventory");
}

export type ItemInput = {
  name: string;
  name_ar?: string;
  sku?: string;
  category?: string;
  unit?: string;
  reorder_level?: number;
  cost_price?: number;
  tracks_expiry?: boolean;
};

/** Create a stockable item (opening stock is added later via receiveStock). */
export async function createItem(input: ItemInput) {
  const claims = await requireAdmin();
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false as const, reason: "اسم الصنف مطلوب" };

  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("inventory_items").insert({
    clinic_id: claims.clinic_id,
    name,
    name_ar: input.name_ar?.trim() || null,
    sku: input.sku?.trim() || null,
    category: input.category?.trim() || null,
    unit: input.unit?.trim() || "piece",
    reorder_level: Number(input.reorder_level ?? 0) || 0,
    cost_price: Number(input.cost_price ?? 0) || 0,
    tracks_expiry: input.tracks_expiry ?? true,
  });
  if (error) return { ok: false as const, reason: "تعذّر إضافة الصنف" };
  revalidateInventory();
  return { ok: true as const };
}

/** Edit item master fields (NOT stock — stock only moves via receive/adjust/consume). */
export async function updateItem(id: string, patch: Partial<ItemInput>) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) upd.name = patch.name.trim();
  if (patch.name_ar !== undefined) upd.name_ar = patch.name_ar?.trim() || null;
  if (patch.sku !== undefined) upd.sku = patch.sku?.trim() || null;
  if (patch.category !== undefined) upd.category = patch.category?.trim() || null;
  if (patch.unit !== undefined) upd.unit = patch.unit?.trim() || "piece";
  if (patch.reorder_level !== undefined) upd.reorder_level = Number(patch.reorder_level) || 0;
  if (patch.cost_price !== undefined) upd.cost_price = Number(patch.cost_price) || 0;
  if (patch.tracks_expiry !== undefined) upd.tracks_expiry = patch.tracks_expiry;

  const { error } = await sb.from("inventory_items").update(upd)
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تحديث الصنف" };
  revalidateInventory();
  return { ok: true as const };
}

/** Soft-archive (never hard-delete — preserves movement history). */
export async function archiveItem(id: string) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("inventory_items")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر أرشفة الصنف" };
  revalidateInventory();
  return { ok: true as const };
}

/** Receive a purchase into stock (atomic: batch + ledger + running balance). */
export async function receiveStock(input: {
  item_id: string;
  qty: number;
  cost_price?: number;
  expiry_date?: string | null;
  supplier_id?: string | null;
  batch_number?: string;
}) {
  const claims = await requireAdmin();
  const qty = Number(input.qty);
  if (!input.item_id) return { ok: false as const, reason: "اختر الصنف" };
  if (!(qty > 0)) return { ok: false as const, reason: "الكمية يجب أن تكون أكبر من صفر" };

  const sb = await createServerSupabaseClient();
  const { data, error } = await sb.rpc("inventory_receive_stock", {
    p_item_id: input.item_id,
    p_qty: qty,
    p_cost: Number(input.cost_price ?? 0) || 0,
    p_expiry: input.expiry_date || null,
    p_supplier_id: input.supplier_id || null,
    p_batch_number: input.batch_number?.trim() || null,
    p_created_by: claims.sub,
  });
  if (error) return { ok: false as const, reason: "تعذّر تسجيل الاستلام" };
  revalidateInventory();
  return { ok: true as const, newStock: Number(data) };
}

/** Set the counted quantity after a stock-take (logs the delta as an adjustment). */
export async function adjustStock(input: { item_id: string; new_qty: number; reason?: string }) {
  const claims = await requireAdmin();
  const q = Number(input.new_qty);
  if (!input.item_id) return { ok: false as const, reason: "اختر الصنف" };
  if (!(q >= 0)) return { ok: false as const, reason: "الكمية غير صالحة" };

  const sb = await createServerSupabaseClient();
  const { data, error } = await sb.rpc("inventory_adjust_stock", {
    p_item_id: input.item_id,
    p_new_qty: q,
    p_reason: input.reason?.trim() || null,
    p_created_by: claims.sub,
  });
  if (error) return { ok: false as const, reason: "تعذّر تعديل الكمية" };
  revalidateInventory();
  return { ok: true as const, newStock: Number(data) };
}

/** Light supplier create (expands into full procurement later). */
export async function createSupplier(input: { name: string; phone?: string; email?: string }) {
  const claims = await requireAdmin();
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false as const, reason: "اسم المورد مطلوب" };
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("suppliers").insert({
    clinic_id: claims.clinic_id, name,
    phone: input.phone?.trim() || null, email: input.email?.trim() || null,
  });
  if (error) return { ok: false as const, reason: "تعذّر إضافة المورد" };
  revalidateInventory();
  return { ok: true as const };
}

/** Define which materials a service consumes (replaces the service's BOM). */
export async function setServiceMaterials(
  serviceId: string,
  rows: { item_id: string; qty_per_use: number }[]
) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  // replace-all so the editor is the single source of truth
  const { error: delErr } = await sb.from("service_materials")
    .delete().eq("service_id", serviceId).eq("clinic_id", claims.clinic_id);
  if (delErr) return { ok: false as const, reason: "تعذّر حفظ المواد" };

  const clean = rows.filter((r) => r.item_id && Number(r.qty_per_use) > 0);
  if (clean.length) {
    const { error: insErr } = await sb.from("service_materials").insert(
      clean.map((r) => ({
        clinic_id: claims.clinic_id, service_id: serviceId,
        item_id: r.item_id, qty_per_use: Number(r.qty_per_use),
      }))
    );
    if (insErr) return { ok: false as const, reason: "تعذّر حفظ المواد" };
  }
  revalidateInventory();
  return { ok: true as const, count: clean.length };
}

/** Auto-deduct a service's materials from stock. Best-effort — never throws to the caller
    (a stock hiccup must not block completing a clinical visit). Returns items consumed. */
export async function consumeServiceMaterials(
  serviceId: string,
  refType: "appointment" | "invoice",
  refId: string
): Promise<number> {
  try {
    const claims = await getUserClaims();
    if (!claims?.clinic_id) return 0;
    const sb = await createServerSupabaseClient();
    const { data, error } = await sb.rpc("inventory_consume_service", {
      p_service_id: serviceId,
      p_ref_type: refType,
      p_ref_id: refId,
      p_created_by: claims.sub,
    });
    if (error) return 0;
    revalidateInventory();
    return Number(data) || 0;
  } catch {
    return 0;
  }
}
