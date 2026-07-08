"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

/* Public, unauthenticated booking — LOCKED to the clinic resolved from the
   slug. Validates service ownership + availability (doctor schedules,
   conflicts, leaves). Basic anti-abuse: 1 open booking per phone/clinic/day. */

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const normPhone = (p: string) => p.replace(/[^\d+]/g, "").replace(/^00/, "+");

export type PublicBookInput = {
  slug: string;
  serviceId: string;
  doctorId: string | "any";
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  name: string;
  phone: string;
};

export async function publicBook(input: PublicBookInput) {
  const sb = await createServiceRoleClient();

  const { data: clinic } = await sb
    .from("tawd_clinics").select("id, name_ar, name, status").eq("slug", input.slug).maybeSingle();
  if (!clinic) return { ok: false as const, reason: "العيادة غير موجودة" };
  if (clinic.status === "suspended") return { ok: false as const, reason: "الحجز الإلكتروني غير متاح حالياً لهذه العيادة" };
  const cid = clinic.id as string;

  const name = input.name.trim();
  const phone = normPhone(input.phone);
  if (name.length < 2) return { ok: false as const, reason: "الاسم مطلوب" };
  if (phone.replace(/\D/g, "").length < 8) return { ok: false as const, reason: "رقم جوال غير صالح" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
    return { ok: false as const, reason: "تاريخ أو وقت غير صالح" };
  }
  const slotISO = `${input.date}T${input.time}:00+04:00`;
  const slot = new Date(slotISO);
  if (slot.getTime() <= Date.now()) return { ok: false as const, reason: "الوقت المطلوب في الماضي" };
  if (slot.getTime() > Date.now() + 90 * 86_400_000) return { ok: false as const, reason: "الحجز متاح خلال 90 يوماً فقط" };

  const { data: svc } = await sb
    .from("services").select("id, duration_minutes, name_ar, price, is_active")
    .eq("id", input.serviceId).eq("clinic_id", cid).maybeSingle();
  if (!svc || !svc.is_active) return { ok: false as const, reason: "الخدمة غير متاحة" };
  const dur = svc.duration_minutes ?? 30;
  const slotEnd = new Date(slot.getTime() + dur * 60_000);

  /* candidate doctors (optionally filtered by service mapping) */
  let candidates: { id: string; label: string }[] = [];
  if (input.doctorId !== "any") {
    const { data: d } = await sb.from("tawd_staff_users").select("id, name, name_ar")
      .eq("id", input.doctorId).eq("clinic_id", cid).eq("role", "doctor").eq("is_active", true).maybeSingle();
    if (!d) return { ok: false as const, reason: "الطبيب غير متاح" };
    candidates = [{ id: d.id, label: d.name_ar ?? d.name }];
  } else {
    const { data: ds } = await sb.from("tawd_staff_users").select("id, name, name_ar")
      .eq("clinic_id", cid).eq("role", "doctor").eq("is_active", true).is("deleted_at", null);
    candidates = (ds ?? []).map((d) => ({ id: d.id, label: d.name_ar ?? d.name }));
    const { data: maps } = await sb.from("doctor_services").select("doctor_id").eq("service_id", input.serviceId).eq("is_active", true);
    const mapped = new Set((maps ?? []).map((m) => m.doctor_id));
    if (mapped.size > 0) candidates = candidates.filter((c) => mapped.has(c.id));
  }
  if (!candidates.length) return { ok: false as const, reason: "لا يوجد طبيب متاح لهذه الخدمة" };

  /* anti-abuse: block a second open booking same phone/clinic/day */
  const { data: existingPatient } = await sb
    .from("patients").select("id").eq("clinic_id", cid).eq("phone", phone).is("deleted_at", null).limit(1);
  let patientId = existingPatient?.[0]?.id as string | undefined;
  if (patientId) {
    const { count: dupes } = await sb
      .from("appointments").select("id", { count: "exact", head: true })
      .eq("clinic_id", cid).eq("patient_id", patientId)
      .in("status", ["scheduled", "confirmed"])
      .gte("slot_time", `${input.date}T00:00:00+04:00`).lte("slot_time", `${input.date}T23:59:59+04:00`);
    if ((dupes ?? 0) > 0) return { ok: false as const, reason: "لديك حجز قائم في هذا اليوم — تواصل مع العيادة لأي تعديل" };
  }

  /* availability data */
  const ids = candidates.map((c) => c.id);
  const dayKey = DAY_KEYS[new Date(`${input.date}T12:00:00+04:00`).getUTCDay()];
  const slotMinDay = (((slot.getUTCHours() * 60 + slot.getUTCMinutes() + 240) % 1440) + 1440) % 1440;
  const [{ data: dayAppts }, { data: schedules }, { data: holidays }] = await Promise.all([
    sb.from("appointments").select("doctor_id, slot_time, duration_minutes")
      .eq("clinic_id", cid).in("doctor_id", ids)
      .gte("slot_time", `${input.date}T00:00:00+04:00`).lte("slot_time", `${input.date}T23:59:59+04:00`)
      .not("status", "in", "(cancelled,no_show)").is("deleted_at", null),
    sb.from("doctor_schedules").select("doctor_id, day_of_week, start_time, end_time").in("doctor_id", ids).eq("is_active", true),
    sb.from("clinic_holidays").select("doctor_id, applies_to_all_doctors").eq("clinic_id", cid).eq("holiday_date", input.date),
  ]);
  const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
  const freeAt = (c: { id: string }, m: number, startMs: number) => {
    if ((holidays ?? []).some((h) => h.applies_to_all_doctors || h.doctor_id === c.id)) return false;
    const mine = (schedules ?? []).filter((s) => s.doctor_id === c.id);
    if (mine.length && !mine.some((s) => s.day_of_week === dayKey && m >= toMin(s.start_time) && m + dur <= toMin(s.end_time))) return false;
    const endMs = startMs + dur * 60_000;
    return !(dayAppts ?? []).some((a) => {
      if (a.doctor_id !== c.id) return false;
      const aS = new Date(a.slot_time).getTime();
      return aS < endMs && aS + (a.duration_minutes ?? 30) * 60_000 > startMs;
    });
  };

  const pick = candidates.find((c) => freeAt(c, slotMinDay, slot.getTime()));
  if (!pick) {
    const alternatives: string[] = [];
    for (let m = 9 * 60; m + dur <= 18 * 60 && alternatives.length < 6; m += 30) {
      if (m === slotMinDay) continue;
      const hh = String(Math.floor(m / 60)).padStart(2, "0"), mm = String(m % 60).padStart(2, "0");
      const t = new Date(`${input.date}T${hh}:${mm}:00+04:00`);
      if (t.getTime() <= Date.now()) continue;
      if (candidates.some((c) => freeAt(c, m, t.getTime()))) alternatives.push(`${hh}:${mm}`);
    }
    return { ok: false as const, reason: "هذا الوقت محجوز — اختر وقتاً آخر", alternatives };
  }

  /* create patient if new */
  if (!patientId) {
    const { data: created, error } = await sb.from("patients")
      .insert({ clinic_id: cid, name, phone, source_channel: "web_chat" }).select("id").single();
    if (error) return { ok: false as const, reason: "تعذّر إنشاء الحجز" };
    patientId = created.id;
  }

  const { data: appt, error: ierr } = await sb.from("appointments").insert({
    clinic_id: cid, patient_id: patientId, doctor_id: pick.id, service_id: input.serviceId,
    slot_time: slotISO, duration_minutes: dur, status: "scheduled", type: "consultation",
    source_channel: "web_chat", notes: "حجز إلكتروني عبر صفحة العيادة",
  }).select("id").single();
  if (ierr || !appt) return { ok: false as const, reason: "تعذّر إنشاء الحجز" };

  /* Sura WhatsApp confirmation (best-effort) */
  try {
    const { data: cfg } = await sb.from("channel_configs").select("config").eq("clinic_id", cid).eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle();
    const conf = cfg?.config as Record<string, string> | null;
    if (conf?.access_token && conf?.phone_number_id) {
      const when = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }).format(slot);
      await fetch(`https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${conf.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/\D/g, ""), type: "text",
          text: { body: `✅ تم تأكيد حجزك في ${clinic.name_ar ?? clinic.name}\n${svc.name_ar} مع ${pick.label}\n🗓️ ${when}\nنراك على خير 🌿` } }),
      });
    }
  } catch { /* confirmation is best-effort */ }

  const whenAr = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${input.date}T12:00:00`));
  return { ok: true as const, doctor: pick.label, service: svc.name_ar as string, when: `${whenAr} · ${input.time}` };
}
