"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";
import type { Role } from "@/types/tawd";

/* Platform reads/writes cross clinics → service client after an explicit
   platform_admin check (is_platform_admin() RLS reads the PRIMARY role,
   so multi-role founders wouldn't pass it). */
async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

const WH_DEFAULT = {
  sun: { open: "09:00", close: "18:00" },
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: null,
  sat: { open: "09:00", close: "14:00" },
};

/* Starter service templates per specialty — the clinic edits them later. */
const SERVICE_TEMPLATES: Record<string, { name: string; name_ar: string; price: number; duration_minutes: number }[]> = {
  dental: [
    { name: "Checkup & Diagnosis", name_ar: "كشف وتشخيص", price: 5, duration_minutes: 30 },
    { name: "Cleaning & Polishing", name_ar: "تنظيف وتلميع الأسنان", price: 15, duration_minutes: 30 },
    { name: "Filling", name_ar: "حشوة الأسنان", price: 20, duration_minutes: 45 },
    { name: "Extraction", name_ar: "خلع سن", price: 15, duration_minutes: 30 },
    { name: "Whitening", name_ar: "تبييض الأسنان", price: 80, duration_minutes: 60 },
    { name: "Ortho Consultation", name_ar: "استشارة تقويم", price: 10, duration_minutes: 30 },
  ],
  cosmetic: [
    { name: "Aesthetic Consultation", name_ar: "استشارة تجميلية", price: 10, duration_minutes: 30 },
    { name: "Botox Session", name_ar: "جلسة بوتوكس", price: 120, duration_minutes: 45 },
    { name: "Filler Session", name_ar: "جلسة فيلر", price: 150, duration_minutes: 45 },
    { name: "Deep Facial Cleaning", name_ar: "تنظيف بشرة عميق", price: 40, duration_minutes: 60 },
    { name: "Laser Session", name_ar: "جلسة ليزر", price: 60, duration_minutes: 45 },
  ],
  dermatology: [
    { name: "Dermatology Checkup", name_ar: "كشف جلدية", price: 8, duration_minutes: 30 },
    { name: "Acne Treatment", name_ar: "علاج حب الشباب", price: 25, duration_minutes: 30 },
    { name: "Laser Session", name_ar: "جلسة ليزر", price: 50, duration_minutes: 45 },
  ],
  pediatric: [
    { name: "Pediatric Checkup", name_ar: "كشف أطفال", price: 6, duration_minutes: 30 },
    { name: "Vaccination", name_ar: "تطعيم", price: 10, duration_minutes: 15 },
    { name: "Growth Follow-up", name_ar: "متابعة نمو", price: 5, duration_minutes: 30 },
  ],
  ophthalmology: [
    { name: "Vision Test", name_ar: "فحص نظر", price: 10, duration_minutes: 30 },
    { name: "Retina Exam", name_ar: "فحص شبكية", price: 25, duration_minutes: 30 },
    { name: "Glasses Prescription", name_ar: "وصف نظارة", price: 5, duration_minutes: 15 },
  ],
  general: [
    { name: "General Checkup", name_ar: "كشف عام", price: 5, duration_minutes: 30 },
    { name: "Follow-up", name_ar: "متابعة", price: 3, duration_minutes: 15 },
    { name: "Basic Lab Tests", name_ar: "تحاليل أساسية", price: 15, duration_minutes: 15 },
  ],
};

export type NewClinicInput = {
  name: string;        // EN
  nameAr: string;      // AR
  clinicType: string;  // dental | cosmetic | ...
  phone?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  /* flexible team: any number of doctors, optional front-desk account */
  doctors?: { name: string; email: string; password: string }[];
  frontdesk?: { email: string; password: string } | null;
};

/** Full clinic onboarding: clinic + settings + loyalty + trial subscription
    + specialty service template + the clinic-admin account. */
export async function createClinic(input: NewClinicInput) {
  const claims = await requirePlatform();
  const sb = await createServiceRoleClient();

  const name = input.name.trim();
  const nameAr = input.nameAr.trim();
  const email = input.adminEmail.trim().toLowerCase();
  if (!name || !nameAr) return { ok: false as const, reason: "اسم العيادة مطلوب بالعربية والإنجليزية" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, reason: "بريد المدير غير صالح" };
  if (input.adminPassword.length < 8) return { ok: false as const, reason: "كلمة المرور 8 أحرف على الأقل" };
  if (!input.adminName.trim()) return { ok: false as const, reason: "اسم المدير مطلوب" };

  /* 1 — the clinic */
  const { data: clinic, error: cerr } = await sb
    .from("tawd_clinics")
    .insert({
      name,
      name_ar: nameAr,
      clinic_type: SERVICE_TEMPLATES[input.clinicType] ? input.clinicType : "general",
      phone: input.phone?.trim() || null,
      vat_enabled: true,
      status: "trial",
    })
    .select("id")
    .single();
  if (cerr || !clinic) return { ok: false as const, reason: `تعذّر إنشاء العيادة: ${cerr?.message ?? ""}` };
  const clinicId = clinic.id as string;

  /* 2 — defaults: settings + smart loyalty + 14-day trial subscription */
  const trialEnd = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const [s1, s2, s3] = await Promise.all([
    sb.from("tawd_clinic_settings").insert({ clinic_id: clinicId, working_hours: WH_DEFAULT }),
    sb.from("loyalty_settings").insert({
      clinic_id: clinicId,
      points_per_visit: 10,
      points_per_referral: 100,
      redemption_rate: 0.030,
      is_active: true,
      points_per_omr: 1,
      min_redeem_points: 100,
      max_redeem_pct: 30,
      expiry_months: 6,
    }),
    sb.from("tawd_subscriptions").insert({ clinic_id: clinicId, trial_ends_at: trialEnd, current_period_end: trialEnd }),
  ]);
  const seedErr = s1.error ?? s2.error ?? s3.error;

  /* 3 — specialty service template */
  const tpl = SERVICE_TEMPLATES[input.clinicType] ?? SERVICE_TEMPLATES.general;
  const { error: sverr } = await sb.from("services").insert(
    tpl.map((s) => ({ clinic_id: clinicId, ...s, is_active: true }))
  );

  /* 4 — the clinic-admin account */
  const meta = { role: "clinic_admin", all_roles: ["clinic_admin"], clinic_id: clinicId };
  const created = await sb.auth.admin.createUser({
    email,
    password: input.adminPassword,
    email_confirm: true,
    app_metadata: meta,
  });
  if (created.error) {
    return {
      ok: false as const,
      reason: `العيادة أُنشئت لكن تعذّر إنشاء حساب المدير: ${created.error.message}`,
      clinicId,
    };
  }
  const adminId = created.data.user.id;
  const { error: sterr } = await sb.from("tawd_staff_users").insert({
    id: adminId,
    clinic_id: clinicId,
    name: input.adminName.trim(),
    name_ar: input.adminName.trim(),
    email,
    role: "admin",
    is_active: true,
  });

  /* 5 — flexible team: N doctors + optional front-desk (استقبال+محاسبة) */
  const teamWarnings: string[] = [];
  let doctorsCreated = 0;
  for (const d of (input.doctors ?? []).slice(0, 30)) {
    const dEmail = d.email.trim().toLowerCase();
    if (!d.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dEmail) || d.password.length < 8) {
      teamWarnings.push(`طبيب متجاهل (بيانات ناقصة): ${d.name || dEmail || "?"}`);
      continue;
    }
    const dc = await sb.auth.admin.createUser({
      email: dEmail,
      password: d.password,
      email_confirm: true,
      app_metadata: { role: "doctor", all_roles: ["doctor"], clinic_id: clinicId },
    });
    if (dc.error) { teamWarnings.push(`${dEmail}: ${dc.error.message}`); continue; }
    const { error: dse } = await sb.from("tawd_staff_users").insert({
      id: dc.data.user.id,
      clinic_id: clinicId,
      name: d.name.trim(),
      name_ar: d.name.trim(),
      email: dEmail,
      role: "doctor",
      is_active: true,
    });
    if (dse) teamWarnings.push(`${dEmail}: ${dse.message}`);
    else doctorsCreated++;
  }

  let frontdeskCreated = false;
  if (input.frontdesk?.email) {
    const fEmail = input.frontdesk.email.trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fEmail) && input.frontdesk.password.length >= 8) {
      const fc = await sb.auth.admin.createUser({
        email: fEmail,
        password: input.frontdesk.password,
        email_confirm: true,
        app_metadata: {
          role: "receptionist",
          all_roles: ["receptionist", "accountant"],
          is_multi_role: true,
          clinic_id: clinicId,
        },
      });
      if (!fc.error) {
        await sb.from("tawd_staff_users").insert({
          id: fc.data.user.id,
          clinic_id: clinicId,
          name: "Front Desk",
          name_ar: "الاستقبال والمحاسبة",
          email: fEmail,
          role: "receptionist",
          is_active: true,
        });
        frontdeskCreated = true;
      } else teamWarnings.push(`${fEmail}: ${fc.error.message}`);
    }
  }

  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/clinics");
  return {
    ok: true as const,
    clinicId,
    adminEmail: email,
    servicesSeeded: sverr ? 0 : tpl.length,
    doctorsCreated,
    frontdeskCreated,
    warnings: [seedErr?.message, sverr?.message, sterr?.message, ...teamWarnings].filter(Boolean) as string[],
    createdBy: claims.sub,
  };
}

const STAFF_ROLE_MAP: Record<string, string> = {
  clinic_admin: "admin",
  doctor: "doctor",
  receptionist: "receptionist",
  accountant: "accountant",
};

export type NewStaffInput = {
  name: string;
  email: string;
  password: string;
  roles: Role[]; // one or many (multi-role front desk!)
};

/** Create a staff account for a clinic — supports multi-role (one-PC clinics). */
export async function createStaffAccount(clinicId: string, input: NewStaffInput) {
  await requirePlatform();
  const sb = await createServiceRoleClient();

  const email = input.email.trim().toLowerCase();
  const roles = input.roles.filter((r) => STAFF_ROLE_MAP[r]);
  if (!input.name.trim()) return { ok: false as const, reason: "الاسم مطلوب" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, reason: "البريد غير صالح" };
  if (input.password.length < 8) return { ok: false as const, reason: "كلمة المرور 8 أحرف على الأقل" };
  if (!roles.length) return { ok: false as const, reason: "اختر دوراً واحداً على الأقل" };

  const primary = roles[0];
  const meta = {
    role: primary,
    all_roles: roles,
    is_multi_role: roles.length > 1,
    clinic_id: clinicId,
  };
  const created = await sb.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: meta,
  });
  if (created.error) return { ok: false as const, reason: created.error.message };

  const { error: sterr } = await sb.from("tawd_staff_users").insert({
    id: created.data.user.id,
    clinic_id: clinicId,
    name: input.name.trim(),
    name_ar: input.name.trim(),
    email,
    role: STAFF_ROLE_MAP[primary],
    is_active: true,
  });
  if (sterr) return { ok: false as const, reason: `الحساب أُنشئ لكن تعذّر سجل الموظف: ${sterr.message}` };

  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return { ok: true as const, email };
}

/** Update a clinic's subscription (plan / price / status). */
export async function updateSubscription(
  clinicId: string,
  input: { plan: "starter" | "growth" | "pro" | "enterprise"; price_omr: number; status: "trial" | "active" | "suspended" }
) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { error } = await sb
    .from("tawd_subscriptions")
    .update({
      plan: input.plan,
      price_omr: Math.max(0, Number(input.price_omr) || 0),
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinicId);
  if (error) return { ok: false as const, reason: error.message };
  /* keep clinic plan/status in sync */
  await sb.from("tawd_clinics").update({ plan: input.plan, status: input.status }).eq("id", clinicId);
  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  revalidatePath("/platform-admin");
  return { ok: true as const };
}

/** Renew: extend the period one month from max(now, current end) and activate. */
export async function renewSubscriptionMonth(clinicId: string) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { data: sub } = await sb
    .from("tawd_subscriptions").select("current_period_end").eq("clinic_id", clinicId).maybeSingle();
  const base = sub?.current_period_end && new Date(sub.current_period_end) > new Date()
    ? new Date(sub.current_period_end) : new Date();
  base.setMonth(base.getMonth() + 1);
  const { error } = await sb
    .from("tawd_subscriptions")
    .update({
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: base.toISOString(),
      renews_at: base.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinicId);
  if (error) return { ok: false as const, reason: error.message };
  await sb.from("tawd_clinics").update({ status: "active" }).eq("id", clinicId);
  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  revalidatePath("/platform-admin");
  return { ok: true as const, until: base.toISOString().split("T")[0] };
}

/** WhatsApp from the PLATFORM to clinic owners' phones (single or bulk).
    Uses the platform sender (first active WhatsApp channel config).
    Business-initiated messages may require an approved template outside
    the 24h window — we report per-clinic success honestly. */
export async function sendClinicWhatsApp(clinicIds: string[], message: string) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const text = message.trim();
  if (!text) return { ok: false as const, reason: "الرسالة فارغة" };
  if (!clinicIds.length) return { ok: false as const, reason: "اختر عيادة واحدة على الأقل" };

  const { data: cfg } = await sb
    .from("channel_configs").select("config").eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle();
  const conf = cfg?.config as Record<string, string> | null;
  if (!conf?.access_token || !conf?.phone_number_id) {
    return { ok: false as const, reason: "لا يوجد مرسل واتساب مفعّل للمنصة" };
  }

  const { data: clinics } = await sb
    .from("tawd_clinics").select("id, name_ar, name, phone").in("id", clinicIds);

  const results: { clinic: string; sent: boolean; reason?: string }[] = [];
  for (const c of clinics ?? []) {
    const to = (c.phone ?? "").replace(/\D/g, "");
    if (!to) { results.push({ clinic: c.name_ar ?? c.name, sent: false, reason: "لا يوجد رقم" }); continue; }
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${conf.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      });
      results.push({ clinic: c.name_ar ?? c.name, sent: res.ok, reason: res.ok ? undefined : `HTTP ${res.status}` });
    } catch {
      results.push({ clinic: c.name_ar ?? c.name, sent: false, reason: "فشل الاتصال" });
    }
  }
  return { ok: true as const, results, sentCount: results.filter((r) => r.sent).length };
}

/** Founder's fixed monthly costs (Vercel/Supabase/n8n/Meta ...). */
export async function addPlatformCost(name: string, monthlyOmr: number) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  if (!name.trim()) return { ok: false as const, reason: "الاسم مطلوب" };
  const { error } = await sb.from("platform_costs").insert({ name: name.trim(), monthly_omr: Math.max(0, Number(monthlyOmr) || 0) });
  if (error) return { ok: false as const, reason: error.message };
  revalidatePath("/platform-admin");
  return { ok: true as const };
}

export async function deletePlatformCost(id: string) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { error } = await sb.from("platform_costs").delete().eq("id", id);
  if (error) return { ok: false as const, reason: error.message };
  revalidatePath("/platform-admin");
  return { ok: true as const };
}

/** Activate / suspend a clinic. */
export async function setClinicStatus(clinicId: string, status: "trial" | "active" | "suspended") {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { error } = await sb
    .from("tawd_clinics")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clinicId);
  if (error) return { ok: false as const, reason: error.message };
  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return { ok: true as const };
}
