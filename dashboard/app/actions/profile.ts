"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* A person's own profile.

   Everything here is scoped to the caller — there is no id parameter anywhere,
   because you can only ever edit yourself. Managing *other* people is
   app/actions/staff.ts and needs the manager role. Keeping the two apart means
   a bug in this file cannot become a privilege-escalation path. */

async function me() {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  return claims;
}

const rev = () => {
  revalidatePath("/clinic-admin/profile");
  revalidatePath("/doctor/profile");
  revalidatePath("/clinic-admin/staff");
};

export type ProfileInput = {
  name: string;
  name_ar: string;
  phone: string;
  job_title: string;
  specialty: string;
  bio: string;
};

export async function updateMyProfile(input: ProfileInput) {
  const claims = await me();
  const name = input.name.trim();
  const nameAr = input.name_ar.trim();
  if (!name && !nameAr) return { ok: false as const, reason: "الاسم مطلوب" };

  /* Deliberately absent: email and role. Changing either is an administrative
     act with security consequences, so it belongs to the manager's staff
     screen, not to the person themselves. */
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("tawd_staff_users").update({
    name: name || nameAr,
    name_ar: nameAr || name,
    phone: input.phone.trim() || null,
    job_title: input.job_title.trim() || null,
    specialty: input.specialty.trim() || null,
    bio: input.bio.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", claims.sub);

  if (error) return { ok: false as const, reason: "تعذّر حفظ الملف" };
  rev();
  return { ok: true as const };
}

/** Store the avatar the browser already downscaled, and record its URL.

   The file arrives resized and re-encoded client-side, so a 6MB phone photo
   never crosses the network — see components/profile/avatar-picker.tsx. */
export async function saveMyAvatar(formData: FormData) {
  const claims = await me();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, reason: "لم يُختر ملف" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false as const, reason: "الصورة أكبر من ٢ ميجابايت" };
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false as const, reason: "الصيغة غير مدعومة — استخدم JPG أو PNG أو WEBP" };
  }

  const sb = await createServerSupabaseClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `${claims.sub}/avatar.${ext}`;

  const { error: upErr } = await sb.storage.from("avatars")
    .upload(key, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  /* The user gets a sentence they can act on; the log gets the reason.
     This line said only "تعذّر رفع الصورة" for weeks while storage was
     returning "new row violates row-level security policy" — the bucket
     had no SELECT policy, so upsert's ON CONFLICT DO UPDATE could never
     read the row it was replacing. A swallowed provider error turns a
     one-query diagnosis into an afternoon. */
  if (upErr) {
    console.error("[profile] avatar upload failed:", key, upErr.message);
    return { ok: false as const, reason: "تعذّر رفع الصورة" };
  }

  const { data: pub } = sb.storage.from("avatars").getPublicUrl(key);
  /* A cache-buster: the object path is stable across replacements, so without
     it the browser and the CDN would both keep serving the previous photo. */
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await sb.from("tawd_staff_users")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("id", claims.sub);
  if (error) return { ok: false as const, reason: "رُفعت الصورة لكن تعذّر ربطها بالحساب" };

  rev();
  return { ok: true as const, url };
}

export async function removeMyAvatar() {
  const claims = await me();
  const sb = await createServerSupabaseClient();

  // the extension is unknown here, so clear all three candidates
  await sb.storage.from("avatars").remove(
    ["jpg", "png", "webp"].map((e) => `${claims.sub}/avatar.${e}`)
  );

  const { error } = await sb.from("tawd_staff_users")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", claims.sub);
  if (error) return { ok: false as const, reason: "تعذّر حذف الصورة" };

  rev();
  return { ok: true as const };
}

/** Change your own password. Requires the current one — otherwise anyone who
    walks up to an unlocked screen owns the account permanently. */
export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const claims = await me();
  if (newPassword.length < 8) return { ok: false as const, reason: "كلمة المرور الجديدة ٨ أحرف على الأقل" };
  if (newPassword === currentPassword) return { ok: false as const, reason: "كلمة المرور الجديدة مطابقة للحالية" };

  const sb = await createServerSupabaseClient();
  const { error: reauth } = await sb.auth.signInWithPassword({
    email: claims.email,
    password: currentPassword,
  });
  if (reauth) return { ok: false as const, reason: "كلمة المرور الحالية غير صحيحة" };

  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { ok: false as const, reason: "تعذّر تغيير كلمة المرور" };
  return { ok: true as const };
}

/** Sign out everywhere.

    Supabase has no per-device session list to show a user, so offering a table
    of "active sessions" would mean inventing one. This is the honest version of
    that feature: one button that ends every session, including this one. */
export async function signOutEverywhere() {
  const claims = await me();
  const svc = await createServiceRoleClient();
  const { error } = await svc.auth.admin.signOut(claims.sub, "global");
  if (error) return { ok: false as const, reason: "تعذّر إنهاء الجلسات" };
  return { ok: true as const };
}
