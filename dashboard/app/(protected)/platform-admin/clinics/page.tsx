import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { Building2, Plus, ChevronLeft, MessageCircle } from "lucide-react";

export const metadata = { title: "إدارة العيادات — طود" };
export const dynamic = "force-dynamic";

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

export default async function ClinicsPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: clinics }, { data: recentAppts }, { data: recentMsgs }, { data: channels }, { data: subs }] = await Promise.all([
    sb.from("tawd_clinics").select("id, name, name_ar, clinic_type, status, plan, phone").order("created_at", { ascending: false }),
    sb.from("appointments").select("clinic_id, created_at").order("created_at", { ascending: false }).limit(3000),
    sb.from("chat_messages").select("clinic_id, created_at").order("created_at", { ascending: false }).limit(3000),
    sb.from("channel_configs").select("clinic_id, is_active").eq("channel", "whatsapp"),
    sb.from("tawd_subscriptions").select("clinic_id, status, trial_ends_at, current_period_end"),
  ]);

  /* churn signal: last activity (appointment OR Sura message) older than 7 days */
  const lastBy: Record<string, number> = {};
  for (const r of [...(recentAppts ?? []), ...(recentMsgs ?? [])]) {
    const t = new Date(r.created_at).getTime();
    if (!lastBy[r.clinic_id] || t > lastBy[r.clinic_id]) lastBy[r.clinic_id] = t;
  }
  const waLinked = new Set((channels ?? []).filter((c) => c.is_active).map((c) => c.clinic_id));

  const daysLeftOf = (id: string) => {
    const s = (subs ?? []).find((x) => x.clinic_id === id);
    const end = s ? (s.status === "trial" ? s.trial_ends_at : s.current_period_end) : null;
    return end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000) : null;
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">إدارة العيادات</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            {(clinics ?? []).length} عيادة — اضغط أي عيادة للإدارة الكاملة
          </p>
        </div>
        <Link href="/platform-admin/clinics/new" className="btn-primary">
          <Plus className="w-4 h-4" /> إضافة عيادة
        </Link>
      </div>

      <div className="space-y-1.5">
        {(clinics ?? []).map((c) => {
          const st = STATUS_META[c.status] ?? STATUS_META.trial;
          const last = lastBy[c.id];
          const idleDays = last ? Math.floor((Date.now() - last) / 86_400_000) : null;
          const idle = idleDays !== null && idleDays >= 7;
          const days = daysLeftOf(c.id);
          return (
            <Link key={c.id} href={`/platform-admin/clinics/${c.id}`}
              className="flex items-center gap-4 px-4 py-3 rounded-xl flex-wrap row-hover panel"
              style={{ padding: "0.85rem 1.1rem" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Building2 style={{ color: "var(--text-2)", width: 18, height: 18 }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-bold text-white truncate">{c.name_ar ?? c.name}</p>
                  {idle && <span className="badge badge-warn" style={{ fontSize: 9 }}>خاملة {idleDays} يوم ⚠</span>}
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                  {TYPE_LABEL[c.clinic_type] ?? c.clinic_type} · باقة {c.plan}
                  {days !== null && (
                    <span className="ltr-nums" style={{ color: days <= 0 ? "#fda4b4" : days <= 7 ? "#fcd34d" : undefined }}>
                      {" "}· {days <= 0 ? "الاشتراك منتهي!" : `باقي ${days} يوم`}
                    </span>
                  )}
                </p>
              </div>
              <MessageCircle className="w-3.5 h-3.5 shrink-0"
                style={{ color: waLinked.has(c.id) ? "#5dd9cb" : "var(--text-4)" }} />
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}>
                <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                {st.label}
              </span>
              <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
