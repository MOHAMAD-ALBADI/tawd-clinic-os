import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { Building2, Plus, ChevronLeft } from "lucide-react";

export const metadata = { title: "نظرة المنصة — طود" };

const STATUS_META: Record<string, { label: string; color: string }> = {
  trial:     { label: "تجريبي",  color: "#fcd34d" },
  active:    { label: "نشطة",    color: "#5dd9cb" },
  suspended: { label: "موقوفة",  color: "#fda4b4" },
  cancelled: { label: "ملغاة",   color: "#71717a" },
};

const TYPE_LABEL: Record<string, string> = {
  dental: "أسنان", cosmetic: "تجميل", dermatology: "جلدية",
  pediatric: "أطفال", ophthalmology: "عيون", general: "عام",
};

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function PlatformAdminPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  /* platform = cross-clinic reads → service client (guarded above) */
  const sb = await createServiceRoleClient();
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00`;

  const [{ data: clinics }, { data: patients }, { data: monthAppts }, { data: monthPaid }] = await Promise.all([
    sb.from("tawd_clinics").select("id, name, name_ar, clinic_type, status, plan, created_at").order("created_at", { ascending: false }),
    sb.from("patients").select("clinic_id").is("deleted_at", null).limit(100000),
    sb.from("appointments").select("clinic_id").gte("slot_time", monthStart).is("deleted_at", null).limit(100000),
    sb.from("invoices").select("clinic_id, total").eq("status", "paid").gte("created_at", monthStart).is("deleted_at", null).limit(100000),
  ]);

  const list = clinics ?? [];
  const countBy = (rows: { clinic_id: string }[] | null) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.clinic_id] = (m[r.clinic_id] ?? 0) + 1;
    return m;
  };
  const patientsBy = countBy(patients);
  const apptsBy = countBy(monthAppts);
  const revenueBy: Record<string, number> = {};
  for (const r of monthPaid ?? []) revenueBy[r.clinic_id] = (revenueBy[r.clinic_id] ?? 0) + Number(r.total ?? 0);

  const totalPatients = (patients ?? []).length;
  const totalRevenue = Object.values(revenueBy).reduce((s, v) => s + v, 0);
  const activeCount = list.filter((c) => c.status === "active").length;
  const trialCount = list.filter((c) => c.status === "trial").length;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* hero */}
      <div className="panel-feature flex items-start justify-between gap-4 flex-wrap" style={{ padding: "1.5rem 1.75rem" }}>
        <div>
          <p className="eyebrow" style={{ color: "var(--accent-2)" }}>منصة طود</p>
          <h1 className="text-xl font-bold text-white mt-1">نظرة المنصة</h1>
          <div className="flex items-center gap-5 mt-4 flex-wrap">
            {[
              { l: "عيادة", v: list.length },
              { l: "نشطة", v: activeCount },
              { l: "تجريبية", v: trialCount },
              { l: "مريض إجمالاً", v: totalPatients },
              { l: "إيراد العيادات هذا الشهر", v: `${fmt(totalRevenue)} ر.ع` },
            ].map((s, i) => (
              <div key={s.l} className="flex items-baseline gap-2">
                {i > 0 && <span className="w-px h-4 -ms-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />}
                <span className="text-lg font-bold ltr-nums text-white">{s.v}</span>
                <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <Link href="/platform-admin/clinics/new" className="btn-primary shrink-0">
          <Plus className="w-4 h-4" /> إضافة عيادة
        </Link>
      </div>

      {/* clinics */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="section-title mb-4">
          <TawdBarsGlyph size={13} />
          <h2>العيادات</h2>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
            <p className="text-sm" style={{ color: "var(--text-3)" }}>أضف أول عيادة للمنصة</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {list.map((c) => {
              const st = STATUS_META[c.status] ?? STATUS_META.trial;
              return (
                <Link
                  key={c.id}
                  href={`/platform-admin/clinics/${c.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl flex-wrap row-hover"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <Building2 style={{ color: "var(--text-2)", width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-white truncate">{c.name_ar ?? c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                      {TYPE_LABEL[c.clinic_type] ?? c.clinic_type} · باقة {c.plan}
                    </p>
                  </div>
                  <div className="flex items-center gap-5 text-[11px] ltr-nums" style={{ color: "var(--text-3)" }}>
                    <span><span className="font-bold text-white">{patientsBy[c.id] ?? 0}</span> مريض</span>
                    <span><span className="font-bold text-white">{apptsBy[c.id] ?? 0}</span> موعد/شهر</span>
                    <span><span className="font-bold text-white">{fmt(revenueBy[c.id] ?? 0)}</span> ر.ع</span>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                    style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                    {st.label}
                  </span>
                  <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
