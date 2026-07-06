import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { NewClinicForm } from "@/components/platform/new-clinic-form";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "إضافة عيادة — طود" };

export default async function NewClinicPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لنظرة المنصة
      </Link>

      <div>
        <h2 className="text-xl font-bold text-white">إضافة عيادة جديدة</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
          عيادة كاملة التجهيز بضغطة — إعدادات، خدمات التخصص، ولاء ذكي، وحساب المدير
        </p>
      </div>

      <NewClinicForm />
    </div>
  );
}
