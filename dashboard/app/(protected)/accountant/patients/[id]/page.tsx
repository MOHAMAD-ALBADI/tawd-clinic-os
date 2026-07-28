import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildStatement } from "@/lib/patient-statement";
import { StatementView } from "@/components/accountant/statement-view";
import { ArrowRight } from "lucide-react";
import { SendEmailButton } from "@/components/email/send-email-button";
import { emailStatus } from "@/lib/email";

export const metadata = { title: "كشف حساب — طود" };
export const dynamic = "force-dynamic";

/* One patient's money on one page.

   "I already paid that" had no answer in the product: what was billed lived in
   the ledger, what came in lived in the register, and what was written off lived
   in the adjustments, so settling an argument meant three screens and trust. */
export default async function PatientStatementPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const [{ data: patient }, { data: clinic }] = await Promise.all([
    sb.from("patients").select("id, name, phone, email")
      .eq("id", id).eq("clinic_id", claims.clinic_id).is("deleted_at", null).maybeSingle(),
    sb.from("tawd_clinics").select("name, name_ar").eq("id", claims.clinic_id).maybeSingle(),
  ]);
  if (!patient) notFound();

  const st = await buildStatement(sb, claims.clinic_id, id);
  const email = await emailStatus(claims.clinic_id);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div className="no-print">
        <Link href="/accountant/patients" className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-3)" }}>
          <ArrowRight className="w-3.5 h-3.5" /> رجوع لحسابات المرضى
        </Link>
        <div className="mt-3">
          <SendEmailButton kind="statement" id={id}
            patientEmail={(patient.email as string | null) ?? null}
            enabled={email.configured && email.enabled} />
        </div>
      </div>

      <StatementView
        rows={st.lines.map((l) => ({
          id: l.id, at: l.at, kind: l.kind, label: l.label, detail: l.detail,
          delta: l.delta, balance: l.balance,
          invoiceNumber: l.invoiceNumber, invoiceId: l.invoiceId,
        }))}
        patientName={(patient.name as string) ?? "—"}
        patientPhone={(patient.phone as string | null) ?? null}
        totals={{
          billed: st.billed, collected: st.collected,
          credited: st.credited, refunded: st.refunded, balance: st.balance,
        }}
        clinicName={(clinic?.name_ar ?? clinic?.name ?? "طَود") as string}
      />
    </div>
  );
}
