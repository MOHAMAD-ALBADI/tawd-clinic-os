import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { NewClinicForm } from "@/components/platform/new-clinic-form";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "إضافة عيادة — طود" };
export const dynamic = "force-dynamic";

export default async function NewClinicPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  /* The price list drives the form: adding a plan in settings makes it sellable
     here immediately, with no second place to keep in step. */
  const sb = await createServiceRoleClient();
  const { data: plans } = await sb
    .from("platform_plans").select("code, name_ar, price_omr")
    .eq("is_active", true).order("sort_order");

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لنظرة المنصة
      </Link>

      <div>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none">إضافة عيادة جديدة</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          عيادة كاملة التجهيز بضغطة — إعدادات، خدمات التخصص، ولاء ذكي، وحساب المدير
        </p>
      </div>

      <NewClinicForm plans={(plans ?? []).map((p) => ({
        code: p.code as string,
        name_ar: p.name_ar as string,
        price_omr: Number(p.price_omr ?? 0),
      }))} />
    </div>
  );
}
