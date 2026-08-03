import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { NavProvider } from "@/components/shell/nav-state";
import { TopBar } from "@/components/shell/top-bar";
import { SuraWidget } from "@/components/sura-widget/sura-widget";
import { getEntitlements } from "@/lib/entitlements";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const claims = await getUserClaims();
  if (!claims) redirect("/login");

  const supabase = await createServerSupabaseClient();

  const [{ data: staffData }, { data: clinicData }] = await Promise.all([
    supabase
      .from("tawd_staff_users")
      .select("name, name_ar, avatar_url")
      .eq("id", claims.sub)
      .maybeSingle(),
    supabase
      .from("tawd_clinics")
      .select("name")
      .eq("id", claims.clinic_id)
      .single(),
  ]);

  /* The operator supports every clinic and is not bound by any one contract, so
     their menu is never filtered. */
  const entitlements = claims.role === "platform_admin"
    ? null
    : await getEntitlements(claims.clinic_id);

  return (
    /* No background here. This used to hardcode #0A0D16 — a blue-black left
       over from an older theme — which sat under every page fighting the warm
       stone canvas that body already paints. */
    <NavProvider>
    <div className="min-h-screen">
      {/* Dark sidebar — furniture from lg up, a drawer below it */}
      <AppSidebar
        role={claims.role}
        allRoles={claims.all_roles}
        userName={staffData?.name_ar || staffData?.name || claims.email.split("@")[0]}
        clinicName={clinicData?.name}
        avatarUrl={staffData?.avatar_url ?? null}
        modules={entitlements?.modules}
      />

      {/* Main content — offset by the sidebar only where the sidebar is
          actually there. On a phone the drawer floats over this instead. */}
      <div className="lg:pe-64 min-h-screen flex flex-col">
        <TopBar
          searchPlaceholder={
            claims.role === "platform_admin" ? "ابحث عن عيادة..."
            : claims.role === "doctor" ? "ابحث عن مريض..."
            : "ابحث عن مريض، خدمة، فاتورة..."
          }
        />
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Sura AI widget — floats on end-bottom */}
      <SuraWidget userRole={claims.role} />
    </div>
    </NavProvider>
  );
}
