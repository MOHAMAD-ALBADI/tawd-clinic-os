import { redirect } from "next/navigation";
import { getUserClaims }             from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MessageSquare, CheckCircle2, XCircle } from "lucide-react";

export const metadata = { title: "القوالب — التسويق — طود" };

const CHANNEL_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  whatsapp: { color: "#4ADE80", bg: "rgba(74,222,128,0.06)",  border: "rgba(74,222,128,0.15)"  },
  sms:      { color: "#38bdf8", bg: "rgba(56,189,248,0.06)",  border: "rgba(56,189,248,0.15)"  },
  email:    { color: "#C4B5FD", bg: "rgba(196,181,253,0.06)", border: "rgba(196,181,253,0.15)" },
};

const TYPE_LABEL: Record<string, string> = {
  appointment_reminder:  "تذكير موعد",
  appointment_confirmed: "تأكيد موعد",
  appointment_cancelled: "إلغاء موعد",
  follow_up:             "متابعة",
  birthday:              "عيد ميلاد",
  promotion:             "عرض ترويجي",
  loyalty_points:        "نقاط الولاء",
  custom:                "مخصص",
};

export default async function MarketingTemplatesPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();

  const { data } = await sb
    .from("notification_templates")
    .select("id, name, template_type, channel, body_ar, body_en, is_active, created_at")
    .eq("clinic_id", claims.clinic_id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const templates = data ?? [];
  const active    = templates.filter((t) => t.is_active).length;

  const byChannel = templates.reduce<Record<string, number>>((acc, t) => {
    acc[t.channel] = (acc[t.channel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.16)", padding: "1.25rem" }}
        >
          <div className="absolute bottom-1 start-1 font-black ltr-nums select-none pointer-events-none" style={{ fontSize: "4rem", color: "#14b8a6", opacity: 0.07, lineHeight: 1 }}>
            {templates.length}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 relative" style={{ color: "rgba(148,163,184,0.4)" }}>الإجمالي</p>
          <p className="font-black ltr-nums text-4xl relative" style={{ color: "#5dd9cb", lineHeight: 1 }}>{templates.length}</p>
        </div>
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", padding: "1.25rem" }}
        >
          <div className="absolute bottom-1 start-1 font-black ltr-nums select-none pointer-events-none" style={{ fontSize: "4rem", color: "#4ADE80", opacity: 0.07, lineHeight: 1 }}>
            {active}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 relative" style={{ color: "rgba(148,163,184,0.4)" }}>نشط</p>
          <p className="font-black ltr-nums text-4xl relative" style={{ color: "#4ADE80", lineHeight: 1 }}>{active}</p>
        </div>
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: "rgba(107,114,128,0.05)", border: "1px solid rgba(107,114,128,0.14)", padding: "1.25rem" }}
        >
          <div className="absolute bottom-1 start-1 font-black ltr-nums select-none pointer-events-none" style={{ fontSize: "4rem", color: "#6B7280", opacity: 0.07, lineHeight: 1 }}>
            {templates.length - active}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 relative" style={{ color: "rgba(148,163,184,0.4)" }}>معطّل</p>
          <p className="font-black ltr-nums text-4xl relative" style={{ color: "#6B7280", lineHeight: 1 }}>{templates.length - active}</p>
        </div>
        <div
          className="rounded-2xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "1.25rem" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(148,163,184,0.4)" }}>القنوات</p>
          <div className="space-y-1.5">
            {Object.entries(byChannel).map(([ch, cnt]) => {
              const c = CHANNEL_COLOR[ch] ?? { color: "#94A3B8", bg: "transparent", border: "transparent" };
              return (
                <div key={ch} className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{ch}</span>
                  <span className="font-black ltr-nums text-sm" style={{ color: c.color }}>{cnt}</span>
                </div>
              );
            })}
            {Object.keys(byChannel).length === 0 && <p className="text-xs" style={{ color: "#334155" }}>—</p>}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" style={{ color: "#14b8a6" }} />
            <span className="text-sm font-semibold text-white">قائمة القوالب</span>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: "rgba(20,184,166,0.1)", color: "#5dd9cb", border: "1px solid rgba(20,184,166,0.18)" }}>
            {templates.length} قالب
          </span>
        </div>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)" }}>
              <MessageSquare className="w-7 h-7" style={{ color: "rgba(20,184,166,0.4)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-white">لا توجد قوالب مسجّلة</p>
              <p className="text-sm mt-1" style={{ color: "#334155" }}>القوالب تُضاف عبر n8n أو مباشرةً في Supabase</p>
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {templates.map((t) => {
              const ch = CHANNEL_COLOR[t.channel] ?? { color: "#94A3B8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.14)" };
              const typeLabel = TYPE_LABEL[t.template_type] ?? t.template_type;
              return (
                <div key={t.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="shrink-0 mt-1">
                    {t.is_active
                      ? <CheckCircle2 className="w-4 h-4" style={{ color: "#4ADE80" }} />
                      : <XCircle className="w-4 h-4" style={{ color: "#4B5563" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-white text-sm">{t.name}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0" style={{ background: ch.bg, color: ch.color, border: `1px solid ${ch.border}` }}>{t.channel}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.04)", color: "#475569", border: "1px solid rgba(255,255,255,0.07)" }}>{typeLabel}</span>
                    </div>
                    {(t.body_ar || t.body_en) && (
                      <p className="text-xs line-clamp-2 mt-1" style={{ color: "#334155", direction: t.body_ar ? "rtl" : "ltr" }}>
                        {(t.body_ar || t.body_en).substring(0, 120)}{(t.body_ar || t.body_en).length > 120 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
