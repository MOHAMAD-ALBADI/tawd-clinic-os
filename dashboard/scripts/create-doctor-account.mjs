// Create a dedicated DOCTOR login (separate from the founder's clinic_admin account),
// give it a staff record, and reassign the demo doctor data to it.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SB_URL;
const SRK = process.env.SB_SRK;
const CLINIC = "be9e4157-f56d-49e4-96bd-8b2d5b8af568";
const OLD_DOCTOR = "e63290e7-36a4-4fdc-be06-a4ebe8de3ada"; // = founder's admin account (must move data off it)
const EMAIL = "dr.mohammed@tawd.om";
const PASSWORD = "Tawd@Doctor2026";

const sb = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) create (or fetch) the auth user
  let userId;
  const created = await sb.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: "doctor", clinic_id: CLINIC, all_roles: ["doctor"] },
    user_metadata: { name: "د. محمد البادي" },
  });
  if (created.error) {
    if (/already|exists|registered/i.test(created.error.message)) {
      const list = await sb.auth.admin.listUsers();
      userId = list.data.users.find((u) => u.email === EMAIL)?.id;
      await sb.auth.admin.updateUserById(userId, {
        password: PASSWORD, email_confirm: true,
        app_metadata: { role: "doctor", clinic_id: CLINIC, all_roles: ["doctor"] },
      });
      console.log("user existed -> updated:", userId);
    } else throw new Error(created.error.message);
  } else {
    userId = created.data.user.id;
    console.log("created doctor user:", userId);
  }

  // 2) staff record for the new doctor
  const staff = await sb.from("tawd_staff_users").upsert(
    { id: userId, clinic_id: CLINIC, name: "د. محمد البادي", email: EMAIL, role: "doctor", is_active: true },
    { onConflict: "id" }
  );
  if (staff.error) throw new Error("staff: " + staff.error.message);

  // 3) move demo data from the old (founder) id to the new doctor id
  const appts = await sb.from("appointments").update({ doctor_id: userId }).eq("doctor_id", OLD_DOCTOR).eq("clinic_id", CLINIC).select("id");
  if (appts.error) throw new Error("appts: " + appts.error.message);
  console.log("appointments reassigned:", appts.data?.length ?? 0);

  // commissions (best-effort)
  await sb.from("doctor_commissions").update({ doctor_id: userId }).eq("doctor_id", OLD_DOCTOR);

  // 4) founder's staff record -> admin (no longer the doctor)
  await sb.from("tawd_staff_users").update({ role: "admin", name: "محمد البادي (مدير)" }).eq("id", OLD_DOCTOR);

  console.log("\n=== DOCTOR LOGIN ===\nEMAIL:", EMAIL, "\nPASSWORD:", PASSWORD, "\nnew doctor_id:", userId);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
