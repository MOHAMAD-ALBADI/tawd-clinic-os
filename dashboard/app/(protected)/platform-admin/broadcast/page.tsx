import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { PlatformBroadcast } from "@/components/platform/manage-widgets";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "حملات المنصة — طود" };
export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: clinics }, { data: subs }] = await Promise.all([
    sb.from("tawd_clinics").select("id, name, name_ar, phone"),
    sb.from("tawd_subscriptions").select("clinic_id, status, trial_ends_at, current_period_end"),
  ]);

  const now = Date.now();
  const groupOf = (clinicId: string): "expiring" | "overdue" | "ok" => {
    const s = (subs ?? []).find((x) => x.clinic_id === clinicId);
    if (!s) return "ok";
    const end = s.status === "trial" ? s.trial_ends_at : s.current_period_end;
    if (!end) return "ok";
    const days = (new Date(end).getTime() - now) / 86_400_000;
    if (days < 0) return "overdue";
    if (days <= 7) return "expiring";
    return "ok";
  };

  const list = (clinics ?? []).map((c) => ({
    id: c.id,
    label: (c.name_ar ?? c.name) as string,
    phone: !!c.phone,
    group: groupOf(c.id),
  }));

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لمركز القيادة
      </Link>

      <div>
        <h2 className="text-xl font-bold text-white">حملات المنصة</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
          رسائل واتساب لأصحاب العيادات — تذكير تجديد، إعلانات ميزات، عروض
        </p>
      </div>

      <PlatformBroadcast clinics={list} />
    </div>
  );
}
