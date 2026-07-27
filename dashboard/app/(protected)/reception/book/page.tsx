import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { QuickBook } from "@/components/reception/quick-book";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "حجز موعد — طود" };

export default async function BookPage({
  searchParams,
}: { searchParams: Promise<{ patient?: string; doctor?: string; date?: string; time?: string }> }) {
  const sp = await searchParams;
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
        <h1 className="text-2xl font-black text-white tracking-tight leading-none">حجز موعد</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          نفس قواعد سُرى: تعارض المواعيد + دوام الطبيب + إجازاته
        </p>
      </div>

      {/* Arrived from a calendar gap or a follow-up row — carry the choice in
          rather than making the desk retype what it just clicked. */}
      <QuickBook
        patients={(patientsRes.data ?? []) as { id: string; name: string; phone: string | null }[]}
        services={(servicesRes.data ?? []).map((s) => ({ id: s.id, label: s.name_ar as string }))}
        doctors={(doctorsRes.data ?? []).map((d) => ({ id: d.id, label: (d.name_ar ?? d.name) as string }))}
        prefill={{ patientId: sp.patient, doctorId: sp.doctor, date: sp.date, time: sp.time }}
      />
    </div>
  );
}
