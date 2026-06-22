"use server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleStaffActive(staffId: string, newActive: boolean) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("tawd_staff_users")
    .update({ is_active: newActive, updated_at: new Date().toISOString() })
    .eq("id", staffId)
    .eq("clinic_id", claims.clinic_id);

  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/staff");
  revalidatePath("/clinic-admin");
}

export async function inviteStaffMember(data: {
  name: string;
  name_ar?: string;
  email: string;
  phone?: string;
  role: string;
  commission_rate?: number;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const serviceClient = await createServiceRoleClient();

  const { data: inviteData, error: inviteError } =
    await serviceClient.auth.admin.inviteUserByEmail(data.email, {
      data: { name: data.name, role: data.role, clinic_id: claims.clinic_id },
    });

  if (inviteError) throw new Error(inviteError.message);

  const userId = inviteData.user.id;

  const { error: insertError } = await serviceClient
    .from("tawd_staff_users")
    .insert({
      id: userId,
      clinic_id: claims.clinic_id,
      name: data.name,
      name_ar: data.name_ar ?? null,
      email: data.email,
      phone: data.phone ?? null,
      role: data.role,
      commission_rate: data.commission_rate ?? 0,
      is_active: true,
    });

  if (insertError) {
    // Roll back: delete the auth user we just created
    await serviceClient.auth.admin.deleteUser(userId);
    throw new Error(insertError.message);
  }

  revalidatePath("/clinic-admin/staff");
  revalidatePath("/clinic-admin");
}
