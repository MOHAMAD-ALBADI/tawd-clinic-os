/* Clinic-local dates.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date, and Oman is UTC+4.
 * Between 00:00 and 04:00 Muscat the two disagree, so anything that buckets
 * records "by day" using the UTC date puts late-night activity in the wrong
 * bucket.
 *
 * For a list of appointments that is a cosmetic annoyance. For the cashier's
 * day-close it is not: that reconciles physical notes in a drawer, and cash
 * taken at 00:30 falling into neither day shows up as a shortage that the
 * person holding the drawer has to explain.
 *
 * Oman does not observe daylight saving, so the offset is a constant +4.
 */

export const CLINIC_TZ = "Asia/Muscat";
const OFFSET_MS = 4 * 60 * 60 * 1000;

/** Today's date in the clinic's timezone, as YYYY-MM-DD. */
export function clinicToday(now: Date = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instants bounding one clinic-local day: [start, end).
 *
 *  Muscat day D spans (D-1) 20:00Z … D 20:00Z. Returned as ISO strings so they
 *  can be handed straight to PostgREST's gte/lt filters on a timestamptz. */
export function clinicDayRange(date: string): { startUtc: string; endUtc: string } {
  const startUtc = new Date(`${date}T00:00:00.000Z`).getTime() - OFFSET_MS;
  return {
    startUtc: new Date(startUtc).toISOString(),
    endUtc: new Date(startUtc + 86_400_000).toISOString(),
  };
}
