import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { AddStaffForm } from "@/components/platform/add-staff-form";
import { ClinicStatusToggle } from "@/components/platform/clinic-status-toggle";
import { SubscriptionCard, ClinicWhatsApp } from "@/components/platform/manage-widgets";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { ArrowRight, Users, MessageCircle, Scissors } from "lucide-react";

export const metadata = { title: "ملف العيادة — طود" };

const STATUS_META: Record<string, { label: string; color: string }> = {
  trial:     { label: "تجريبي",  color: "#fcd34d" },
  active:    { label: "نشطة",    color: "#5dd9cb" },
  suspended: { label: "موقوفة",  color: "#fda4b4" },
  cancelled: { label: "ملغاة",   color: "#71717a" },
};

const ROLE_AR: Record<string, string> = {
  admin: "مدير", doctor: "طبيب", receptionist: "استقبال",
  accountant: "محاسبة", platform_admin: "منصة",
};

export default async function ClinicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: clinic }, { data: staff }, { data: services }, { data: wa }, { data: sub }] = await Promise.all([
    sb.from("tawd_clinics").select("id, name, name_ar, clinic_type, status, plan, phone, created_at, vat_number").eq("id", id).maybeSingle(),
    sb.from("tawd_staff_users").select("id, name, name_ar, email, role, is_active").eq("clinic_id", id).is("deleted_at", null).order("created_at"),
    sb.from("services").select("id").eq("clinic_id", id).eq("is_active", true),
    sb.from("channel_configs").select("is_active").eq("clinic_id", id).eq("channel", "whatsapp").limit(1).maybeSingle(),
    sb.from("tawd_subscriptions").select("plan, status, trial_ends_at, price_omr, current_period_end").eq("clinic_id", id).maybeSingle(),
  ]);
  if (!clinic) notFound();

  const st = STATUS_META[clinic.status] ?? STATUS_META.trial;
  const created = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric" }).format(new Date(clinic.created_at));

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع لنظرة المنصة
      </Link>

      {/* header */}
      <div className="panel-feature" style={{ padding: "1.5rem 1.75rem" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-white">{clinic.name_ar ?? clinic.name}</h1>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                {st.label}
              </span>
            </div>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--text-3)" }}>
              {clinic.name} · باقة {sub?.plan ?? clinic.plan} · منذ {created}
              {clinic.phone && <span className="ltr-nums"> · {clinic.phone}</span>}
            </p>
          </div>
          <ClinicStatusToggle clinicId={clinic.id} status={clinic.status} />
        </div>

        <div className="flex items-center gap-5 mt-4 flex-wrap text-[12px]">
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
            <Users className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
            <span className="font-bold text-white ltr-nums">{(staff ?? []).length}</span> موظف
          </span>
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
            <Scissors className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
            <span className="font-bold text-white ltr-nums">{(services ?? []).length}</span> خدمة مفعّلة
          </span>
          <span className="flex items-center gap-1.5" style={{ color: wa?.is_active ? "#5dd9cb" : "#fcd34d" }}>
            <MessageCircle className="w-3.5 h-3.5" />
            سُرى واتساب: {wa?.is_active ? "مربوطة ✓" : "غير مربوطة — إعداد تقني من فريق طود"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* staff */}
        <div className="col-span-12 lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>حسابات العيادة</h2>
          </div>
          {(staff ?? []).length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-4)" }}>لا حسابات بعد</p>
          ) : (
            <div className="space-y-1.5">
              {(staff ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 text-white"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {(s.name_ar ?? s.name ?? "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{s.name_ar ?? s.name}</p>
                    <p className="text-[11px] ltr-nums truncate" style={{ color: "var(--text-4)" }}>{s.email}</p>
                  </div>
                  <span className="badge badge-mute">{ROLE_AR[s.role] ?? s.role}</span>
                  {!s.is_active && <span className="badge badge-bad">معطّل</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* add staff */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <SubscriptionCard
            clinicId={clinic.id}
            plan={(sub?.plan as string) ?? clinic.plan}
            status={(sub?.status as string) ?? clinic.status}
            priceOmr={Number(sub?.price_omr ?? 0)}
            periodEnd={(sub?.current_period_end as string | null) ?? (sub?.trial_ends_at as string | null)}
          />
          <ClinicWhatsApp clinicId={clinic.id} hasPhone={!!clinic.phone} />
          <AddStaffForm clinicId={clinic.id} />
        </div>
      </div>
    </div>
  );
}
