import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserClaims, Role } from "@/types/tawd";

export async function getUserClaims(): Promise<UserClaims | null> {
  const supabase = await createServerSupabaseClient();
  // getClaims() verifies the JWT locally (no network round-trip to the auth
  // server, unlike getUser()) — this runs on every page and server action.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const meta = (claims.app_metadata ?? {}) as Record<string, unknown>;
  const role = (meta.role ?? "clinic_admin") as Role;
  return {
    sub: claims.sub as string,
    email: (claims.email ?? "") as string,
    role,
    clinic_id: (meta.clinic_id ?? "") as string,
    all_roles: (meta.all_roles ?? [role]) as Role[],
    is_multi_role: (meta.is_multi_role ?? false) as boolean,
  };
}
