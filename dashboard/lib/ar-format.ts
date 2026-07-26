/* Arabic words, Latin digits.

   Intl.DateTimeFormat("ar") renders Arabic-Indic numerals (٢٧ يوليو). The rest
   of this app writes numbers in Latin — every count, price and time input does,
   and `.ltr-nums` exists precisely to keep them upright in an RTL page. Mixing
   the two puts ٢٧ in the leave list and 27 in the date picker directly above it
   on the same screen, which reads as a bug because it is one.

   The `-u-nu-latn` extension keeps Arabic month and weekday names while asking
   for Latin digits, so the whole product counts in one script. */

const MUSCAT = "Asia/Muscat";
const AR = "ar-u-nu-latn";

export const arDate = new Intl.DateTimeFormat(AR, {
  timeZone: MUSCAT, day: "numeric", month: "long", year: "numeric",
});
export const arDateShort = new Intl.DateTimeFormat(AR, {
  timeZone: MUSCAT, day: "numeric", month: "short",
});
export const arDayDate = new Intl.DateTimeFormat(AR, {
  timeZone: MUSCAT, weekday: "long", day: "numeric", month: "long",
});
export const arTime = new Intl.DateTimeFormat(AR, {
  timeZone: MUSCAT, hour: "numeric", minute: "2-digit", hour12: true,
});
export const arDateTime = new Intl.DateTimeFormat(AR, {
  timeZone: MUSCAT, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
});
export const arMonth = new Intl.DateTimeFormat(AR, {
  timeZone: MUSCAT, month: "long", year: "numeric",
});

/** A bare yyyy-mm-dd is a calendar date, not an instant. Parsing it as UTC then
    formatting in Muscat shifts it back a day; noon local avoids that. */
export const fromDateOnly = (d: string) => new Date(`${d}T12:00:00+04:00`);
