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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, reason: "بريد المدير غير صالح" };
  if (input.adminPassword.length < 8) return { ok: false as const, reason: "كلمة المرور 8 أحرف على الأقل" };
  if (!input.adminName.trim()) return { ok: false as const, reason: "اسم المدير مطلوب" };

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
    .from("platform_plans").select("code, price_omr").eq("code", planCode).maybeSingle();
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
      phone: input.phone?.trim() || null,
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
  input: { plan: "starter" | "growth" | "pro" | "enterprise"; price_omr: number; status: "trial" | "active" | "suspended" }
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
