import "server-only";

/* Turning the double-booking constraint into something a human can act on.

   appointments now carries an exclusion constraint, so when two people book the
   same doctor at the same moment the database refuses the second one. That is
   the point — but the loser gets Postgres error 23P01, and "تعذّر إنشاء الحجز"
   would tell a receptionist nothing about what happened or what to do.

   The race is genuinely rare and genuinely real: reception, the public booking
   page and Sura all book, and all three check availability before inserting. The
   message has to say the slot went, not that something broke, because those lead
   to different next actions — pick another time versus call support. */

/** Postgres exclusion_violation. */
const EXCLUSION = "23P01";

export function isSlotTaken(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === EXCLUSION
    || (error.message ?? "").includes("appointments_no_double_booking");
}

export const SLOT_TAKEN_AR =
  "حُجز هذا الوقت للطبيب قبل لحظات من جهة أخرى — اختر وقتاً آخر";
