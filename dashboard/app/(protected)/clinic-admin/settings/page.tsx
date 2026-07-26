import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClinicInfoForm } from "@/components/settings/clinic-info-form";
import { WorkingHoursForm } from "@/components/settings/working-hours-form";
import { ClinicHolidays, type Holiday } from "@/components/settings/clinic-holidays";
import { ReviewLinkForm } from "@/components/settings/review-link-form";
import { VatNumberForm } from "@/components/settings/vat-number-form";
import { BookingLink } from "@/components/platform/booking-link";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { Shield, CreditCard } from "lucide-react";

export const metadata = { title: "الإعدادات — طود" };
export const dynamic = "force-dynamic";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter", growth: "Growth", pro: "Pro", enterprise: "Enterprise",
};
const PLAN_COLORS: Record<string, string> = {
  starter: "#a8a29b", growth: "#5b93ff", pro: "#2e6bf0", enterprise: "#1e52d6",
};
const STATUS_LABELS: Record<string, string> = {
  trial: "تجريبي", active: "نشط", past_due: "متأخر", cancelled: "ملغي", paused: "موقوف",
};

export default async function SettingsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: clinic }, { data: settings }, { data: subscription }, { count: staffCount }, { data: holidays }] =
    await Promise.all([
      supabase
        .from("tawd_clinics")
        .select("id, name, name_ar, timezone, country_code, currency, vat_enabled, vat_number, plan, status, slug, phone, address, logo_url")
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
      /* Clinic-wide closures only. A doctor's personal leave belongs to their
         own schedule page and is not the manager's to cancel from here. */
      supabase
        .from("clinic_holidays")
        .select("id, holiday_date, name, name_ar")
        .eq("clinic_id", claims.clinic_id)
        .eq("applies_to_all_doctors", true)
        .gte("holiday_date", today)
        .order("holiday_date"),
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

  const subscriptionBanner = (
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${planColor}12 0%, var(--surface-1) 60%)`,
          border: `1px solid ${planColor}25`,
        }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${planColor}18`, border: `1px solid ${planColor}30` }}>
          <CreditCard className="w-5 h-5" style={{ color: planColor }} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white">باقة {PLAN_NAMES[sub.plan] ?? sub.plan}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            الحالة: {STATUS_LABELS[sub.status] ?? sub.status}
            {sub.renews_at ? ` · تتجدد ${new Date(sub.renews_at).toLocaleDateString("ar-SA")}` : ""}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-4 text-center">
          <div>
            <p className="text-xl font-black" style={{ color: planColor }}>{staffCount ?? "—"}</p>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>موظف نشط</p>
          </div>
          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div>
            <div className="flex gap-1.5">
              {Object.entries(channels).map(([ch, active]) => (
                <span key={ch} className="text-[10px] px-2 py-0.5 rounded-full"
                  style={active
                    ? { background: "rgb(var(--accent-2-rgb) / 0.15)", color: "var(--accent-1)", border: "1px solid rgb(var(--accent-2-rgb) / 0.2)" }
                    : { background: "rgba(255,255,255,0.04)", color: "var(--text-4)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {ch === "whatsapp" ? "واتساب" : ch === "instagram" ? "انستغرام" : ch === "web_chat" ? "ويب" : ch}
                </span>
              ))}
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>القنوات</p>
          </div>
        </div>
      </div>
  );

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">SETTINGS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">الإعدادات</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          بيانات عيادتك وأوقات عملها وفوترتها والروابط التي تشاركها مع المرضى
        </p>
      </div>

      <SettingsTabs
        clinic={
          <>
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
                phone={(clinic.phone as string | null) ?? null}
                address={(clinic.address as string | null) ?? null}
                logo_url={(clinic.logo_url as string | null) ?? null}
              />
            )}
            <WorkingHoursForm hours={workingHours} />
            <ClinicHolidays holidays={(holidays ?? []) as Holiday[]} />
          </>
        }
        billing={
          <>
            {subscriptionBanner}
            {/* VAT number sits with billing, not with clinic details: it exists
                because it is printed on every tax invoice. */}
            <VatNumberForm current={(clinic?.vat_number as string | null) ?? null} />
          </>
        }
        channels={
          <>
            {/* Both of these are links the clinic hands to patients, which is
                why they belong together rather than beside the opening hours. */}
            {clinic?.slug && <BookingLink slug={clinic.slug as string} />}
            <ReviewLinkForm currentUrl={(settings?.google_review_url as string | null) ?? null} />
          </>
        }
        security={
          <div className="panel" style={{ padding: "1.5rem" }}>
            <div className="section-title mb-1">
              <Shield className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
              <h2>الأمان</h2>
            </div>
            <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
              كل حساب في هذه العيادة يفتح ملفات مرضى — راجع الفريق دورياً واحذف من غادر
            </p>

            <div className="space-y-2.5">
              <SecurityRow
                label="حسابات نشطة"
                value={`${staffCount ?? 0} حساب`}
                note="تعطيل الحساب من صفحة الكادر الطبي يمنع الدخول فوراً"
              />
              <SecurityRow
                label="كلمات المرور"
                value="يديرها كل موظف"
                note="من «ملفي الشخصي» — والمدير يستطيع إعادة تعيينها من صفحة الكادر"
              />
              {/* This used to read "لتفعيلها تواصل مع فريق طود", which was not a
                  thing anyone could do. Saying it is not built is more useful
                  than pointing at a support channel that cannot enable it. */}
              <SecurityRow
                label="المصادقة الثنائية"
                value={settings?.mfa_enforced ? "مفعّلة" : "غير مفعّلة"}
                note="غير متاحة في هذه النسخة"
                muted={!settings?.mfa_enforced}
              />
            </div>
          </div>
        }
      />
    </div>
  );
}

function SecurityRow({
  label, value, note, muted,
}: { label: string; value: string; note: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-white">{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>{note}</p>
      </div>
      <span className="text-[12px] font-bold shrink-0" style={{ color: muted ? "var(--text-4)" : "var(--accent-1)" }}>
        {value}
      </span>
    </div>
  );
}
