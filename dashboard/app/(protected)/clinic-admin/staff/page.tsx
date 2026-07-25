import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StaffManager, type StaffRow } from "@/components/staff/staff-manager";

export const metadata = { title: "الكادر الطبي — طود" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const { data } = await sb
    .from("tawd_staff_users")
    .select("id,name,name_ar,email,phone,role,all_roles,is_active,commission_rate,specialty")
    .eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null)
    // active first, then alphabetical — a disabled account is an exception, not a peer
    .order("is_active", { ascending: false })
    .order("name")
    .limit(200);

  const staff: StaffRow[] = (data ?? []).map((s) => ({
    id: s.id,
    name: (s.name as string) ?? "",
    name_ar: (s.name_ar as string) ?? "",
    email: (s.email as string) ?? "",
    phone: (s.phone as string) ?? "",
    role: s.role as string,
    all_roles: (s.all_roles as string[]) ?? [s.role as string],
    is_active: !!s.is_active,
    commission_rate: Number(s.commission_rate ?? 0) || 0,
    specialty: (s.specialty as string) ?? "",
  }));

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">TEAM</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">الكادر الطبي</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          حسابات الفريق وأدوارهم وصلاحية دخولهم — تعطيل الحساب يمنع الدخول فوراً
        </p>
      </div>

      <StaffManager staff={staff} selfId={claims.sub} />
    </div>
  );
}
