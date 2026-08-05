"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateClinicInfo(data: {
  name: string;
  name_ar?: string;
  country_code: string;
  timezone: string;
  currency: "OMR" | "SAR" | "AED" | "USD";
  vat_enabled: boolean;
  /* Phone and address were columns nothing could write. They print on invoices
     and appear on the public booking page, so a clinic could not put its own
     contact details on its own paperwork. */
  phone?: string;
  address?: string;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const phone = (data.phone ?? "").replace(/[\s-]/g, "");
  if (phone && !/^(\+?968)?[79]\d{7}$/.test(phone)) {
    throw new Error("رقم الهاتف غير صالح — رقم عُماني من ٨ أرقام يبدأ بـ ٧ أو ٩");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("tawd_clinics")
    .update({
      name:         data.name.trim(),
      name_ar:      data.name_ar?.trim() || null,
      country_code: data.country_code,
      timezone:     data.timezone,
      currency:     data.currency,
      vat_enabled:  data.vat_enabled,
      phone:        phone ? (phone.startsWith("+") ? phone : `+968${phone.replace(/^968/, "")}`) : null,
      address:      data.address?.trim() || null,
    })
    .eq("id", claims.clinic_id);

  if (error) throw new Error(error.message);

  revalidatePath("/clinic-admin/settings");
  revalidatePath("/clinic-admin");
}

/** The clinic's logo — printed on invoices and shown on its booking page.

    Same route as a staff avatar: the browser downscales before upload, so a
    phone photo never crosses the network at full size. */
export async function saveClinicLogo(formData: FormData) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") return { ok: false as const, reason: "غير مصرح" };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, reason: "لم يُختر ملف" };
  if (file.size > 2 * 1024 * 1024) return { ok: false as const, reason: "الصورة أكبر من ٢ ميجابايت" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false as const, reason: "الصيغة غير مدعومة — استخدم JPG أو PNG أو WEBP" };
  }

  const sb = await createServerSupabaseClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `clinics/${claims.clinic_id}/logo.${ext}`;

  const { error: upErr } = await sb.storage.from("avatars")
    .upload(key, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  /* Same swallowed-error trap as the staff avatar, and the same fix:
     replacing a logo hit an RLS denial that never reached a log. */
  if (upErr) {
    console.error("[clinic-settings] logo upload failed:", key, upErr.message);
    return { ok: false as const, reason: "تعذّر رفع الشعار" };
  }

  const { data: pub } = sb.storage.from("avatars").getPublicUrl(key);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await sb.from("tawd_clinics").update({ logo_url: url }).eq("id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "رُفع الشعار لكن تعذّر ربطه بالعيادة" };

  revalidatePath("/clinic-admin/settings");
  return { ok: true as const, url };
}

export async function removeClinicLogo() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") return { ok: false as const, reason: "غير مصرح" };

  const sb = await createServerSupabaseClient();
  await sb.storage.from("avatars").remove(
    ["jpg", "png", "webp"].map((e) => `clinics/${claims.clinic_id}/logo.${e}`)
  );
  const { error } = await sb.from("tawd_clinics").update({ logo_url: null }).eq("id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حذف الشعار" };

  revalidatePath("/clinic-admin/settings");
  return { ok: true as const };
}

/* ── Clinic closures ──────────────────────────────────────────────────────

   clinic_holidays was already read by every booking path — the public page,
   reception, and Sura all skip a date that appears here. Only a doctor could
   write to it, and only for their own leave, so there was no way to say "the
   clinic is closed for Eid". Bookings were being accepted for days the clinic
   would not open. */

export async function addClinicHoliday(input: { date: string; nameAr: string }) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") return { ok: false as const, reason: "غير مصرح" };

  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, reason: "تاريخ غير صالح" };
  const label = input.nameAr.trim();
  if (!label) return { ok: false as const, reason: "اكتب سبب الإغلاق — يظهر للمريض عند الحجز" };

  const sb = await createServerSupabaseClient();

  const { data: clash } = await sb.from("clinic_holidays")
    .select("id").eq("clinic_id", claims.clinic_id)
    .eq("holiday_date", date).eq("applies_to_all_doctors", true).limit(1);
  if (clash?.length) return { ok: false as const, reason: "هذا اليوم مسجَّل كإغلاق بالفعل" };

  /* Booked appointments are not touched. Cancelling a patient's appointment is
     a decision with a phone call attached — the count is returned so the manager
     knows what they still have to do. */
  const { count: booked } = await sb.from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", claims.clinic_id)
    .gte("slot_time", `${date}T00:00:00+04:00`)
    .lte("slot_time", `${date}T23:59:59+04:00`)
    .not("status", "in", "(cancelled,no_show,completed)")
    .is("deleted_at", null);

  const { error } = await sb.from("clinic_holidays").insert({
    clinic_id: claims.clinic_id,
    holiday_date: date,
    name: label,
    name_ar: label,
    applies_to_all_doctors: true,
    doctor_id: null,
  });
  if (error) return { ok: false as const, reason: "تعذّر تسجيل الإغلاق" };

  revalidatePath("/clinic-admin/settings");
  revalidatePath("/clinic-admin/appointments");
  return { ok: true as const, existingAppointments: booked ?? 0 };
}

export async function removeClinicHoliday(id: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") return { ok: false as const, reason: "غير مصرح" };

  const sb = await createServerSupabaseClient();
  /* Scoped to clinic-wide closures: a manager reopening the clinic must not
     silently cancel a doctor's personal leave for the same day. */
  const { error } = await sb.from("clinic_holidays").delete()
    .eq("id", id).eq("clinic_id", claims.clinic_id).eq("applies_to_all_doctors", true);
  if (error) return { ok: false as const, reason: "تعذّر إلغاء الإغلاق" };

  revalidatePath("/clinic-admin/settings");
  return { ok: true as const };
}

export async function updateWorkingHours(hours: Record<string, { open: string; close: string } | null>) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();

  // Upsert clinic_settings row
  const { error } = await supabase
    .from("tawd_clinic_settings")
    .upsert(
      { clinic_id: claims.clinic_id, working_hours: hours },
      { onConflict: "clinic_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/settings");
}

/** Which methods the desk takes, and where a bank transfer goes.

    The cashier used to offer every clinic the same two buttons and had nowhere to
    read the account from, so the receptionist recited it from memory. */
export async function savePaymentSettings(input: {
  methods: string[];
  bankName: string | null;
  accountName: string | null;
  iban: string | null;
  phone: string | null;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") {
    return { ok: false as const, reason: "غير مصرح" };
  }

  const KNOWN = new Set(["cash", "card", "bank_transfer", "insurance", "thawani"]);
  const methods = [...new Set(input.methods)].filter((m) => KNOWN.has(m));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("tawd_clinic_settings").upsert(
    {
      clinic_id: claims.clinic_id,
      /* Empty is stored as null, which the cashier reads as "not configured" and
         therefore offers everything. Storing an empty array would mean "this
         clinic accepts no money", which nobody intends by unticking four boxes. */
      accepted_methods: methods.length ? methods : null,
      bank_name: input.bankName,
      bank_account_name: input.accountName,
      bank_iban: input.iban,
      transfer_phone: input.phone,
    },
    { onConflict: "clinic_id" },
  );
  if (error) return { ok: false as const, reason: "تعذّر حفظ طرق الدفع" };

  revalidatePath("/clinic-admin/settings");
  revalidatePath("/accountant/invoices");
  return { ok: true as const };
}

/** Set the clinic's Google review link (used by Sura's post-visit follow-up message). */
export async function updateReviewLink(url: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const clean = url.trim();
  if (clean && !/^https?:\/\//i.test(clean)) throw new Error("الرابط يجب أن يبدأ بـ https://");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("tawd_clinic_settings")
    .upsert(
      { clinic_id: claims.clinic_id, google_review_url: clean || null },
      { onConflict: "clinic_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/settings");
}
