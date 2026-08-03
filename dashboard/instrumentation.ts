/* The server's clock belongs to the clinic, not to the datacentre.
 *
 * The dashboard showed "الموعد القادم ٠٥:٠٠ ص" for a clinic that opens
 * at nine. Nothing was wrong with the data: the appointment is stored at
 * 05:00 UTC, which is 09:00 in Muscat, and the server rendered it with
 * its own timezone because the call site never named one.
 *
 * There are 83 date and time formats across 54 files and 17 of them pass
 * Asia/Muscat. Fixing the other 66 by hand is 66 chances to miss one,
 * and the one that is missed is the one a clinic reads as its own hours.
 * Setting it here fixes every call site at once, including the ones
 * nobody has written yet.
 *
 * Client components already render correctly — a browser in Oman knows
 * where it is. This is only about what the server sends.
 *
 * The day TAWD sells outside Oman this becomes a per-clinic setting and
 * every formatter takes the clinic's zone explicitly. Until then, one
 * country, one clock.
 */
export async function register() {
  process.env.TZ = "Asia/Muscat";
}
