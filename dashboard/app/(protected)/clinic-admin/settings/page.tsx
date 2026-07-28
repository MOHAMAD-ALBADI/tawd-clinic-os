import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { clinicToday } from "@/lib/clinic-time";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClinicInfoForm } from "@/components/settings/clinic-info-form";
import { WorkingHoursForm } from "@/components/settings/working-hours-form";
import { ClinicHolidays, type Holiday } from "@/components/settings/clinic-holidays";
import { ReviewLinkForm } from "@/components/settings/review-link-form";
import { VatNumberForm } from "@/components/settings/vat-number-form";
import { BookingLink } from "@/components/platform/booking-link";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { MySubscription, type MyInvoice } from "@/components/settings/my-subscription";
import { getEntitlements } from "@/lib/entitlements";
import { thawaniConfig } from "@/lib/thawani";
import { Shield } from "lucide-react";

export const metadata = { title: "الإعدادات — طود" };
export const dynamic = "force-dynamic";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter", growth: "Growth", pro: "Pro", enterprise: "Enterprise",
};

export default async function SettingsPage({
  searchParams,
}: { searchParams: Promise<{ pay?: string }> }) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  /* ?pay=… is how the clinic comes back from Thawani. It only reports what our
     own callback already decided after asking the gateway — the flag itself
     never settles anything. */
  const payFlag = (await searchParams).pay ?? null;
  const thawani = thawaniConfig();

  const supabase = await createServerSupabaseClient();

  const today = clinicToday();
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

  /* The clinic's own copy of what the platform agreed and billed. Read from the
     same rows the operator edits — there is no second copy to drift. */
  const [entitlements, { data: myInvoices }, { data: myPayments }, { count: doctorCount }, { count: patientCount }] =
    await Promise.all([
      getEntitlements(claims.clinic_id),
      supabase.from("platform_invoices")
        .select("id, number, period_start, period_end, total_omr, status, due_at")
        .order("issued_at", { ascending: false }).limit(24),
      supabase.from("platform_payments").select("invoice_id, amount_omr"),
      supabase.from("tawd_staff_users").select("id", { count: "exact", head: true })
        .eq("clinic_id", claims.clinic_id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null),
      supabase.from("patients").select("id", { count: "exact", head: true })
        .eq("clinic_id", claims.clinic_id).is("deleted_at", null),
    ]);

  const paidByInvoice = new Map<string, number>();
  for (const p of myPayments ?? []) {
    const k = p.invoice_id as string;
    paidByInvoice.set(k, (paidByInvoice.get(k) ?? 0) + Number(p.amount_omr ?? 0));
  }
  const invoiceRows: MyInvoice[] = (myInvoices ?? []).map((i) => ({
    id: i.id as string,
    number: i.number as string,
    periodStart: i.period_start as string,
    periodEnd: i.period_end as string,
    total: Number(i.total_omr ?? 0),
    paid: paidByInvoice.get(i.id as string) ?? 0,
    status: i.status as string,
    dueAt: (i.due_at as string | null) ?? null,
  }));

  const defaultHours: Record<string, { open: string; close: string }> = {
    sun: { open: "08:00", close: "22:00" },
    mon: { open: "08:00", close: "22:00" },
    tue: { open: "08:00", close: "22:00" },
    wed: { open: "08:00", close: "22:00" },
    thu: { open: "08:00", close: "22:00" },
    sat: { open: "08:00", close: "22:00" },
  };

  const workingHours = (settings?.working_hours as Record<string, { open: string; close: string } | null>) ?? defaultHours;

  const sub = subscription ?? { plan: clinic?.plan ?? "starter", status: "trial", renews_at: null };


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
            {/* Was a decorative strip showing the plan name and a staff count.
                It is the real contract now: price, renewal, limits against live
                usage, what is included, and every invoice with what has been
                paid on it. */}
            <MySubscription
              entitlements={entitlements}
              invoices={invoiceRows}
              usage={{
                doctors: doctorCount ?? 0,
                staff: staffCount ?? 0,
                patients: patientCount ?? 0,
              }}
              planName={PLAN_NAMES[sub.plan] ?? sub.plan}
              status={sub.status}
              renewsAt={(sub.renews_at as string | null) ?? null}
              pay={{ configured: thawani.configured, live: thawani.live, flag: payFlag }}
            />
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
