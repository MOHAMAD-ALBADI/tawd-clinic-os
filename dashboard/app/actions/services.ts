"use server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createService(data: {
  name: string;
  price: number;
  duration_minutes?: number;
  description?: string;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services").insert({
    clinic_id: claims.clinic_id,
    name: data.name,
    price: data.price,
    duration_minutes: data.duration_minutes ?? null,
    description: data.description ?? null,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/services");
  revalidatePath("/clinic-admin");
}

export async function updateService(id: string, data: {
  name: string;
  price: number;
  duration_minutes?: number;
  description?: string;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services")
    .update({
      name: data.name,
      price: data.price,
      duration_minutes: data.duration_minutes ?? null,
      description: data.description ?? null,
    })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/services");
  revalidatePath("/clinic-admin/appointments");
}

export async function deleteService(id: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  const supabase = await createServerSupabaseClient();
  // Check if any appointments use this service
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("service_id", id)
    .eq("clinic_id", claims.clinic_id);
  if ((count ?? 0) > 0) throw new Error(`لا يمكن حذف خدمة مرتبطة بـ ${count} موعد — يمكنك تعطيلها بدلاً من ذلك`);
  const { error } = await supabase.from("services").delete().eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/services");
  revalidatePath("/clinic-admin");
}

export async function toggleServiceStatus(id: string, isActive: boolean) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/services");
}
