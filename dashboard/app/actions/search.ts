"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";

export type SearchResult = {
  kind: "patient" | "service" | "invoice";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const claims = await getUserClaims();
  if (!claims) return [];

  const supabase = await createServerSupabaseClient();
  const like = `%${q}%`;

  const [patients, services, invoices] = await Promise.all([
    supabase.from("patients")
      .select("id,name,phone")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .or(`name.ilike.${like},phone.ilike.${like}`).limit(6),
    supabase.from("services")
      .select("id,name,price")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .ilike("name", like).limit(4),
    supabase.from("invoices")
      .select("id,invoice_number,total,patients(name)")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .ilike("invoice_number", like).limit(4),
  ]);

  const results: SearchResult[] = [];

  for (const p of patients.data ?? []) {
    results.push({ kind: "patient", id: p.id, title: p.name, subtitle: p.phone ?? "مريض", href: `/clinic-admin/patients/${p.id}` });
  }
  for (const s of services.data ?? []) {
    results.push({ kind: "service", id: s.id, title: s.name, subtitle: `${Number(s.price).toLocaleString("en-US", { minimumFractionDigits: 3 })} ر.ع`, href: `/clinic-admin/services` });
  }
  for (const inv of invoices.data ?? []) {
    const patient = (inv as { patients: { name: string } | null }).patients;
    results.push({ kind: "invoice", id: inv.id, title: inv.invoice_number, subtitle: patient?.name ?? "فاتورة", href: `/clinic-admin/invoices` });
  }

  return results;
}
