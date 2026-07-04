import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { SuraWidget } from "@/components/sura-widget/sura-widget";

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
      .select("name")
      .eq("id", claims.sub)
      .single(),
    supabase
      .from("tawd_clinics")
      .select("name")
      .eq("id", claims.clinic_id)
      .single(),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "#0A0D16" }}>
      {/* Dark sidebar — fixed on end (RTL = right) */}
      <AppSidebar
        role={claims.role}
        allRoles={claims.all_roles}
        userName={staffData?.name ?? claims.email.split("@")[0]}
        clinicName={clinicData?.name}
      />

      {/* Main content — offset by sidebar width */}
      <div className="pe-64 min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Sura AI widget — floats on end-bottom */}
      <SuraWidget userRole={claims.role} />
    </div>
  );
}
