import "server-only";
import { getUserClaims } from "@/lib/auth/get-user-claims";

/* A guard for cross-module helpers that live in "use server" files.

   Any exported async function in a "use server" module is a network endpoint.
   Next.js gives it an action id and will invoke it for anyone who can post to
   the app — being "internal", or only ever imported by another action, changes
   nothing about that.

   Three such helpers took clinicId as an argument and wrote money rows:
   logExpense, logCommissionForInvoice and logClaimForInvoice. RLS stopped a
   stranger and stopped a clinic writing into another clinic's data, so nothing
   leaked across tenants. What it could not stop was a receptionist in the SAME
   clinic calling them directly — RLS is satisfied, the clinic matches — and
   fabricating an expense, a doctor's commission, or an insurance claim. A role
   with no access to the ledger could write to it.

   assertOwnClinic closes that: the caller must be signed in, must be a role
   that is allowed to move money, and the clinicId they passed must be their
   own rather than one they chose. Called from the real call sites, where a
   session already exists, it is a no-op. */
const LEDGER_ROLES = new Set(["clinic_admin", "accountant"]);

export async function assertOwnClinic(clinicId: string): Promise<void> {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");

  /* Platform support may act across clinics; that path is already gated by the
     clinic's own approval and is logged. */
  const roles = new Set([claims.role, ...(claims.all_roles ?? [])]);
  if (roles.has("platform_admin")) return;

  if (!clinicId || clinicId !== claims.clinic_id) {
    throw new Error("غير مصرح — عيادة أخرى");
  }
  if (![...roles].some((r) => LEDGER_ROLES.has(r))) {
    throw new Error("هذا الدور لا يملك صلاحية الكتابة في السجل المالي");
  }
}
