import "server-only";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";

/* Who opened whose medical file.

   patient_access_logs has existed since the schema was written and nothing ever
   wrote to it — zero rows. For a product holding medical records in Oman that is
   the wrong table to leave empty: under the PDPL a clinic has to be able to say
   who looked at a patient's data, and "we have no idea" is not an answer a
   regulator or a patient accepts. It is also the only way to answer the question
   a clinic eventually asks, which is why a staff member was reading the file of
   someone who is not their patient.

   Written with the service role on purpose. An access log the reader can shape
   is not an access log — under RLS the caller's own policies would decide what
   gets recorded about them, and a clinic that revoked its own insert right would
   silently stop being audited.

   Fire-and-forget: opening a patient file must never fail because the audit
   write did. A missing log line is a gap in the record; a page that will not
   load is a patient not being treated. */

/* The vocabulary the table already enforces with a CHECK constraint. Inventing
   "view" and "clinical_view" looked reasonable and was rejected on insert — and
   because this helper swallows its own errors, every single write would have
   failed in silence and the log would have stayed empty while looking wired up. */
export type AccessType =
  | "view_profile"
  | "view_medical_history"
  | "view_prescriptions"
  | "view_invoices"
  | "view_notes"
  | "export";

export async function logPatientAccess(input: {
  patientId: string;
  clinicId: string;
  userId: string;
  accessType: AccessType;
}): Promise<void> {
  try {
    const h = await headers();
    /* x-forwarded-for is a list; the client is the first entry. Anything that is
       not a plain address is dropped rather than stored — the column is inet and
       a bad value would throw, which the catch would swallow, quietly losing the
       whole row instead of just the address. */
    const raw = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ip = /^[0-9a-fA-F:.]+$/.test(raw) && raw.length > 0 ? raw : null;

    const sb = await createServiceRoleClient();
    await sb.from("patient_access_logs").insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      accessed_by: input.userId,
      access_type: input.accessType,
      ip_address: ip,
      user_agent: (h.get("user-agent") ?? "").slice(0, 500) || null,
    });
  } catch {
    /* Never surface. See above. */
  }
}
