import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { PlansManager, type PlanRow } from "@/components/platform/plans-manager";
import { n8nApiBase } from "@/lib/n8n";
import { platformSecrets } from "@/lib/platform-secrets";
import { KeysSync } from "@/components/platform/keys-sync";
import { UserCog, Plug, CheckCircle2, XCircle } from "lucide-react";

export const metadata = { title: "إعدادات المنصة — طود" };
export const dynamic = "force-dynamic";

/** Whether a server-side integration is configured. Never renders the value —
    these are secrets; the operator only needs to know if one is missing. */
function Integration({ label, set, hint }: { label: string; set: boolean; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-white">{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>{hint}</p>
      </div>
      <span className="flex items-center gap-1.5 text-[11.5px] font-bold shrink-0"
        style={{ color: set ? "#34d399" : "#fbbf24" }}>
        {set ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {set ? "مضبوط" : "ناقص"}
      </span>
    </div>
  );
}

export default async function PlatformSettingsPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: plans }, { data: subs }, { data: costs }, secrets, { count: waClinics }] = await Promise.all([
    sb.from("platform_plans").select("*").order("sort_order"),
    sb.from("tawd_subscriptions").select("plan"),
    sb.from("platform_costs").select("id, name, monthly_omr").order("created_at"),
    platformSecrets(),
    sb.from("channel_configs").select("clinic_id", { count: "exact", head: true }).eq("channel", "whatsapp"),
  ]);

  const subsPerPlan = new Map<string, number>();
  for (const s of subs ?? []) {
    const k = (s.plan as string) ?? "";
    subsPerPlan.set(k, (subsPerPlan.get(k) ?? 0) + 1);
  }

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const rows: PlanRow[] = (plans ?? []).map((p) => ({
    code: p.code as string,
    name_ar: p.name_ar as string,
    description_ar: (p.description_ar as string | null) ?? "",
    price_omr: Number(p.price_omr ?? 0),
    per_doctor_omr: Number(p.per_doctor_omr ?? 0),
    setup_fee_omr: Number(p.setup_fee_omr ?? 0),
    max_doctors: num(p.max_doctors),
    max_staff: num(p.max_staff),
    max_patients: num(p.max_patients),
    max_whatsapp_msgs: num(p.max_whatsapp_msgs),
    modules: (p.modules as string[] | null) ?? [],
    is_active: !!p.is_active,
    is_default: !!p.is_default,
    sort_order: Number(p.sort_order ?? 0),
    subscriberCount: subsPerPlan.get(p.code as string) ?? 0,
  }));

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">PLATFORM SETTINGS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">إعدادات المنصة</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ما تبيعه وبكم، وما تدفعه أنت، وحالة الأنظمة التي يعتمد عليها طَود
        </p>
      </div>

      <PlansManager plans={rows} />

      {/* Costs are edited on the economy page, where the usage they are measured
          against is real. Showing the same widget here fed with zeros would have
          rendered a "net profit" of minus-your-costs, which is a lie. */}
      <div className="panel flex items-center justify-between gap-3 flex-wrap" style={{ padding: "1.25rem 1.5rem" }}>
        <div>
          <p className="text-[13px] font-bold text-white">تكاليفك الشهرية</p>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-4)" }}>
            {(costs ?? []).length} بند مسجّل — تُدار مع الاستهلاك في صفحة الاقتصاد
          </p>
        </div>
        <Link href="/platform-admin/economy" className="btn-ghost">فتح اقتصاد المنصة</Link>
      </div>

      <div className="panel" style={{ padding: "1.5rem" }}>
        <div className="section-title mb-1">
          <Plug className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>الأنظمة المرتبطة</h2>
        </div>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
          المفاتيح تُضبط في متغيّرات البيئة على Vercel — تُعرض هنا حالتها فقط، لا قيمها
        </p>
        <div className="space-y-2">
          <Integration label="Supabase" set={!!process.env.NEXT_PUBLIC_SUPABASE_URL}
            hint="قاعدة البيانات والمصادقة" />
          <Integration label="n8n" set={!!process.env.N8N_API_KEY}
            hint={`محرك الأتمتة — ${n8nApiBase()}`} />
          <Integration label="ثواني (Thawani)" set={!!process.env.THAWANI_SECRET_KEY}
            hint="الدفع الإلكتروني — بدونه لا تُنشأ روابط دفع" />
          <Integration label="PostHog" set={!!process.env.NEXT_PUBLIC_POSTHOG_KEY}
            hint="تحليلات الاستخدام" />

          {/* These four are not env vars — they live in platform_secrets, which
              no browser session can read, and are copied into each connected
              clinic so the workflows can find them. */}
          <Integration label="Gemini" set={!!secrets.geminiKey}
            hint="عقل سُرى — بدونه تستقبل ولا ترد" />
          <Integration label="Google TTS" set={!!secrets.gcpTtsKey}
            hint="الردّ الصوتي على الرسائل الصوتية" />
          <Integration label="Resend" set={!!secrets.resendKey}
            hint="البريد الصادر للعيادات وتنبيهات الأخطاء" />
          <Integration label="واتساب المنصّة" set={!!secrets.waAccessToken && !!secrets.waPhoneNumberId}
            hint="رقم طَود نفسه — منه تُرسَل إشعارات الاشتراك" />
        </div>

        <KeysSync clinics={waClinics ?? 0} />
      </div>

      <div className="panel flex items-center justify-between gap-3 flex-wrap" style={{ padding: "1.25rem 1.5rem" }}>
        <div>
          <p className="text-[13px] font-bold text-white flex items-center gap-2">
            <UserCog className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} /> حسابك
          </p>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-4)" }}>
            اسمك وصورتك وكلمة مرورك — وإنهاء جلساتك على كل الأجهزة
          </p>
        </div>
        <Link href="/profile" className="btn-ghost">فتح ملفي الشخصي</Link>
      </div>
    </div>
  );
}
