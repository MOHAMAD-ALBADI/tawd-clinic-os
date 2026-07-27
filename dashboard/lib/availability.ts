import "server-only";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/* One definition of "is this doctor free then".

   bookQuick already worked this out — candidate doctors, the weekly schedule,
   leave days, and overlap with what is already booked — and the slot picker
   needs exactly the same answer. Two copies of these rules would drift, and the
   drift would be the worst kind: a picker offering times the booking then
   refuses, so the desk clicks a green button and gets an error.

   So the rules live here and both callers use them. The picker shows what
   bookQuick will accept, by construction rather than by coincidence. */

type SB = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export const DAY_KEYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

export type Candidate = { id: string; label: string };

export type Availability = {
  candidates: Candidate[];
  /** minutes the appointment occupies */
  durationMinutes: number;
  dayKey: string;
  /** the clinic-local date being looked at */
  date: string;
  appts: { doctor_id: string; slot_time: string; duration_minutes: number | null }[];
  schedules: { doctor_id: string; day_of_week: string; start_time: string; end_time: string }[];
  holidays: { doctor_id: string | null; applies_to_all_doctors: boolean }[];
};

const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);

/** Everything needed to answer availability for one service on one day. */
export async function loadAvailability(
  sb: SB, clinicId: string, serviceId: string, doctorId: string, date: string,
): Promise<{ ok: false; reason: string } | { ok: true; ctx: Availability }> {
  const { data: svc } = await sb
    .from("services").select("id, duration_minutes").eq("id", serviceId)
    .eq("clinic_id", clinicId).maybeSingle();
  if (!svc) return { ok: false, reason: "الخدمة غير موجودة" };
  const durationMinutes = (svc.duration_minutes as number | null) ?? 30;

  let candidates: Candidate[] = [];
  if (doctorId && doctorId !== "any") {
    const { data: d } = await sb.from("tawd_staff_users")
      .select("id, name, name_ar").eq("id", doctorId).eq("clinic_id", clinicId)
      .eq("is_active", true).is("deleted_at", null).maybeSingle();
    if (!d) return { ok: false, reason: "الطبيب غير موجود" };
    candidates = [{ id: d.id as string, label: (d.name_ar ?? d.name) as string }];
  } else {
    const { data: ds } = await sb.from("tawd_staff_users")
      .select("id, name, name_ar").eq("clinic_id", clinicId).eq("role", "doctor")
      .eq("is_active", true).is("deleted_at", null);
    candidates = (ds ?? []).map((d) => ({ id: d.id as string, label: (d.name_ar ?? d.name) as string }));

    /* Narrow to doctors mapped to this service, but only when any mapping
       exists — otherwise an unconfigured clinic would have no bookable doctor. */
    const { data: maps } = await sb.from("doctor_services")
      .select("doctor_id").eq("service_id", serviceId).eq("is_active", true);
    const mapped = new Set((maps ?? []).map((m) => m.doctor_id as string));
    if (mapped.size > 0) candidates = candidates.filter((c) => mapped.has(c.id));
  }
  if (!candidates.length) return { ok: false, reason: "لا يوجد طبيب يقدم هذه الخدمة" };

  const ids = candidates.map((c) => c.id);
  const [{ data: appts }, { data: schedules }, { data: holidays }] = await Promise.all([
    sb.from("appointments")
      .select("doctor_id, slot_time, duration_minutes")
      .eq("clinic_id", clinicId).in("doctor_id", ids)
      .gte("slot_time", `${date}T00:00:00+04:00`).lte("slot_time", `${date}T23:59:59+04:00`)
      .not("status", "in", "(cancelled,no_show)").is("deleted_at", null),
    sb.from("doctor_schedules")
      .select("doctor_id, day_of_week, start_time, end_time").in("doctor_id", ids).eq("is_active", true),
    sb.from("clinic_holidays")
      .select("doctor_id, applies_to_all_doctors")
      .eq("clinic_id", clinicId).eq("holiday_date", date),
  ]);

  return {
    ok: true,
    ctx: {
      candidates,
      durationMinutes,
      dayKey: DAY_KEYS[new Date(`${date}T12:00:00+04:00`).getUTCDay()],
      date,
      appts: (appts ?? []) as Availability["appts"],
      schedules: (schedules ?? []) as Availability["schedules"],
      holidays: (holidays ?? []) as Availability["holidays"],
    },
  };
}

/** Is this doctor free for the whole appointment starting at `startMs`?
    `minuteOfDay` is clinic-local minutes from midnight. */
export function freeAt(
  ctx: Availability, doctorId: string, minuteOfDay: number, startMs: number,
): boolean {
  if (ctx.holidays.some((h) => h.applies_to_all_doctors || h.doctor_id === doctorId)) return false;

  /* No schedule rows at all means "not restricted" rather than "never works" —
     a clinic that has not filled in rotas can still book. */
  const mine = ctx.schedules.filter((s) => s.doctor_id === doctorId);
  if (mine.length > 0) {
    const fits = mine.some((s) =>
      s.day_of_week === ctx.dayKey
      && minuteOfDay >= toMin(s.start_time)
      && minuteOfDay + ctx.durationMinutes <= toMin(s.end_time));
    if (!fits) return false;
  }

  const endMs = startMs + ctx.durationMinutes * 60_000;
  return !ctx.appts.some((a) => {
    if (a.doctor_id !== doctorId) return false;
    const aStart = new Date(a.slot_time).getTime();
    const aEnd = aStart + (a.duration_minutes ?? 30) * 60_000;
    return aStart < endMs && aEnd > startMs;
  });
}

/** The first candidate who can take this exact time, or null. */
export function pickDoctor(
  ctx: Availability, minuteOfDay: number, startMs: number,
): Candidate | null {
  return ctx.candidates.find((c) => freeAt(ctx, c.id, minuteOfDay, startMs)) ?? null;
}

export type Slot = { time: string; doctorId: string; doctorLabel: string };

/** Every bookable start time that day, on a 15-minute grid.

    Fifteen rather than thirty: a 20-minute check-up followed by another at
    09:20 is a real clinic's morning, and a half-hour grid silently loses those
    slots — the schedule looks full when it is not.

    The window comes from the doctors' own rotas, so a clinic working evenings
    gets evening slots instead of a hardcoded 09:00–18:00. Past times are
    dropped: offering a slot that has already gone is worse than showing none. */
export function freeSlots(ctx: Availability, gridMinutes = 15): Slot[] {
  let from = 24 * 60, to = 0;
  for (const s of ctx.schedules) {
    if (s.day_of_week !== ctx.dayKey) continue;
    from = Math.min(from, toMin(s.start_time));
    to = Math.max(to, toMin(s.end_time));
  }
  /* Nobody has a rota for this weekday: fall back to a normal clinic day rather
     than returning nothing, since freeAt() treats "no schedule" as unrestricted
     and would otherwise accept a booking the picker never offered. */
  if (to <= from) { from = 9 * 60; to = 18 * 60; }

  const out: Slot[] = [];
  const now = Date.now();
  for (let m = from; m + ctx.durationMinutes <= to; m += gridMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const startMs = new Date(`${ctx.date}T${hh}:${mm}:00+04:00`).getTime();
    if (startMs <= now) continue;
    const doc = ctx.candidates.find((c) => freeAt(ctx, c.id, m, startMs));
    if (doc) out.push({ time: `${hh}:${mm}`, doctorId: doc.id, doctorLabel: doc.label });
  }
  return out;
}
