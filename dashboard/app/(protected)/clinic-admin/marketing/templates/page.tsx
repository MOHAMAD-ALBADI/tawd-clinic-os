import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TemplatesManager, type TemplateRow } from "@/components/marketing/templates-manager";
import { MessageSquare, CheckCircle2, PowerOff, Send } from "lucide-react";

export const metadata = { title: "القوالب — التسويق — طود" };

const CHANNEL_AR: Record<string, string> = {
  whatsapp: "واتساب", sms: "رسالة نصية", email: "بريد", web_chat: "ويب",
};

export default async function MarketingTemplatesPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const { data } = await sb
    .from("notification_templates")
    .select("id, name, template_type, channel, body_ar, body_en, is_active")
    .eq("clinic_id", claims.clinic_id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const templates = (data ?? []) as TemplateRow[];
  const active = templates.filter((t) => t.is_active).length;

  const byChannel = templates.reduce<Record<string, number>>((acc, t) => {
    acc[t.channel] = (acc[t.channel] ?? 0) + 1;
    return acc;
  }, {});
  const topChannel = Object.entries(byChannel).sort((a, b) => b[1] - a[1])[0];

  const kpis = [
    { label: "إجمالي القوالب", value: String(templates.length), Icon: MessageSquare, color: "var(--accent-1)" },
    { label: "مُفعّلة", value: String(active), Icon: CheckCircle2, color: "var(--accent-1)" },
    { label: "معطّلة", value: String(templates.length - active), Icon: PowerOff,
      color: templates.length - active > 0 ? "#fbbf24" : "var(--text-3)" },
    { label: "القناة الأكثر", value: topChannel ? (CHANNEL_AR[topChannel[0]] ?? topChannel[0]) : "—", Icon: Send, color: "var(--accent-1)" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">MESSAGE TEMPLATES</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">قوالب الرسائل</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          نصوص الرسائل التلقائية لمرضاك — تكتبها وتعدّلها من هنا مباشرة
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none text-white" style={{ fontSize: "1.9rem" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <TemplatesManager templates={templates} />
    </div>
  );
}
