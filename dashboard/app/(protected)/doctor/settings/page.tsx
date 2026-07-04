import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DoctorSettingsForm } from "@/components/doctor/doctor-settings-form";

export const metadata = { title: "إعداداتي — طود" };

export default async function DoctorSettingsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data: me } = await supabase
    .from("tawd_staff_users")
    .select("name, name_ar, email")
    .eq("id", claims.sub)
    .single();

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <h2 className="text-xl font-bold text-white">إعداداتي</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
          بياناتك الشخصية وأمان حسابك
        </p>
      </div>

      <DoctorSettingsForm
        nameAr={me?.name_ar ?? ""}
        nameEn={me?.name ?? ""}
        email={me?.email ?? claims.email}
      />
    </div>
  );
}
