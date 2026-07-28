import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { paymentsByInvoice } from "@/lib/receivables";
import { PatientAccounts, type PatientAccount } from "@/components/accountant/patient-accounts";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "حسابات المرضى — طود" };
export const dynamic = "force-dynamic";

const CAP = 1500;

/* Debt by person, not by document.

   Chasing money lived on the invoice, which is the wrong unit: a patient with
   four part-paid invoices appeared four times and nothing anywhere said what that
   one person owes in total — which is the number you say out loud when you call
   them. */
export default async function PatientAccountsPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();

  /* Every invoice that still represents a charge. Cancelled ones never were one;
     refunded and written-off ones are settled, one way or another, and their
     net_total already carries what was written off. */
  const { data: invoices, count } = await sb
    .from("invoices")
    .select("id, patient_id, total, net_total, status, created_at, patients!patient_id(name, phone)",
            { count: "exact" })
    .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
    .neq("status", "cancelled").neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(CAP);

  const rows = invoices ?? [];
  const paid = await paymentsByInvoice(sb, claims.clinic_id, rows.map((r) => r.id as string));

  const byPatient = new Map<string, PatientAccount>();
  const now = Date.now();

  for (const inv of rows) {
    const pid = inv.patient_id as string | null;
    if (!pid) continue;
    const p = inv.patients as unknown as { name?: string; phone?: string | null } | null;

    const acc = byPatient.get(pid) ?? {
      id: pid,
      name: p?.name ?? "—",
      phone: p?.phone ?? null,
      billed: 0, collected: 0, owed: 0,
      oldestDays: null,
      invoiceCount: 0,
    };

    const collectable = Number(inv.net_total ?? inv.total ?? 0);
    const received = paid.get(inv.id as string) ?? 0;
    /* Never negative per invoice: an overpayment on one bill is not a credit
       against another one, and letting it net off would hide a real debt. */
    const rest = Math.max(0, collectable - received);

    acc.billed += Number(inv.total ?? 0);
    acc.collected += received;
    acc.owed += rest;
    acc.invoiceCount += 1;

    if (rest > 0.0005) {
      const age = Math.floor((now - new Date(inv.created_at as string).getTime()) / 86_400_000);
      acc.oldestDays = acc.oldestDays == null ? age : Math.max(acc.oldestDays, age);
    }

    byPatient.set(pid, acc);
  }

  const accounts = [...byPatient.values()].map((a) => ({
    ...a,
    billed: Math.round(a.billed * 1000) / 1000,
    collected: Math.round(a.collected * 1000) / 1000,
    owed: Math.round(a.owed * 1000) / 1000,
  }));

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs"
        style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <p className="eyebrow">PATIENT ACCOUNTS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">حسابات المرضى</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ماذا على كل مريض إجمالاً — واضغط على أي اسم لكشف حسابه الكامل
        </p>
      </div>

      <PatientAccounts accounts={accounts} capped={(count ?? 0) > CAP} />
    </div>
  );
}
