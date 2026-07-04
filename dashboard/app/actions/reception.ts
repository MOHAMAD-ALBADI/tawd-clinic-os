"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

async function requireReception() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) {
    throw new Error("غير مصرح");
  }
  return claims;
}

/** Next queue position for today (1-based). */
async function nextQueuePosition(sb: Awaited<ReturnType<typeof createServerSupabaseClient>>, clinicId: string) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data } = await sb
    .from("waiting_queue")
    .select("queue_position")
    .eq("clinic_id", clinicId)
    .gte("check_in_at", dayStart.toISOString())
    .order("queue_position", { ascending: false })
    .limit(1);
  return ((data?.[0]?.queue_position as number | undefined) ?? 0) + 1;
}

/** Patient arrived: mark appointment checked_in + enter the waiting room queue. */
export async function checkInArrival(appointmentId: string) {
  const claims = await requireReception();
  const sb = await createServerSupabaseClient();

  const { data: appt, error: aerr } = await sb
    .from("appointments")
    .update({ status: "checked_in", updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("clinic_id", claims.clinic_id)
    .in("status", ["scheduled", "confirmed"])
    .select("id, patient_id")
    .maybeSingle();
  if (aerr) throw new Error(aerr.message);
  if (!appt) throw new Error("الموعد غير قابل لتسجيل الوصول");

  const { data: existing } = await sb
    .from("waiting_queue")
    .select("id")
    .eq("appt_id", appointmentId)
    .in("status", ["waiting", "called", "in_room"])
    .limit(1);

  let position: number | null = null;
  if (!existing?.length) {
    position = await nextQueuePosition(sb, claims.clinic_id);
    const { error: qerr } = await sb.from("waiting_queue").insert({
      clinic_id: claims.clinic_id,
      appt_id: appointmentId,
      patient_id: appt.patient_id,
      queue_position: position,
      status: "waiting",
      check_in_at: new Date().toISOString(),
      estimated_wait_minutes: (position - 1) * 15,
    });
    if (qerr) throw new Error(qerr.message);
  }

  revalidatePath("/reception");
  return { position };
}

export type WalkInInput = {
  patientId?: string;
  name?: string;
  phone?: string;
  serviceId: string;
  doctorId: string;
};

/** Walk-in: patient with no booking → immediate appointment + waiting room entry. */
export async function walkIn(input: WalkInInput) {
  const claims = await requireReception();
  const sb = await createServerSupabaseClient();

  /* resolve or create the patient */
  let patientId = input.patientId ?? "";
  if (!patientId) {
    const phone = (input.phone ?? "").trim();
    const name = (input.name ?? "").trim();
    if (!name) throw new Error("اسم المريض مطلوب");
    if (phone) {
      const { data: found } = await sb
        .from("patients").select("id").eq("clinic_id", claims.clinic_id)
        .eq("phone", phone).is("deleted_at", null).limit(1);
      if (found?.length) patientId = found[0].id;
    }
    if (!patientId) {
      const { data: created, error } = await sb
        .from("patients")
        .insert({ clinic_id: claims.clinic_id, name, phone: phone || null, source_channel: "walk_in" })
        .select("id").single();
      if (error) throw new Error(error.message);
      patientId = created.id;
    }
  }

  const { data: svc } = await sb
    .from("services").select("duration_minutes").eq("id", input.serviceId).single();

  const { data: appt, error: aerr } = await sb
    .from("appointments")
    .insert({
      clinic_id: claims.clinic_id,
      patient_id: patientId,
      doctor_id: input.doctorId,
      service_id: input.serviceId,
      slot_time: new Date().toISOString(),
      duration_minutes: svc?.duration_minutes ?? 30,
      status: "checked_in",
      type: "consultation",
      source_channel: "walk_in",
      notes: "زيارة مباشرة بدون حجز (الاستقبال)",
    })
    .select("id")
    .single();
  if (aerr) throw new Error(aerr.message);

  const position = await nextQueuePosition(sb, claims.clinic_id);
  const { error: qerr } = await sb.from("waiting_queue").insert({
    clinic_id: claims.clinic_id,
    appt_id: appt.id,
    patient_id: patientId,
    queue_position: position,
    status: "waiting",
    check_in_at: new Date().toISOString(),
    estimated_wait_minutes: (position - 1) * 15,
  });
  if (qerr) throw new Error(qerr.message);

  revalidatePath("/reception");
  return { position };
}

/** Move a waiting-room entry through its lifecycle. "called" also pings the patient on WhatsApp. */
export async function setQueueStatus(
  queueId: string,
  status: "called" | "in_room" | "done" | "left"
) {
  const claims = await requireReception();
  const sb = await createServerSupabaseClient();

  const patch: Record<string, unknown> = { status };
  if (status === "called") patch.called_at = new Date().toISOString();
  if (status === "done" || status === "left") patch.done_at = new Date().toISOString();

  const { data: row, error } = await sb
    .from("waiting_queue")
    .update(patch)
    .eq("id", queueId)
    .eq("clinic_id", claims.clinic_id)
    .select("id, patient_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("سجل الانتظار غير موجود");

  let whatsappSent = false;
  if (status === "called") {
    whatsappSent = await notifyPatientTurn(claims.clinic_id, row.patient_id);
  }

  revalidatePath("/reception");
  return { whatsappSent };
}

/** WhatsApp "دورك الآن" — best-effort (marks called regardless). */
async function notifyPatientTurn(clinicId: string, patientId: string): Promise<boolean> {
  try {
    const svc = await createServiceRoleClient();
    const [{ data: patient }, { data: cfg }, { data: clinic }] = await Promise.all([
      svc.from("patients").select("name, phone").eq("id", patientId).single(),
      svc.from("channel_configs").select("config").eq("clinic_id", clinicId).eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle(),
      svc.from("tawd_clinics").select("name_ar, name").eq("id", clinicId).single(),
    ]);
    const conf = cfg?.config as Record<string, string> | null;
    const to = (patient?.phone ?? "").replace(/\D/g, "");
    if (!conf?.access_token || !conf?.phone_number_id || !to) return false;

    const body = `🔔 ${patient?.name ? patient.name + "، " : ""}دورك الآن — تفضل بالدخول.\n${clinic?.name_ar ?? clinic?.name ?? ""}`;
    const res = await fetch(`https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conf.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type QuickBookInput = {
  patientId?: string;
  name?: string;
  phone?: string;
  serviceId: string;
  doctorId: string | "any";
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
};

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/** Booking from the desk — same availability rules Sura uses
    (overlap + doctor weekly schedule + leaves; no schedule = always available). */
export async function bookQuick(input: QuickBookInput) {
  const claims = await requireReception();
  const sb = await createServerSupabaseClient();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
    throw new Error("تاريخ أو وقت غير صالح");
  }
  const slotISO = `${input.date}T${input.time}:00+04:00`;
  const slot = new Date(slotISO);
  if (slot.getTime() <= Date.now()) throw new Error("الوقت المطلوب في الماضي");

  const { data: svc } = await sb
    .from("services").select("id, duration_minutes, name_ar").eq("id", input.serviceId).single();
  if (!svc) throw new Error("الخدمة غير موجودة");
  const dur = svc.duration_minutes ?? 30;
  const slotEnd = new Date(slot.getTime() + dur * 60_000);

  /* resolve or create the patient */
  let patientId = input.patientId ?? "";
  if (!patientId) {
    const name = (input.name ?? "").trim();
    const phone = (input.phone ?? "").trim();
    if (!name) throw new Error("اسم المريض مطلوب");
    if (phone) {
      const { data: found } = await sb
        .from("patients").select("id").eq("clinic_id", claims.clinic_id)
        .eq("phone", phone).is("deleted_at", null).limit(1);
      if (found?.length) patientId = found[0].id;
    }
    if (!patientId) {
      const { data: created, error } = await sb
        .from("patients")
        .insert({ clinic_id: claims.clinic_id, name, phone: phone || null, source_channel: "reception" })
        .select("id").single();
      if (error) throw new Error(error.message);
      patientId = created.id;
    }
  }

  /* candidate doctors */
  let candidates: { id: string; label: string }[] = [];
  if (input.doctorId !== "any") {
    const { data: d } = await sb
      .from("tawd_staff_users").select("id, name, name_ar")
      .eq("id", input.doctorId).eq("clinic_id", claims.clinic_id).single();
    if (!d) throw new Error("الطبيب غير موجود");
    candidates = [{ id: d.id, label: d.name_ar ?? d.name }];
  } else {
    const { data: ds } = await sb
      .from("tawd_staff_users").select("id, name, name_ar")
      .eq("clinic_id", claims.clinic_id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null);
    candidates = (ds ?? []).map((d) => ({ id: d.id, label: d.name_ar ?? d.name }));
    /* prefer doctors mapped to the service, when mappings exist */
    const { data: maps } = await sb
      .from("doctor_services").select("doctor_id").eq("service_id", input.serviceId).eq("is_active", true);
    const mapped = new Set((maps ?? []).map((m) => m.doctor_id));
    if (mapped.size > 0) candidates = candidates.filter((c) => mapped.has(c.id));
  }
  if (!candidates.length) throw new Error("لا يوجد طبيب يقدم هذه الخدمة");

  /* availability data for that day */
  const dayStart = `${input.date}T00:00:00+04:00`;
  const dayEnd = `${input.date}T23:59:59+04:00`;
  const ids = candidates.map((c) => c.id);
  const dayKey = DAY_KEYS[new Date(`${input.date}T12:00:00+04:00`).getUTCDay()];
  const slotMin = slot.getUTCHours() * 60 + slot.getUTCMinutes() + 240; // Muscat minutes
  const slotMinDay = ((slotMin % 1440) + 1440) % 1440;

  const [{ data: dayAppts }, { data: schedules }, { data: holidays }] = await Promise.all([
    sb.from("appointments")
      .select("doctor_id, slot_time, duration_minutes")
      .eq("clinic_id", claims.clinic_id).in("doctor_id", ids)
      .gte("slot_time", dayStart).lte("slot_time", dayEnd)
      .not("status", "in", "(cancelled,no_show)").is("deleted_at", null),
    sb.from("doctor_schedules")
      .select("doctor_id, day_of_week, start_time, end_time")
      .in("doctor_id", ids).eq("is_active", true),
    sb.from("clinic_holidays")
      .select("doctor_id, applies_to_all_doctors")
      .eq("clinic_id", claims.clinic_id).eq("holiday_date", input.date),
  ]);

  const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);

  const pick = candidates.find((c) => {
    /* leave that day? */
    if ((holidays ?? []).some((h) => h.applies_to_all_doctors || h.doctor_id === c.id)) return false;
    /* weekly schedule (no rows = always available) */
    const mySched = (schedules ?? []).filter((s) => s.doctor_id === c.id);
    if (mySched.length > 0) {
      const fits = mySched.some(
        (s) => s.day_of_week === dayKey && slotMinDay >= toMin(s.start_time) && slotMinDay + dur <= toMin(s.end_time)
      );
      if (!fits) return false;
    }
    /* overlap with existing appointments */
    const clash = (dayAppts ?? []).some((a) => {
      if (a.doctor_id !== c.id) return false;
      const aStart = new Date(a.slot_time).getTime();
      const aEnd = aStart + (a.duration_minutes ?? 30) * 60_000;
      return aStart < slotEnd.getTime() && aEnd > slot.getTime();
    });
    return !clash;
  });

  if (!pick) return { ok: false as const, reason: "لا يوجد طبيب متاح في هذا الوقت — جرّب وقتاً آخر" };

  const { error: ierr } = await sb.from("appointments").insert({
    clinic_id: claims.clinic_id,
    patient_id: patientId,
    doctor_id: pick.id,
    service_id: input.serviceId,
    slot_time: slotISO,
    duration_minutes: dur,
    status: "scheduled",
    type: "consultation",
    source_channel: "reception",
    notes: "حجز عبر الاستقبال",
  });
  if (ierr) throw new Error(ierr.message);

  revalidatePath("/reception");
  return { ok: true as const, doctor: pick.label, service: svc.name_ar as string | null };
}
