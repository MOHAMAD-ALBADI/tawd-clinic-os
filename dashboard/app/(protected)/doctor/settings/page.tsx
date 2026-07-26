import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MyServices, type ClinicService } from "@/components/doctor/my-services";
import { UserCircle, CalendarClock, ChevronLeft } from "lucide-react";

export const metadata = { title: "إعداداتي — طود" };
export const dynamic = "force-dynamic";

/* This route used to be a second profile page — it edited two of the six fields
   the shared profile edits and changed a password without asking for the
   current one, so it was collapsed into a redirect to /profile.

   It comes back as something different: settings, not a profile. The only
   entries here are ones something downstream actually reads. A page of switches
   that change nothing is worse than no page, and this codebase has spent a week
   removing exactly that. Editing yourself still lives at /profile, linked below,
   and there is still only one of it. */
export default async function DoctorSettingsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const sb = await createServerSupabaseClient();
  const [{ data: services }, { data: maps }] = await Promise.all([
    sb.from("services").select("id, name_ar, name, price, duration_minutes")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).order("name_ar"),
    sb.from("doctor_services").select("doctor_id, service_id, is_active")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true),
  ]);

  const claimedByAnyone = new Set((maps ?? []).map((m) => m.service_id as string));
  const mine = (maps ?? []).filter((m) => m.doctor_id === claims.sub).map((m) => m.service_id as string);

  const list: ClinicService[] = (services ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name_ar as string) ?? (s.name as string) ?? "خدمة",
    price: Number(s.price ?? 0),
    durationMinutes: (s.duration_minutes as number | null) ?? null,
    mappedByAnyone: claimedByAnyone.has(s.id as string),
  }));

  return (
    <div className="space-y-5 animate-fade-in pb-20" style={{ maxWidth: 880 }}>
      <div>
        <p className="eyebrow">SETTINGS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">إعداداتي</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ما يغيّر تعامل النظام معك — خدماتك ودوامك وبياناتك
        </p>
      </div>

      <MyServices services={list} mine={mine} />

      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/doctor/schedule" className="panel panel-hover flex items-center gap-3" style={{ padding: "1.1rem 1.2rem" }}>
          <CalendarClock className="w-5 h-5 shrink-0" style={{ color: "var(--accent-1)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white">دوامي وإجازاتي</p>
            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>الساعات التي تُحجز لك خلالها</p>
          </div>
          <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
        </Link>

        <Link href="/profile" className="panel panel-hover flex items-center gap-3" style={{ padding: "1.1rem 1.2rem" }}>
          <UserCircle className="w-5 h-5 shrink-0" style={{ color: "var(--accent-1)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white">ملفي الشخصي</p>
            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>الاسم والصورة والتخصص وكلمة المرور</p>
          </div>
          <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
        </Link>
      </div>
    </div>
  );
}
