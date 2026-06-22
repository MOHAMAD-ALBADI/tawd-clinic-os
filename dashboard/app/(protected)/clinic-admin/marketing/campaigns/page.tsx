import { redirect } from "next/navigation";
import { getUserClaims }             from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CampaignLauncherTrigger } from "@/components/marketing/campaign-launcher";
import { Radio, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export const metadata = { title: "الحملات — التسويق — طود" };

const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: "مسودة",  color: "#94A3B8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.18)" },
  scheduled: { label: "مجدول", color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.18)"  },
  running:   { label: "يُرسَل", color: "#2dd4bf", bg: "rgba(45,212,191,0.08)",  border: "rgba(45,212,191,0.18)"  },
  completed: { label: "مكتمل", color: "#34d399", bg: "rgba(52,211,153,0.07)",  border: "rgba(52,211,153,0.18)"  },
  cancelled: { label: "ملغي",  color: "#f43f5e", bg: "rgba(244,63,94,0.07)",   border: "rgba(244,63,94,0.18)"   },
};

export default async function MarketingCampaignsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();

  const { data, count } = await sb
    .from("broadcast_campaigns")
    .select(
      "id, name, template_name, status, total_recipients, sent_count, failed_count, scheduled_at, created_at",
      { count: "exact" }
    )
    .eq("clinic_id", claims.clinic_id)
    .order("created_at", { ascending: false })
    .limit(100);

  const campaigns = data ?? [];
  const running   = campaigns.filter((c) => c.status === "running").length;
  const completed = campaigns.filter((c) => c.status === "completed").length;
  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1" style={{ color: "var(--color-brand-400)" }}>CAMPAIGNS</p>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">الحملات التسويقية</h2>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>أطلق حملات واتساب لمرضاك — التحكم من هنا، والإرسال عبر سُرى</p>
        </div>
        <CampaignLauncherTrigger />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الحملات",  value: count ?? 0,  color: "#38bdf8", glow: "rgba(56,189,248,0.07)",  border: "rgba(56,189,248,0.16)",  Icon: Radio        },
          { label: "تعمل الآن",        value: running,     color: "#2dd4bf", glow: "rgba(45,212,191,0.07)",  border: "rgba(45,212,191,0.16)",  Icon: Clock        },
          { label: "مكتملة",          value: completed,   color: "#34d399", glow: "rgba(52,211,153,0.07)",  border: "rgba(52,211,153,0.16)",  Icon: CheckCircle2 },
          { label: "إجمالي المُرسَل", value: totalSent.toLocaleString("en-US"), color: "#5dd9cb", glow: "rgba(94,217,203,0.07)", border: "rgba(94,217,203,0.16)", Icon: AlertCircle },
        ].map((s) => (
          <div
            key={s.label}
            className="relative rounded-2xl overflow-hidden"
            style={{ background: s.glow, border: `1px solid ${s.border}`, padding: "1.25rem" }}
          >
            <div
              className="absolute bottom-1 start-1 font-black ltr-nums select-none pointer-events-none"
              style={{ fontSize: "4rem", color: s.color, opacity: 0.07, lineHeight: 1 }}
            >
              {typeof s.value === "number" ? s.value : ""}
            </div>
            <div className="relative flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.4)" }}>
                {s.label}
              </p>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${s.color}14` }}>
                <s.Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              </div>
            </div>
            <p className="font-black ltr-nums text-4xl relative" style={{ color: s.color, lineHeight: 1 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* List */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4" style={{ color: "#14b8a6" }} />
            <span className="text-sm font-semibold text-white">قائمة الحملات</span>
          </div>
          <span
            className="text-[11px] px-2.5 py-1 rounded-full"
            style={{ background: "rgba(20,184,166,0.1)", color: "#5dd9cb", border: "1px solid rgba(20,184,166,0.18)" }}
          >
            {campaigns.length} حملة
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)" }}
            >
              <Radio className="w-7 h-7" style={{ color: "rgba(20,184,166,0.4)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-white">لا توجد حملات بعد</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>اضغط «حملة جديدة» لإطلاق أول حملة</p>
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {campaigns.map((c) => {
              const st  = STATUS[c.status] ?? STATUS.draft;
              const pct =
                c.total_recipients && c.total_recipients > 0
                  ? Math.min(100, Math.round((c.sent_count / c.total_recipients) * 100))
                  : 0;

              return (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-white truncate">{c.name}</p>
                        <span
                          className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "#475569" }}>
                        قالب: {c.template_name}
                        {c.scheduled_at && (
                          <> · مجدول: {new Date(c.scheduled_at).toLocaleDateString("ar-SA")}</>
                        )}
                      </p>
                    </div>
                    {c.total_recipients != null && (
                      <div className="shrink-0 text-end">
                        <p className="text-sm font-black ltr-nums" style={{ color: st.color }}>
                          {(c.sent_count ?? 0).toLocaleString()} / {c.total_recipients.toLocaleString()}
                        </p>
                        <p className="text-[11px]" style={{ color: "#334155" }}>رسالة مُرسَلة</p>
                        {(c.failed_count ?? 0) > 0 && (
                          <p className="text-[10px] mt-0.5" style={{ color: "#F87171" }}>
                            فشل: {c.failed_count}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {c.total_recipients != null && c.total_recipients > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: "#334155" }}>
                        <span>التقدم</span>
                        <span className="font-bold ltr-nums" style={{ color: st.color }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: c.status === "running"
                              ? `linear-gradient(90deg, ${st.color}80, ${st.color})`
                              : st.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
