"use server";

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";

export type SearchResult = {
  kind: "patient" | "service" | "invoice" | "clinic" | "staff";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/** Role-scoped search — each dashboard searches ONLY its own world. */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const claims = await getUserClaims();
  if (!claims) return [];
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  /* ── PLATFORM OWNER: searches clinics only (never patient data) ── */
  if (hasRole(claims, "platform_admin")) {
    const svc = await createServiceRoleClient();
    const { data: clinics } = await svc
      .from("tawd_clinics")
      .select("id, name, name_ar, clinic_type, phone")
      .or(`name.ilike.${like},name_ar.ilike.${like},phone.ilike.${like}`)
      .limit(10);
    for (const c of clinics ?? []) {
      results.push({
        kind: "clinic",
        id: c.id,
        title: (c.name_ar ?? c.name) as string,
        subtitle: (c.phone as string | null) ?? "عيادة",
        href: `/platform-admin/clinics/${c.id}`,
      });
    }
    return results;
  }

  /* ── CLINIC ROLES: scoped to the account's clinic + its capabilities ── */
  const sb = await createServerSupabaseClient(); // RLS enforces clinic_id too
  const cid = claims.clinic_id;
  const isDoctor = claims.role === "doctor";
  const canMoney = claims.role === "clinic_admin" || hasRole(claims, "accountant");
  const patientBase = claims.role === "clinic_admin" ? "/clinic-admin/patients"
    : isDoctor ? "/doctor/patients"
    : "/reception"; // reception has no patient detail page → land on board

  /* doctors: only patients they have appointments with */
  let doctorPatientIds: string[] | null = null;
  if (isDoctor) {
    const { data: appts } = await sb
      .from("appointments").select("patient_id")
      .eq("doctor_id", claims.sub).is("deleted_at", null).limit(2000);
    doctorPatientIds = [...new Set((appts ?? []).map((a) => a.patient_id))];
    if (doctorPatientIds.length === 0) return results;
  }

  const [patientsRes, servicesRes, invoicesRes] = await Promise.all([
    (async () => {
      let pq = sb.from("patients").select("id, name, phone")
        .eq("clinic_id", cid).is("deleted_at", null)
        .or(`name.ilike.${like},phone.ilike.${like}`).limit(6);
      if (doctorPatientIds) pq = pq.in("id", doctorPatientIds);
      return pq;
    })(),
    isDoctor
      ? Promise.resolve({ data: [] as { id: string; name: string; price: number }[] })
      : sb.from("services").select("id, name, price")
          .eq("clinic_id", cid).is("deleted_at", null).ilike("name", like).limit(4),
    canMoney
      ? sb.from("invoices").select("id, invoice_number, patients(name)")
          .eq("clinic_id", cid).is("deleted_at", null).ilike("invoice_number", like).limit(4)
      : Promise.resolve({ data: [] as { id: string; invoice_number: string; patients: { name: string } | null }[] }),
  ]);

  for (const p of patientsRes.data ?? []) {
    results.push({ kind: "patient", id: p.id, title: p.name, subtitle: p.phone ?? "مريض", href: `${patientBase}/${p.id}` });
  }
  for (const s of (servicesRes.data ?? []) as { id: string; name: string; price: number }[]) {
    results.push({ kind: "service", id: s.id, title: s.name, subtitle: `${Number(s.price).toLocaleString("en-US", { minimumFractionDigits: 3 })} ر.ع`, href: "/clinic-admin/services" });
  }
  const invHref = claims.role === "clinic_admin" ? "/clinic-admin/invoices" : "/accountant/invoices";
  for (const inv of (invoicesRes.data ?? []) as { id: string; invoice_number: string; patients: { name: string } | null }[]) {
    results.push({ kind: "invoice", id: inv.id, title: inv.invoice_number, subtitle: inv.patients?.name ?? "فاتورة", href: invHref });
  }

  return results;
}
