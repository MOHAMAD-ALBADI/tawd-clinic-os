import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClinicInfoForm } from "@/components/settings/clinic-info-form";
import { WorkingHoursForm } from "@/components/settings/working-hours-form";
import { ReviewLinkForm } from "@/components/settings/review-link-form";
import { VatNumberForm } from "@/components/settings/vat-number-form";
import { BookingLink } from "@/components/platform/booking-link";
import { Shield, CreditCard, Users, Activity } from "lucide-react";

export const metadata = { title: "الإعدادات — طود" };

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter", growth: "Growth", pro: "Pro", enterprise: "Enterprise",
};
const PLAN_COLORS: Record<string, string> = {
  starter: "#94A3B8", growth: "#5dd9cb", pro: "#38bdf8", enterprise: "#2dd4bf",
};
const STATUS_LABELS: Record<string, string> = {
  trial: "تجريبي", active: "نشط", past_due: "متأخر", cancelled: "ملغي", paused: "موقوف",
};

export default async function SettingsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const [{ data: clinic }, { data: settings }, { data: subscription }, { count: staffCount }] =
    await Promise.all([
      supabase
        .from("tawd_clinics")
        .select("id, name, name_ar, timezone, country_code, currency, vat_enabled, vat_number, plan, status, slug")
        .eq("id", claims.clinic_id)
        .single(),
      supabase
        .from("tawd_clinic_settings")
        .select("working_hours, mfa_enforced, channel_toggles, google_review_url")
        .eq("clinic_id", claims.clinic_id)
        .single(),
      supabase
        .from("tawd_subscriptions")
        .select("plan, status, renews_at")
        .eq("clinic_id", claims.clinic_id)
        .single(),
      supabase
        .from("tawd_staff_users")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", claims.clinic_id)
        .eq("is_active", true),
    ]);

  const defaultHours: Record<string, { open: string; close: string }> = {
    sun: { open: "08:00", close: "22:00" },
    mon: { open: "08:00", close: "22:00" },
    tue: { open: "08:00", close: "22:00" },
    wed: { open: "08:00", close: "22:00" },
    thu: { open: "08:00", close: "22:00" },
    sat: { open: "08:00", close: "22:00" },
  };

  const workingHours = (settings?.working_hours as Record<string, { open: string; close: string } | null>) ?? defaultHours;
  const channels = (settings?.channel_toggles ?? {}) as Record<string, boolean>;

  const sub = subscription ?? { plan: clinic?.plan ?? "starter", status: "trial", renews_at: null };
  const planColor = PLAN_COLORS[sub.plan] ?? "#94A3B8";

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white">الإعدادات</h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>
          تخصيص بيانات وإعدادات عيادتك
        </p>
      </div>

      {/* Subscription banner */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${planColor}12 0%, rgba(6,14,30,0.92) 60%)`,
          border: `1px solid ${planColor}25`,
        }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${planColor}18`, border: `1px solid ${planColor}30` }}>
          <CreditCard className="w-5 h-5" style={{ color: planColor }} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white">باقة {PLAN_NAMES[sub.plan] ?? sub.plan}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.55)" }}>
            الحالة: {STATUS_LABELS[sub.status] ?? sub.status}
            {sub.renews_at ? ` · تتجدد ${new Date(sub.renews_at).toLocaleDateString("ar-SA")}` : ""}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-4 text-center">
          <div>
            <p className="text-xl font-black" style={{ color: planColor }}>{staffCount ?? "—"}</p>
            <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.5)" }}>موظف نشط</p>
          </div>
          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div>
            <div className="flex gap-1.5">
              {Object.entries(channels).map(([ch, active]) => (
                <span key={ch} className="text-[10px] px-2 py-0.5 rounded-full"
                  style={active
                    ? { background: "rgba(20,184,166,0.15)", color: "#5dd9cb", border: "1px solid rgba(20,184,166,0.2)" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {ch === "whatsapp" ? "واتساب" : ch === "instagram" ? "انستغرام" : ch === "web_chat" ? "ويب" : ch}
                </span>
              ))}
            </div>
            <p className="text-[11px] mt-1" style={{ color: "rgba(148,163,184,0.5)" }}>القنوات</p>
          </div>
        </div>
      </div>

      {/* Clinic info — editable */}
      {clinic && (
        <ClinicInfoForm
          name={clinic.name}
          name_ar={clinic.name_ar ?? null}
          country_code={clinic.country_code ?? "OM"}
          timezone={clinic.timezone ?? "Asia/Muscat"}
          currency={clinic.currency ?? "OMR"}
          vat_enabled={clinic.vat_enabled ?? false}
          is_active={!["cancelled", "paused"].includes(clinic.status ?? "")}
          plan={clinic.plan ?? "starter"}
        />
      )}

      {/* Working hours — editable */}
      <WorkingHoursForm hours={workingHours} />

      {/* Google review link — editable (used by Sura post-visit follow-up) */}
      <ReviewLinkForm currentUrl={(settings?.google_review_url as string | null) ?? null} />

      {/* VAT registration number — printed on tax invoices */}
      <VatNumberForm current={(clinic?.vat_number as string | null) ?? null} />

      {/* Public booking link — the clinic shares this with patients */}
      {clinic?.slug && <BookingLink slug={clinic.slug as string} />}

      {/* Security info */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)" }}>
          <Shield className="w-4 h-4" style={{ color: "#38bdf8" }} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white text-sm">الأمان والمصادقة</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>
            المصادقة الثنائية (MFA): {settings?.mfa_enforced ? "مفعّلة لجميع الموظفين" : "غير مفعّلة"} · لتفعيلها تواصل مع فريق طود
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", color: "#38bdf8" }}>
          <Activity className="w-3.5 h-3.5" />
          <Users className="w-3.5 h-3.5" />
          متقدم
        </div>
      </div>
    </div>
  );
}
