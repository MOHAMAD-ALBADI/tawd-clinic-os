"use server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { APP_ROLES, toDbRole as toDb, toAppRole as toApp, type AppRole } from "@/lib/staff-roles";
import { checkLimit } from "@/lib/entitlements";

/* Team administration for the clinic manager.

   Two vocabularies meet here and must not be confused:
   - auth app_metadata uses the app's Role names ("clinic_admin", "doctor", …)
   - the staff_role enum in Postgres uses "admin" where the app says "clinic_admin"
   Every write goes through toDb()/toApp() so the two never drift.

   Deactivating used to be cosmetic: nothing in the auth path reads is_active or
   deleted_at, so a "disabled" employee could still sign in and keep working.
   Deactivating and deleting now ban the auth user as well, which is enforced by
   Supabase itself — sessions stop refreshing and new sign-ins are refused. */

/** Long enough to be permanent; Supabase has no "forever" literal. */
const BAN_FOREVER = "876000h";

async function requireManager() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}

const rev = () => {
  revalidatePath("/clinic-admin/staff");
  revalidatePath("/clinic-admin");
  revalidatePath("/clinic-admin/finance/payroll");
};

/** Confirm the target is a real, live member of the caller's own clinic. */
async function loadTarget(clinicId: string, staffId: string) {
  const sb = await createServerSupabaseClient();
  const { data } = await sb.from("tawd_staff_users")
    .select("id, name, name_ar, email, role, all_roles, is_active, deleted_at")
    .eq("id", staffId).eq("clinic_id", clinicId).maybeSingle();
  return data;
}

/** Refuse to strand a clinic with nobody who can administer it. */
async function isLastActiveManager(clinicId: string, staffId: string) {
  const sb = await createServerSupabaseClient();
  const { data } = await sb.from("tawd_staff_users")
    .select("id").eq("clinic_id", clinicId).eq("is_active", true).is("deleted_at", null)
    .contains("all_roles", ["admin"]);
  const managers = (data ?? []).map((r) => r.id as string);
  return managers.length <= 1 && managers[0] === staffId;
}

function normaliseRoles(roles: string[]): AppRole[] {
  const seen = new Set<AppRole>();
  for (const r of roles) {
    const a = toApp(r);
    // platform_admin is deliberately unreachable: a clinic manager must not be
    // able to mint an account that can see other clinics
    if (a && APP_ROLES.includes(a)) seen.add(a);
  }
  return [...seen];
}

export type StaffInput = {
  name: string;
  name_ar?: string;
  email: string;
  phone?: string;
  roles: string[];
  commission_rate?: number;
  specialty?: string;
  /** set a password now, or leave empty to send an email invitation instead */
  password?: string;
};

/** Add a team member — with a password they can use immediately, or by invite. */
export async function createStaffMember(input: StaffInput) {
  const claims = await requireManager();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const roles = normaliseRoles(input.roles);
  const commission = Math.min(100, Math.max(0, Number(input.commission_rate ?? 0) || 0));

  if (!name) return { ok: false as const, reason: "الاسم مطلوب" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, reason: "البريد غير صالح" };
  if (!roles.length) return { ok: false as const, reason: "اختر دوراً واحداً على الأقل" };
  if (input.password && input.password.length < 8) return { ok: false as const, reason: "كلمة المرور 8 أحرف على الأقل" };

  /* Checked before the auth user is created, not after. Creating the login and
     then refusing the staff row leaves an account that can sign in and belongs
     to nobody. */
  const seats = await checkLimit(claims.clinic_id, "staff");
  if (!seats.ok) return { ok: false as const, reason: seats.reason };
  if (roles.includes("doctor")) {
    const docs = await checkLimit(claims.clinic_id, "doctors");
    if (!docs.ok) return { ok: false as const, reason: docs.reason };
  }

  const primary = roles[0];
  const meta = {
    role: primary,
    all_roles: roles,
    is_multi_role: roles.length > 1,
    clinic_id: claims.clinic_id,
  };

  const svc = await createServiceRoleClient();
  let userId: string;

  if (input.password) {
    const created = await svc.auth.admin.createUser({
      email, password: input.password, email_confirm: true, app_metadata: meta,
    });
    if (created.error || !created.data.user) {
      const m = created.error?.message ?? "تعذّر إنشاء الحساب";
      return { ok: false as const, reason: /already|exists|registered/i.test(m) ? "البريد مسجّل مسبقاً" : m };
    }
    userId = created.data.user.id;
  } else {
    const invited = await svc.auth.admin.inviteUserByEmail(email, {
      data: { name, role: primary, clinic_id: claims.clinic_id },
    });
    if (invited.error || !invited.data.user) {
      const m = invited.error?.message ?? "تعذّر إرسال الدعوة";
      return { ok: false as const, reason: /already|exists|registered/i.test(m) ? "البريد مسجّل مسبقاً" : m };
    }
    userId = invited.data.user.id;
    /* An invite writes its payload to user_metadata, so the authorization claims
       have to be set separately or the invitee signs in with no role at all. */
    await svc.auth.admin.updateUserById(userId, { app_metadata: meta });
  }

  const { error } = await svc.from("tawd_staff_users").insert({
    id: userId,
    clinic_id: claims.clinic_id,
    name,
    name_ar: input.name_ar?.trim() || name,
    email,
    phone: input.phone?.trim() || null,
    role: toDb(primary),
    all_roles: roles.map(toDb),
    commission_rate: commission,
    specialty: input.specialty?.trim() || null,
    is_active: true,
  });
  if (error) {
    // don't leave an orphan login behind
    await svc.auth.admin.deleteUser(userId);
    return { ok: false as const, reason: `تعذّر حفظ الموظف: ${error.message}` };
  }

  rev();
  return { ok: true as const, invited: !input.password };
}

/** Edit an existing member — identity, roles, commission and specialty. */
export async function updateStaffMember(staffId: string, input: Omit<StaffInput, "password">) {
  const claims = await requireManager();
  const target = await loadTarget(claims.clinic_id, staffId);
  if (!target || target.deleted_at) return { ok: false as const, reason: "الموظف غير موجود" };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const roles = normaliseRoles(input.roles);
  const commission = Math.min(100, Math.max(0, Number(input.commission_rate ?? 0) || 0));

  if (!name) return { ok: false as const, reason: "الاسم مطلوب" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, reason: "البريد غير صالح" };
  if (!roles.length) return { ok: false as const, reason: "اختر دوراً واحداً على الأقل" };

  /* Dropping your own manager role, or the clinic's only manager's, locks the
     clinic out of its own administration. */
  const keepsManager = roles.includes("clinic_admin");
  if (!keepsManager) {
    if (staffId === claims.sub) return { ok: false as const, reason: "لا يمكنك سحب صلاحية الإدارة من نفسك" };
    if (await isLastActiveManager(claims.clinic_id, staffId)) {
      return { ok: false as const, reason: "هذا آخر مدير نشط في العيادة" };
    }
  }

  const primary = roles[0];
  const svc = await createServiceRoleClient();

  if (email !== target.email) {
    const up = await svc.auth.admin.updateUserById(staffId, { email, email_confirm: true });
    if (up.error) return { ok: false as const, reason: "تعذّر تغيير البريد — قد يكون مستخدماً" };
  }
  await svc.auth.admin.updateUserById(staffId, {
    app_metadata: { role: primary, all_roles: roles, is_multi_role: roles.length > 1, clinic_id: claims.clinic_id },
  });

  const { error } = await svc.from("tawd_staff_users").update({
    name,
    name_ar: input.name_ar?.trim() || name,
    email,
    phone: input.phone?.trim() || null,
    role: toDb(primary),
    all_roles: roles.map(toDb),
    commission_rate: commission,
    specialty: input.specialty?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", staffId).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حفظ التعديل" };

  rev();
  return { ok: true as const, roleChanged: primary !== toApp(target.role) };
}

/** Suspend or restore access. The ban is what actually stops them working. */
export async function setStaffActive(staffId: string, active: boolean) {
  const claims = await requireManager();
  const target = await loadTarget(claims.clinic_id, staffId);
  if (!target || target.deleted_at) return { ok: false as const, reason: "الموظف غير موجود" };

  if (!active) {
    if (staffId === claims.sub) return { ok: false as const, reason: "لا يمكنك تعطيل حسابك" };
    if (await isLastActiveManager(claims.clinic_id, staffId)) {
      return { ok: false as const, reason: "هذا آخر مدير نشط في العيادة" };
    }
  }

  const svc = await createServiceRoleClient();
  const { error } = await svc.from("tawd_staff_users")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", staffId).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تحديث الحالة" };

  const ban = await svc.auth.admin.updateUserById(staffId, { ban_duration: active ? "none" : BAN_FOREVER });
  if (ban.error) {
    // the row and the login must agree — put the row back rather than lie
    await svc.from("tawd_staff_users").update({ is_active: !active }).eq("id", staffId);
    return { ok: false as const, reason: "تعذّر تحديث صلاحية الدخول" };
  }

  rev();
  return { ok: true as const };
}

/** Remove a member: the row is kept (their appointments and invoices point at
    it) but archived, and the login is revoked. */
export async function deleteStaffMember(staffId: string) {
  const claims = await requireManager();
  const target = await loadTarget(claims.clinic_id, staffId);
  if (!target || target.deleted_at) return { ok: false as const, reason: "الموظف غير موجود" };
  if (staffId === claims.sub) return { ok: false as const, reason: "لا يمكنك حذف حسابك" };
  if (await isLastActiveManager(claims.clinic_id, staffId)) {
    return { ok: false as const, reason: "هذا آخر مدير نشط في العيادة" };
  }

  const svc = await createServiceRoleClient();
  const { error } = await svc.from("tawd_staff_users")
    .update({ deleted_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
    .eq("id", staffId).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حذف الموظف" };

  await svc.auth.admin.updateUserById(staffId, { ban_duration: BAN_FOREVER });
  rev();
  return { ok: true as const };
}

/** Set a new password for a member who has locked themselves out. */
export async function resetStaffPassword(staffId: string, password: string) {
  const claims = await requireManager();
  const target = await loadTarget(claims.clinic_id, staffId);
  if (!target || target.deleted_at) return { ok: false as const, reason: "الموظف غير موجود" };
  if (password.length < 8) return { ok: false as const, reason: "كلمة المرور 8 أحرف على الأقل" };

  const svc = await createServiceRoleClient();
  const { error } = await svc.auth.admin.updateUserById(staffId, { password });
  if (error) return { ok: false as const, reason: "تعذّر تغيير كلمة المرور" };
  return { ok: true as const };
}
