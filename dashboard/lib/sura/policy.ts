import type { SupabaseClient } from "@supabase/supabase-js";
import { CLINIC_TZ } from "@/lib/clinic-time";

/* The guardrails.
 *
 * These are code, not prompt. The distinction matters more here than
 * anywhere else in the system: a model can be argued out of an
 * instruction, and an agent that sends messages on its own initiative
 * gets exactly one chance to behave. A patient woken at 01:00, or
 * messaged three times in a morning by three different goals, is a
 * complaint to the clinic and a story the clinic tells other clinics.
 *
 * Every limit below is checked after the model has decided and before
 * anything leaves the building. The model never sees these numbers and
 * cannot negotiate them.
 */

export const LIMITS = {
  /** Outside these hours the agent stays silent, whatever it decided. */
  QUIET_FROM: 21, // 21:00 clinic time
  QUIET_TO: 8, //  08:00 clinic time

  /** One unprompted message per patient per day, across every goal kind. */
  MAX_MSGS_PER_PATIENT_PER_DAY: 1,

  /** Two attempts, then the goal closes with a reason. No agent nags. */
  MAX_ATTEMPTS_PER_GOAL: 2,

  /** Ceiling on model spend per tick, highest-value goals first. */
  MAX_DECISIONS_PER_TICK: 6,

  /** A goal worth less than this is not worth a patient's attention. */
  MIN_VALUE_OMR: 5,
} as const;

export type Block = { blocked: true; why: string } | { blocked: false };

const OK: Block = { blocked: false };

/** The hour, 0–23, in the clinic's own timezone rather than the server's. */
export function clinicHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: CLINIC_TZ,
    }).format(now),
  );
}

/** Minutes until the quiet period ends, so a blocked goal sleeps exactly that long. */
export function minutesUntilOpen(now: Date = new Date()): number {
  const h = clinicHour(now);
  const hoursToWait = h >= LIMITS.QUIET_FROM ? 24 - h + LIMITS.QUIET_TO : LIMITS.QUIET_TO - h;
  return Math.max(15, hoursToWait * 60);
}

export function isQuietHours(now: Date = new Date()): boolean {
  const h = clinicHour(now);
  return h >= LIMITS.QUIET_FROM || h < LIMITS.QUIET_TO;
}

/* Has this patient already heard from the agent today?
 *
 * Counted across every goal, not per goal. The patient does not know or
 * care that the waitlist and the treatment-plan chase are different
 * subsystems; to them it is one clinic messaging twice. */
export async function contactedToday(
  svc: SupabaseClient,
  patientId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await svc
    .from("sura_actions")
    .select("id, sura_goals!inner(patient_id)")
    .eq("chose", "message_patient")
    .eq("ok", true)
    .gte("at", since)
    .eq("sura_goals.patient_id", patientId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/* The last gate before a message leaves.
 *
 * Ordered cheapest-first: the clock costs nothing to check, the database
 * round-trip is last. */
export async function gateOutbound(
  svc: SupabaseClient,
  patientId: string,
  now: Date = new Date(),
): Promise<Block> {
  if (isQuietHours(now)) {
    return { blocked: true, why: `خارج ساعات المراسلة (${LIMITS.QUIET_TO}:00–${LIMITS.QUIET_FROM}:00)` };
  }
  if (await contactedToday(svc, patientId)) {
    return { blocked: true, why: "المريض استلم رسالة من سُرى خلال ٢٤ ساعة" };
  }
  return OK;
}

/* Is this clinic's agent switched on?
 *
 * A suspended or trial-expired clinic must not have software messaging
 * its patients on its behalf. The check reads the same status the rest
 * of the platform bills against, so there is one answer to "is this
 * clinic live", not two. */
export async function agentEnabled(
  svc: SupabaseClient,
  clinicId: string,
): Promise<Block> {
  const { data } = await svc
    .from("tawd_clinics")
    .select("status")
    .eq("id", clinicId)
    .maybeSingle();

  if (!data) return { blocked: true, why: "العيادة غير موجودة" };
  if (data.status !== "active" && data.status !== "trial") {
    return { blocked: true, why: `اشتراك العيادة ${data.status}` };
  }
  return OK;
}

/* A number Meta will accept.
 *
 * The sender stripped everything but digits, which is right for
 * "+968 7663 0020" and wrong for "76630020" — an Omani local number
 * reached the API without its country code and was rejected every time,
 * for a patient who looked perfectly reachable in the clinic's records.
 *
 * New patients are normalised on the way in, so only one row carries
 * the old shape today. A CSV import brings hundreds, and the fix
 * belongs at the point of sending rather than at every point of entry.
 */
export function e164(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 8) return `968${digits}`;          // local Omani
  if (digits.startsWith("00")) return digits.slice(2);      // 00968…
  return digits;
}
