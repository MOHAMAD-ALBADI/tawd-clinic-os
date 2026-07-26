import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { getEntitlements } from "@/lib/entitlements";
import { MODULE_BY_KEY, type ModuleKey } from "@/lib/modules";
import { ModuleLocked } from "@/components/shell/module-locked";

/** Gate a route on the clinic's contract.

    Used from a route's layout.tsx rather than inside each page, so the whole
    subtree is covered by one check and a new page added under that folder is
    protected without anyone remembering to protect it.

    Returns the locked screen, or null when the clinic has the module. */
export async function guardModule(key: ModuleKey): Promise<React.ReactElement | null> {
  const claims = await getUserClaims();
  if (!claims) redirect("/login");

  // the operator supports every clinic and is never gated by their contract
  if (claims.role === "platform_admin") return null;

  const e = await getEntitlements(claims.clinic_id);
  if (e.modules.includes(key)) return null;

  const home =
    claims.role === "doctor" ? "/doctor"
    : claims.role === "accountant" ? "/accountant"
    : claims.role === "receptionist" ? "/reception"
    : "/clinic-admin";

  return <ModuleLocked module={MODULE_BY_KEY[key]} homeHref={home} />;
}
