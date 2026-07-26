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

export type NewClinicStaff = {
  name: string;
  email: string;
  password: string;
  /** one or more; the first is the primary role whose dashboard opens on login */
  roles: string[];
  specialty?: string;
};

export type NewClinicInput = {
  name: string;        // EN
  nameAr: string;      // AR
  clinicType: string;  // dental | cosmetic | ...
  phone?: string;
  /** plan code from platform_plans — its price is copied onto the subscription
      so a later repricing of the catalogue never moves an existing customer */
  plan?: string;
  /** days of trial; 0 starts the clinic active and billing immediately */
  trialDays?: number;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  /** the rest of the team, each with their own role set */
  staff?: NewClinicStaff[];
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
  /* The clinic name ends up on invoices and on the public booking page, so a
     two-letter placeholder typed while testing becomes a real customer's
     letterhead. Three characters is the shortest genuine clinic name. */
  if (nameAr.length < 3) return { ok: false as const, reason: "الاسم العربي قصير جداً — اكتب اسم العيادة كاملاً" };
  if (name.length < 3 || !/[a-zA-Z]/.test(name)) {
    return { ok: false as const, reason: "الاسم الإنجليزي قصير جداً أو ليس بحروف إنجليزية" };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, reason: "بريد المدير غير صالح" };
  if (input.adminPassword.length < 8) return { ok: false as const, reason: "كلمة المرور 8 أحرف على الأقل" };
  if (!input.adminName.trim() || input.adminName.trim().length < 3) {
    return { ok: false as const, reason: "اسم المدير مطلوب — الاسم الكامل" };
  }

  /* Oman mobile numbers: 8 digits starting 7 or 9, with or without +968.
     Sura sends the clinic's own reminders from this number. */
  const rawPhone = (input.phone ?? "").replace(/[\s-]/g, "");
  if (rawPhone && !/^(\+?968)?[79]\d{7}$/.test(rawPhone)) {
    return { ok: false as const, reason: "رقم الهاتف غير صالح — رقم عُماني من ٨ أرقام يبدأ بـ ٧ أو ٩" };
  }

  /* Two clinics with the same Arabic name are indistinguishable everywhere the
     operator sees them — the clinics list, the revenue table, the support view. */
  const { data: sameName } = await sb
    .from("tawd_clinics").select("id").eq("name_ar", nameAr).limit(1);
  if (sameName?.length) {
    return { ok: false as const, reason: `توجد عيادة بنفس الاسم «${nameAr}» — اختر اسماً مميزاً` };
  }

  /* ── PRE-FLIGHT ──
     Nothing is created until every email is known to be usable.

     This function used to insert the clinic, seed six tables, and only then try
     to create the manager's login. A duplicate email at that point returned an
     error while leaving behind a clinic with no manager and no staff — a tenant
     nobody can log into, which is worse than an outright failure because it
     looks like a customer. One such clinic was created this way before this fix.

     Checking first costs one query and makes the whole operation safe to retry. */
  const staffList = (input.staff ?? []).filter((m) => m.name.trim() && m.email.trim());
  const wanted = [email, ...staffList.map((m) => m.email.trim().toLowerCase())];

  const dupInForm = wanted.find((e, i) => wanted.indexOf(e) !== i);
  if (dupInForm) {
    return { ok: false as const, reason: `البريد ${dupInForm} مكرَّر في النموذج — كل حساب يحتاج بريداً خاصاً به` };
  }
  for (const m of staffList) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email.trim().toLowerCase())) {
      return { ok: false as const, reason: `بريد غير صالح: ${m.email}` };
    }
    if (!m.roles?.length) {
      return { ok: false as const, reason: `اختر دوراً واحداً على الأقل لـ ${m.name || m.email}` };
    }
  }

  const { data: existing } = await sb
    .from("tawd_staff_users").select("email").in("email", wanted).limit(wanted.length);
  if (existing?.length) {
    const taken = existing.map((r) => r.email).join("، ");
    return { ok: false as const, reason: `هذه الحسابات مسجّلة مسبقاً: ${taken}` };
  }

  /* unique url slug from the english name (fallback → arabic → random) */
  const base = (name || nameAr).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  let slug = base || `clinic-${Math.random().toString(36).slice(2, 8)}`;
  const { data: clash } = await sb.from("tawd_clinics").select("id").eq("slug", slug).limit(1);
  if (clash?.length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  /* Resolve the plan first: the clinic row itself carries plan and status, so
     looking this up afterwards would have left every new clinic on "starter /
     trial" no matter what was chosen. */
  const planCode = (input.plan ?? "starter").trim();
  const { data: planRow } = await sb
    .from("platform_plans")
    .select("code, price_omr, per_doctor_omr, setup_fee_omr, modules, max_doctors, max_staff, max_patients, max_whatsapp_msgs")
    .eq("code", planCode).maybeSingle();
  const planPrice = Number(planRow?.price_omr ?? 0);
  const resolvedPlan = (planRow?.code as string) ?? "starter";
  const trialDays = Math.max(0, Math.min(90, Math.floor(Number(input.trialDays ?? 14))));

  /* 1 — the clinic */
  const { data: clinic, error: cerr } = await sb
    .from("tawd_clinics")
    .insert({
      name,
      name_ar: nameAr,
      slug,
      clinic_type: SERVICE_TEMPLATES[input.clinicType] ? input.clinicType : "general",
      phone: rawPhone ? (rawPhone.startsWith("+") ? rawPhone : `+968${rawPhone.replace(/^968/, "")}`) : null,
      vat_enabled: true,
      plan: resolvedPlan,
      status: trialDays > 0 ? "trial" : "active",
    })
    .select("id")
    .single();
  if (cerr || !clinic) return { ok: false as const, reason: `تعذّر إنشاء العيادة: ${cerr?.message ?? ""}` };
  const clinicId = clinic.id as string;

  /* 2 — defaults: settings + smart loyalty + the chosen plan.

     The price is COPIED from the catalogue onto this subscription rather than
     referenced. Repricing "pro" next quarter must not silently re-bill every
     clinic already on it — what a customer agreed to is a fact about them, not
     a lookup. */
  const trialEnd = new Date(Date.now() + Math.max(trialDays, 1) * 86_400_000).toISOString();
  /* The contract, copied from the template. Without this row the clinic falls
     back to everything-unlimited — safe, but not what was sold. The operator
     tunes it from the clinic file after the consultation. */
  const contractedDoctors = Math.max(
    1, (input.staff ?? []).filter((m) => (m.roles ?? []).includes("doctor")).length,
  );
  const [s1, s2, s3, s4] = await Promise.all([
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
    sb.from("tawd_subscriptions").insert({
      clinic_id: clinicId,
      plan: resolvedPlan,
      price_omr: planPrice,
      // trialDays = 0 means the clinic starts paying today
      status: trialDays > 0 ? "trial" : "active",
      trial_ends_at: trialEnd,
      current_period_end: trialDays > 0
        ? trialEnd
        : new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }),
    sb.from("clinic_entitlements").insert({
      clinic_id: clinicId,
      source_plan: resolvedPlan,
      modules: (planRow?.modules as string[] | null) ?? [],
      max_doctors: planRow?.max_doctors ?? null,
      max_staff: planRow?.max_staff ?? null,
      max_patients: planRow?.max_patients ?? null,
      max_whatsapp_msgs: planRow?.max_whatsapp_msgs ?? null,
      base_price_omr: planPrice,
      per_doctor_omr: Number(planRow?.per_doctor_omr ?? 0),
      setup_fee_omr: Number(planRow?.setup_fee_omr ?? 0),
      contracted_doctors: contractedDoctors,
      notes: "مُنشأة من القالب عند التسجيل — تُعدَّل من ملف العيادة بعد الاستشارة",
    }),
  ]);
  const seedErr = s1.error ?? s2.error ?? s3.error ?? s4.error;

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
    /* Pre-flight should have caught this, but a race or an auth-side rejection
       can still land here. A clinic with no manager is unusable, so it is
       removed rather than left behind — every seeded row cascades off the
       clinic id, so deleting the clinic cleans up the lot. */
    await sb.from("tawd_clinics").delete().eq("id", clinicId);
    return {
      ok: false as const,
      reason: `تعذّر إنشاء حساب المدير — أُلغيت العيادة ولم يُحفظ شيء: ${created.error.message}`,
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
    all_roles: ["admin"],
    is_active: true,
  });

  /* 5 — the team, as the clinic actually has it.

     This used to be "N doctors, plus optionally ONE account hardwired to
     receptionist+accountant". That covers one clinic shape. A clinic with a
     separate receptionist and a separate accountant could not be set up here at
     all, and neither could a manager who also treats patients. Every account is
     now just a person with a name, a login, and one or more roles — the same
     model the staff screen uses, so what is created here is exactly what the
     manager can edit afterwards. */
  const teamWarnings: string[] = [];
  const roleCounts = { doctor: 0, receptionist: 0, accountant: 0, clinic_admin: 0 };
  const staffCreds: { name: string; email: string; password: string; roles: string[] }[] = [];

  for (const m of (input.staff ?? []).slice(0, 40)) {
    const mEmail = m.email.trim().toLowerCase();
    const mName = m.name.trim();
    const roles = (m.roles ?? []).filter((r) => STAFF_ROLE_MAP[r]);

    if (!mName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mEmail) || m.password.length < 8 || !roles.length) {
      teamWarnings.push(`حساب متجاهل (بيانات ناقصة): ${mName || mEmail || "?"}`);
      continue;
    }

    const primary = roles[0];
    const mc = await sb.auth.admin.createUser({
      email: mEmail,
      password: m.password,
      email_confirm: true,
      app_metadata: {
        role: primary,
        all_roles: roles,
        is_multi_role: roles.length > 1,
        clinic_id: clinicId,
      },
    });
    if (mc.error) { teamWarnings.push(`${mEmail}: ${mc.error.message}`); continue; }

    const { error: mse } = await sb.from("tawd_staff_users").insert({
      id: mc.data.user.id,
      clinic_id: clinicId,
      name: mName,
      name_ar: mName,
      email: mEmail,
      role: STAFF_ROLE_MAP[primary],
      all_roles: roles.map((r) => STAFF_ROLE_MAP[r]),
      specialty: m.specialty?.trim() || null,
      is_active: true,
    });
    if (mse) { teamWarnings.push(`${mEmail}: ${mse.message}`); continue; }

    for (const r of roles) roleCounts[r as keyof typeof roleCounts] += 1;
    /* The operator has to hand these over. Generating a password and never
       showing it creates accounts nobody can sign into. */
    staffCreds.push({ name: mName, email: mEmail, password: m.password, roles });
  }

  const doctorsCreated = roleCounts.doctor;
  const frontdeskCreated = roleCounts.receptionist > 0 || roleCounts.accountant > 0;

  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/clinics");
  return {
    ok: true as const,
    clinicId,
    adminEmail: email,
    servicesSeeded: sverr ? 0 : tpl.length,
    doctorsCreated,
    frontdeskCreated,
    staffCreds,
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
    all_roles: roles.map((r) => STAFF_ROLE_MAP[r]),
    is_active: true,
  });
  if (sterr) return { ok: false as const, reason: `الحساب أُنشئ لكن تعذّر سجل الموظف: ${sterr.message}` };

  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return { ok: true as const, email };
}

/** Update a clinic's subscription (plan / price / status). */
/* The two tables use DIFFERENT enums for what looks like the same word:
     clinic_status       = trial | active | suspended | cancelled
     subscription_status = trial | active | past_due  | cancelled | paused
   There is no 'suspended' subscription. This function used to write the caller's
   status into both, so choosing "suspended" failed the subscription UPDATE on an
   invalid enum, returned early, and left the clinic un-suspended too — the one
   action that is supposed to cut off a non-paying tenant did nothing at all.
   A suspended clinic is a paused subscription; the mapping is explicit now. */
const SUB_STATUS: Record<"trial" | "active" | "suspended", string> = {
  trial: "trial",
  active: "active",
  suspended: "paused",
};

export async function updateSubscription(
  clinicId: string,
  /* `plan` is a catalogue code, not one of four literals. It was a union until
     plans became something the founder defines, at which point a template he
     created himself could not be selected. The FK on both tables keeps it
     honest — an unknown code is refused by Postgres, not by a type. */
  input: { plan: string; price_omr: number; status: "trial" | "active" | "suspended" }
) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { error } = await sb
    .from("tawd_subscriptions")
    .update({
      plan: input.plan,
      price_omr: Math.max(0, Number(input.price_omr) || 0),
      status: SUB_STATUS[input.status],
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinicId);
  if (error) return { ok: false as const, reason: error.message };
  /* keep clinic plan/status in sync — this side keeps the word "suspended" */
  const { error: cerr } = await sb
    .from("tawd_clinics")
    .update({ plan: input.plan, status: input.status })
    .eq("id", clinicId);
  if (cerr) return { ok: false as const, reason: cerr.message };

  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  revalidatePath("/platform-admin/clinics");
  revalidatePath("/platform-admin/subscriptions");
  revalidatePath("/platform-admin");
  return { ok: true as const };
}

/** Give a trial more time.

    Operators need this constantly — a clinic is mid-onboarding when the 14 days
    run out, and the alternative was either charging them or letting the trial
    lapse and losing them. Extends from whichever is later, now or the current
    end, so extending twice does not shorten anything. */
export async function extendTrial(clinicId: string, days: number) {
  await requirePlatform();
  const add = Math.min(90, Math.max(1, Math.floor(Number(days) || 0)));

  const sb = await createServiceRoleClient();
  const { data: sub } = await sb
    .from("tawd_subscriptions").select("trial_ends_at").eq("clinic_id", clinicId).maybeSingle();

  const from = Math.max(Date.now(), sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0);
  const newEnd = new Date(from + add * 86_400_000).toISOString();

  const { error } = await sb.from("tawd_subscriptions")
    .update({ status: "trial", trial_ends_at: newEnd, updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId);
  if (error) return { ok: false as const, reason: error.message };

  await sb.from("tawd_clinics").update({ status: "trial" }).eq("id", clinicId);

  revalidatePath("/platform-admin/subscriptions");
  revalidatePath("/platform-admin/clinics");
  revalidatePath("/platform-admin");
  return { ok: true as const, until: newEnd };
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

/** Step 1: ask the clinic's permission for support access (WhatsApp + in-app). */
export async function requestClinicAccess(clinicId: string) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  /* one open request at a time */
  await sb.from("support_access_requests").update({ status: "expired" })
    .eq("clinic_id", clinicId).eq("status", "pending");
  const { error } = await sb.from("support_access_requests")
    .insert({ clinic_id: clinicId, reason: "دعم فني من فريق طود" });
  if (error) return { ok: false as const, reason: error.message };
  await sendClinicWhatsApp([clinicId],
    "🛠️ فريق منصة طود يطلب إذن الدخول للوحة عيادتكم للدعم الفني.\nللموافقة: افتحوا لوحة التحكم وستجدون الطلب في الأعلى.").catch(() => null);
  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return { ok: true as const };
}

/** Clinic admin answers the request (approve = 60 minutes of access). */
export async function respondSupportAccess(requestId: string, approve: boolean) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  const sb = await createServiceRoleClient();
  const { error } = await sb.from("support_access_requests")
    .update({
      status: approve ? "approved" : "denied",
      responded_at: new Date().toISOString(),
      expires_at: approve ? new Date(Date.now() + 3600_000).toISOString() : null,
    })
    .eq("id", requestId).eq("clinic_id", claims.clinic_id).eq("status", "pending");
  if (error) return { ok: false as const, reason: error.message };
  revalidatePath("/clinic-admin");
  return { ok: true as const };
}

/** Step 2: impersonation link — ONLY with a live approval from the clinic. */
export async function impersonateClinic(clinicId: string) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { data: ok } = await sb.from("support_access_requests")
    .select("id").eq("clinic_id", clinicId).eq("status", "approved")
    .gt("expires_at", new Date().toISOString()).limit(1);
  if (!ok?.length) {
    return { ok: false as const, reason: "لا توجد موافقة سارية من العيادة — أرسل طلب إذن أولاً", needsRequest: true };
  }
  const { data: admin } = await sb
    .from("tawd_staff_users")
    .select("email")
    .eq("clinic_id", clinicId)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!admin?.email) return { ok: false as const, reason: "لا يوجد حساب مدير لهذه العيادة" };

  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: admin.email,
    options: { redirectTo: "https://tawd-clinic-os.vercel.app/clinic-admin" },
  });
  if (error || !data?.properties?.action_link) {
    return { ok: false as const, reason: error?.message ?? "تعذّر توليد الرابط" };
  }
  return { ok: true as const, link: data.properties.action_link, email: admin.email };
}

/** Delete a clinic and everything under it.

    Guarded three ways, because this is the one irreversible action in the
    product:

    1. The clinic must be suspended first. Deleting a live tenant mid-consultation
       is never right, and suspending is the reversible half of the same decision
       — if suspension turns out to be enough, nothing else has to happen.
    2. The caller types the clinic's own name. A confirm dialog is muscle memory;
       typing the name is not.
    3. If the clinic holds real records — patients, invoices — the counts come
       back and the delete is refused until the operator explicitly acknowledges
       them. Medical and financial records are not discarded because a row looked
       untidy in a list.

    Everything else cascades off clinic_id. Staff logins live in auth, outside
    that cascade, so they are removed separately. */
export async function deleteClinic(input: {
  clinicId: string;
  /** must match the clinic's Arabic or English name exactly */
  confirmName: string;
  /** set only after the operator has seen what will be destroyed */
  acknowledgeDataLoss?: boolean;
}) {
  await requirePlatform();
  const sb = await createServiceRoleClient();

  const { data: clinic } = await sb
    .from("tawd_clinics").select("id, name, name_ar, status").eq("id", input.clinicId).maybeSingle();
  if (!clinic) return { ok: false as const, reason: "العيادة غير موجودة" };

  if (clinic.status !== "suspended" && clinic.status !== "cancelled") {
    return { ok: false as const, reason: "أوقف العيادة أولاً — الحذف لا يكون لعيادة تعمل" };
  }

  const typed = input.confirmName.trim();
  if (typed !== String(clinic.name_ar ?? "").trim() && typed !== String(clinic.name ?? "").trim()) {
    return { ok: false as const, reason: "اسم العيادة غير مطابق" };
  }

  const [{ count: patients }, { count: invoices }] = await Promise.all([
    sb.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", input.clinicId),
    sb.from("invoices").select("id", { count: "exact", head: true }).eq("clinic_id", input.clinicId),
  ]);

  if (((patients ?? 0) + (invoices ?? 0)) > 0 && !input.acknowledgeDataLoss) {
    return {
      ok: false as const,
      needsAcknowledge: true as const,
      patients: patients ?? 0,
      invoices: invoices ?? 0,
      reason: `تحتفظ هذه العيادة بـ ${patients ?? 0} مريض و ${invoices ?? 0} فاتورة — صدّرها أو أكّد فقدانها`,
    };
  }

  /* Logins live in auth.users, outside any cascade, so they go first. Doing it
     the other way round would leave accounts that can sign in and land nowhere. */
  const { data: staff } = await sb
    .from("tawd_staff_users").select("id").eq("clinic_id", input.clinicId);
  for (const m of staff ?? []) {
    try { await sb.auth.admin.deleteUser(m.id as string); } catch { /* already gone */ }
  }

  /* One transaction, in dependency order — several of the clinic's foreign keys
     are ON DELETE RESTRICT, so a plain delete of the clinic row only works for
     an empty clinic. See delete_clinic_cascade(). */
  const { error } = await sb.rpc("delete_clinic_cascade", { p_clinic_id: input.clinicId });
  if (error) return { ok: false as const, reason: `تعذّر حذف العيادة: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/clinics");
  return { ok: true as const, deletedStaff: (staff ?? []).length };
}

/** Activate / suspend a clinic — the operator's kill switch.

    Suspending moves the subscription too. It used to change only the clinic row,
    so a suspended tenant kept an `active` subscription and went on being counted
    in MRR: the dashboard reported revenue from a clinic that had been cut off.
    Suspension and billing are the same decision and now move together. */
export async function setClinicStatus(clinicId: string, status: "trial" | "active" | "suspended") {
  await requirePlatform();
  const sb = await createServiceRoleClient();

  const { error } = await sb
    .from("tawd_clinics")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clinicId);
  if (error) return { ok: false as const, reason: error.message };

  const { error: serr } = await sb
    .from("tawd_subscriptions")
    .update({ status: SUB_STATUS[status], updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId);
  if (serr) return { ok: false as const, reason: `عُلّقت العيادة لكن تعذّر تحديث اشتراكها: ${serr.message}` };

  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/clinics");
  revalidatePath("/platform-admin/subscriptions");
  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return { ok: true as const };
}
