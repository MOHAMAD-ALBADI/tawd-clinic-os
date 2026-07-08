import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PublicBookingForm } from "@/components/public/public-booking-form";
import { TawdLogoMark } from "@/components/shell/tawd-logo";
import { MapPin, Phone, Clock, Sparkles } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  dental: "عيادة أسنان", cosmetic: "عيادة تجميل", dermatology: "عيادة جلدية",
  pediatric: "عيادة أطفال", ophthalmology: "عيادة عيون", general: "عيادة",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sb = await createServiceRoleClient();
  const { data: c } = await sb.from("tawd_clinics").select("name_ar, name").eq("slug", slug).maybeSingle();
  const n = c?.name_ar ?? c?.name ?? "عيادة";
  return { title: `احجز موعدك — ${n}`, description: `احجز موعدك في ${n} إلكترونياً خلال ثوانٍ` };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await createServiceRoleClient();

  const { data: clinic } = await sb
    .from("tawd_clinics")
    .select("id, name, name_ar, clinic_type, status, phone, address")
    .eq("slug", slug)
    .maybeSingle();
  if (!clinic) notFound();

  const [{ data: services }, { data: doctors }, { data: settings }] = await Promise.all([
    sb.from("services").select("id, name_ar, name, price").eq("clinic_id", clinic.id).eq("is_active", true).order("name_ar"),
    sb.from("tawd_staff_users").select("id, name, name_ar").eq("clinic_id", clinic.id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null),
    sb.from("tawd_clinic_settings").select("working_hours").eq("clinic_id", clinic.id).maybeSingle(),
  ]);

  const suspended = clinic.status === "suspended";
  const svcOpts = (services ?? []).map((s) => ({ id: s.id, label: (s.name_ar ?? s.name) as string, price: Number(s.price ?? 0) }));
  const docOpts = (doctors ?? []).map((d) => ({ id: d.id, label: (d.name_ar ?? d.name) as string }));
  const name = clinic.name_ar ?? clinic.name;

  const wh = (settings?.working_hours ?? {}) as Record<string, { open: string; close: string } | null>;
  const openDays = Object.entries(wh).filter(([, v]) => v).length;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8"
      style={{ background: "radial-gradient(ellipse 70% 50% at 50% -8%, rgba(255,255,255,0.04) 0%, transparent 60%), #0a0a0b" }}>
      <div className="w-full max-w-lg">
        {/* brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <TawdLogoMark className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">{name}</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-3)" }}>
            {TYPE_LABEL[clinic.clinic_type] ?? "عيادة"}
          </p>
          <div className="flex items-center gap-4 mt-3 text-[12px] flex-wrap justify-center" style={{ color: "var(--text-4)" }}>
            {clinic.phone && <span className="flex items-center gap-1 ltr-nums"><Phone className="w-3 h-3" />{clinic.phone}</span>}
            {clinic.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{clinic.address}</span>}
            {openDays > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{openDays} أيام عمل</span>}
          </div>
        </div>

        {/* booking card */}
        <div className="panel-feature" style={{ padding: "1.75rem" }}>
          {suspended || svcOpts.length === 0 || docOpts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                {suspended ? "الحجز الإلكتروني غير متاح حالياً — تواصل مع العيادة مباشرة"
                  : "لا تتوفر خدمات أو أطباء للحجز حالياً"}
              </p>
              {clinic.phone && <a href={`tel:${clinic.phone}`} className="btn-primary mt-4 inline-flex"><Phone className="w-4 h-4" /> اتصل بالعيادة</a>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
                <p className="text-sm font-bold text-white">احجز موعدك خلال ثوانٍ</p>
              </div>
              <PublicBookingForm slug={slug} services={svcOpts} doctors={docOpts} />
            </>
          )}
        </div>

        <p className="text-center text-[11px] mt-6 flex items-center justify-center gap-1.5" style={{ color: "var(--text-4)" }}>
          مدعوم بـ <span className="font-bold" style={{ color: "var(--text-3)" }}>سُرى · طود</span>
        </p>
      </div>
    </div>
  );
}
