// Seed 2 more dentists (auth user + staff record) and populate doctor_services so the demo clinic
// has a realistic multi-doctor roster. حشوة/كشف are offered by all 3 so auto-assign is meaningful.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;
const CLINIC = "be9e4157-f56d-49e4-96bd-8b2d5b8af568";
const MOHAMMED = "e3e7fd39-158f-48a3-8ae4-ba56fa3a27f1";
const S = { kashf:"a1000000-0000-0000-0000-000000000001", tanzif:"a1000000-0000-0000-0000-000000000002",
  khal:"a1000000-0000-0000-0000-000000000005", hashwa:"a1000000-0000-0000-0000-000000000004",
  taqwim:"19bff814-d650-425e-9100-b71ae5b36da5", asab:"a1000000-0000-0000-0000-000000000003",
  tabyid:"a1000000-0000-0000-0000-000000000006", taj:"cf88ae96-9589-4711-bbfb-6fde2214f936" };

const sb = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } });

async function ensureDoctor(email, name, name_ar) {
  let id;
  const c = await sb.auth.admin.createUser({ email, password: "Tawd@Doctor2026", email_confirm: true,
    app_metadata: { role: "doctor", clinic_id: CLINIC, all_roles: ["doctor"] }, user_metadata: { name: name_ar } });
  if (c.error) {
    if (/already|exists|registered/i.test(c.error.message)) {
      const list = await sb.auth.admin.listUsers(); id = list.data.users.find(u => u.email === email)?.id;
    } else throw new Error(c.error.message);
  } else id = c.data.user.id;
  const st = await sb.from("tawd_staff_users").upsert({ id, clinic_id: CLINIC, name, name_ar, email, role: "doctor", commission_rate: 0, is_active: true }, { onConflict: "id" });
  if (st.error) throw new Error("staff " + email + ": " + st.error.message);
  return id;
}

(async () => {
  const sara = await ensureDoctor("dr.sara@tawd.om", "Dr. Sara Al-Balushi", "د. سارة البلوشي");
  const khalid = await ensureDoctor("dr.khalid@tawd.om", "Dr. Khalid Al-Harthy", "د. خالد الحارثي");
  console.log("Sara:", sara, "| Khalid:", khalid);

  const map = {
    [MOHAMMED]: [S.kashf, S.tanzif, S.hashwa, S.asab, S.tabyid, S.khal], // general
    [sara]:     [S.kashf, S.tanzif, S.hashwa, S.taqwim, S.tabyid],        // ortho + general
    [khalid]:   [S.kashf, S.hashwa, S.khal, S.asab, S.taj],               // surgery + general
  };

  await sb.from("doctor_services").delete().eq("clinic_id", CLINIC); // reset for idempotency
  const rows = [];
  for (const [doc, svcs] of Object.entries(map)) for (const s of svcs) rows.push({ clinic_id: CLINIC, doctor_id: doc, service_id: s, is_active: true });
  const ins = await sb.from("doctor_services").insert(rows).select("id");
  if (ins.error) throw new Error("doctor_services: " + ins.error.message);
  console.log("doctor_services rows inserted:", ins.data.length);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
