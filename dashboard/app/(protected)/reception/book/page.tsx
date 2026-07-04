import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { QuickBook } from "@/components/reception/quick-book";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "حجز موعد — طود" };

export default async function BookPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const [patientsRes, servicesRes, doctorsRes] = await Promise.all([
    sb.from("patients").select("id, name, phone")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
    sb.from("services").select("id, name_ar").eq("clinic_id", claims.clinic_id).eq("is_active", true).order("name_ar"),
    sb.from("tawd_staff_users").select("id, name, name_ar")
      .eq("clinic_id", claims.clinic_id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null),
  ]);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/reception" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة الاستقبال
      </Link>

      <div>
        <h2 className="text-xl font-bold text-white">حجز موعد</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
          نفس قواعد سُرى: تعارض المواعيد + دوام الطبيب + إجازاته
        </p>
      </div>

      <QuickBook
        patients={(patientsRes.data ?? []) as { id: string; name: string; phone: string | null }[]}
        services={(servicesRes.data ?? []).map((s) => ({ id: s.id, label: s.name_ar as string }))}
        doctors={(doctorsRes.data ?? []).map((d) => ({ id: d.id, label: (d.name_ar ?? d.name) as string }))}
      />
    </div>
  );
}
