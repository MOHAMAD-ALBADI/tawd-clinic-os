import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileForm, type MyProfile } from "@/components/profile/profile-form";

export const metadata = { title: "ملفي الشخصي — طود" };
export const dynamic = "force-dynamic";

/* One route for everybody. A profile is not a role-specific screen — the doctor,
   the receptionist and the manager all edit the same six fields about
   themselves — so mounting it once outside the role folders avoids four copies
   that would drift apart. */
export default async function ProfilePage() {
  const claims = await getUserClaims();
  if (!claims) redirect("/login");

  const sb = await createServerSupabaseClient();
  const { data } = await sb
    .from("tawd_staff_users")
    .select("name, name_ar, email, phone, job_title, specialty, bio, avatar_url, all_roles, role")
    .eq("id", claims.sub)
    .maybeSingle();

  const profile: MyProfile = {
    name: (data?.name as string) ?? "",
    name_ar: (data?.name_ar as string) ?? "",
    /* Fall back to the JWT: a platform admin has no clinic staff row, and this
       page should still work for them rather than showing a blank card. */
    email: (data?.email as string) ?? claims.email,
    phone: (data?.phone as string) ?? "",
    job_title: (data?.job_title as string) ?? "",
    specialty: (data?.specialty as string) ?? "",
    bio: (data?.bio as string) ?? "",
    avatar_url: (data?.avatar_url as string) ?? null,
    all_roles: (data?.all_roles as string[]) ?? claims.all_roles ?? [claims.role],
  };

  return (
    <div className="space-y-5 animate-fade-in pb-20" style={{ maxWidth: 880 }}>
      <div>
        <p className="eyebrow">PROFILE</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">ملفي الشخصي</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          بياناتك وصورتك وكلمة مرورك — ما تعدّله هنا يخصّك وحدك
        </p>
      </div>

      <ProfileForm profile={profile} />
    </div>
  );
}
