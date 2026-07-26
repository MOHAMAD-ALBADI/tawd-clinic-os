import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { BroadcastStudio, type PastBroadcast } from "@/components/platform/broadcast-studio";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "حملات المنصة — طود" };
export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: history }, { data: plans }, { data: me }] = await Promise.all([
    sb.from("platform_broadcasts")
      .select("id, title, body, audience_label, total, sent_count, failed_count, created_at")
      .order("created_at", { ascending: false }).limit(30),
    sb.from("platform_plans").select("code").eq("is_active", true).order("price_omr"),
    sb.from("tawd_staff_users").select("phone").eq("id", claims.sub).maybeSingle(),
  ]);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لمركز القيادة
      </Link>

      <div>
        <p className="eyebrow">BROADCAST</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">حملات المنصة</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          رسائل واتساب لأصحاب العيادات — اختر شريحة، اكتب الرسالة، جرّبها على رقمك، ثم أرسل
        </p>
      </div>

      <BroadcastStudio
        history={(history ?? []) as PastBroadcast[]}
        plans={(plans ?? []).map((p) => p.code as string)}
        myPhone={((me?.phone as string | null) ?? null)}
      />
    </div>
  );
}
