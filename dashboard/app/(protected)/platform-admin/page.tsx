import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import {
  Building2, Plus, ChevronLeft, Workflow, AlertTriangle,
  MessageCircle, Bot, Timer, Wallet,
} from "lucide-react";

export const metadata = { title: "مركز قيادة المنصة — طود" };
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
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Live n8n automation health (graceful when the key isn't configured). */
async function getAutomationHealth() {
  const key = process.env.N8N_API_KEY;
  const base = process.env.N8N_BASE_URL ?? "https://n8n.srv1239666.hstgr.cloud/api/v1";
  if (!key) return null;
  try {
    const H = { "X-N8N-API-KEY": key };
    const [wfRes, exRes] = await Promise.all([
      fetch(`${base}/workflows?limit=100`, { headers: H, signal: AbortSignal.timeout(4000), cache: "no-store" }),
      fetch(`${base}/executions?limit=100`, { headers: H, signal: AbortSignal.timeout(4000), cache: "no-store" }),
    ]);
    const wfs = (await wfRes.json()).data as { active: boolean; name: string }[];
    const exs = (await exRes.json()).data as { status: string; startedAt: string; workflowId: string }[];
    const dayAgo = Date.now() - 86_400_000;
    const recent = exs.filter((e) => new Date(e.startedAt).getTime() > dayAgo);
    return {
      total: wfs.length,
      active: wfs.filter((w) => w.active).length,
      runs24h: recent.length,
      errors24h: recent.filter((e) => e.status === "error").length,
    };
  } catch {
    return null;
  }
}

export default async function PlatformAdminPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${today.slice(0, 7)}-01T00:00:00`;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: clinics }, { data: subs }, { data: patients },
    { data: monthAppts }, { data: monthPaid },
    msgsTodayRes, { data: msgs7d },
    suraBookRes, { data: recovered },
    { data: openAlerts }, hitlRes, { data: sysErrors }, { data: channels },
    automation,
  ] = await Promise.all([
    sb.from("tawd_clinics").select("id, name, name_ar, clinic_type, status, plan, created_at").order("created_at", { ascending: false }),
    sb.from("tawd_subscriptions").select("clinic_id, plan, status, price_omr, trial_ends_at"),
    sb.from("patients").select("clinic_id").is("deleted_at", null).limit(100000),
    sb.from("appointments").select("clinic_id, slot_time").gte("slot_time", monthStart).is("deleted_at", null).limit(100000),
    sb.from("invoices").select("clinic_id, total").eq("status", "paid").gte("created_at", monthStart).is("deleted_at", null).limit(100000),
    sb.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`),
    sb.from("chat_messages").select("clinic_id").gte("created_at", weekAgo).limit(100000),
    sb.from("appointments").select("id", { count: "exact", head: true }).eq("source_channel", "whatsapp").gte("created_at", monthStart).is("deleted_at", null),
    sb.from("automation_recovery_ledger").select("amount").gte("occurred_at", monthStart),
    sb.from("sura_alerts").select("clinic_id, kind").eq("status", "open"),
    sb.from("ai_review_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("sura_errors").select("workflow_name, error_message, created_at").order("created_at", { ascending: false }).limit(5),
    sb.from("channel_configs").select("clinic_id, is_active").eq("channel", "whatsapp"),
    getAutomationHealth(),
  ]);

  const list = clinics ?? [];
  const by = <T extends { clinic_id: string }>(rows: T[] | null) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.clinic_id] = (m[r.clinic_id] ?? 0) + 1;
    return m;
  };
  const patientsBy = by(patients);
  const apptsBy = by(monthAppts);
  const msgsBy = by(msgs7d as { clinic_id: string }[]);
  const revenueBy: Record<string, number> = {};
  for (const r of monthPaid ?? []) revenueBy[r.clinic_id] = (revenueBy[r.clinic_id] ?? 0) + Number(r.total ?? 0);
  const waLinked = new Set((channels ?? []).filter((c) => c.is_active).map((c) => c.clinic_id));

  const mrr = (subs ?? []).filter((s) => s.status === "active").reduce((s, x) => s + Number(x.price_omr ?? 0), 0);
  const trialsEnding = (subs ?? [])
    .filter((s) => s.status === "trial" && s.trial_ends_at)
    .map((s) => ({
      clinic: list.find((c) => c.id === s.clinic_id),
      days: Math.ceil((new Date(s.trial_ends_at!).getTime() - Date.now()) / 86_400_000),
    }))
    .filter((t) => t.clinic)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  const totalRevenue = Object.values(revenueBy).reduce((s, v) => s + v, 0);
  const recoveredTotal = (recovered ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const emergencies = (openAlerts ?? []).filter((a) => a.kind === "emergency").length;
  const complaints = (openAlerts ?? []).filter((a) => a.kind === "complaint").length;
  const errAgo = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 1 ? "الآن" : h < 24 ? `منذ ${h} س` : `منذ ${Math.floor(h / 24)} يوم`;
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* ══ نبض المنصة ══ */}
      <div className="panel-feature" style={{ padding: "1.5rem 1.75rem" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow" style={{ color: "var(--accent-2)" }}>مركز قيادة طود</p>
            <div className="flex items-end gap-2 mt-2">
              <span className="ltr-nums font-bold leading-none text-white" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>{fmt(mrr)}</span>
              <span className="text-xs mb-1" style={{ color: "var(--text-3)" }}>ر.ع MRR — اشتراكات شهرية نشطة</span>
            </div>
          </div>
          <Link href="/platform-admin/clinics/new" className="btn-primary shrink-0">
            <Plus className="w-4 h-4" /> إضافة عيادة
          </Link>
        </div>
        <div className="flex items-center gap-5 mt-5 flex-wrap">
          {[
            { l: "عيادة", v: list.length },
            { l: "نشطة", v: list.filter((c) => c.status === "active").length },
            { l: "تجريبية", v: list.filter((c) => c.status === "trial").length },
            { l: "إيراد العيادات هذا الشهر", v: `${fmt(totalRevenue)} ر.ع` },
            { l: "استردّته سُرى للعيادات", v: `${fmt(recoveredTotal)} ر.ع` },
            { l: "رسالة سُرى اليوم", v: msgsTodayRes.count ?? 0 },
            { l: "حجز واتساب هذا الشهر", v: suraBookRes.count ?? 0 },
          ].map((s, i) => (
            <div key={s.l} className="flex items-baseline gap-2">
              {i > 0 && <span className="w-px h-4 -ms-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />}
              <span className="text-lg font-bold ltr-nums text-white">{s.v}</span>
              <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ صحة النظام ══ */}
      <div className="grid grid-cols-12 gap-4">
        {/* الأتمتة الحية */}
        <div className="col-span-12 lg:col-span-4 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-3">
            <Workflow className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
            <h2>الأتمتة (n8n)</h2>
            {automation && automation.errors24h === 0 && <span className="live-dot" />}
          </div>
          {automation ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between"><span style={{ color: "var(--text-3)" }}>ووركفلو مفعّل</span><span className="font-bold ltr-nums text-white">{automation.active} / {automation.total}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--text-3)" }}>تشغيلة آخر 24 ساعة</span><span className="font-bold ltr-nums text-white">{automation.runs24h}</span></div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-3)" }}>أخطاء آخر 24 ساعة</span>
                <span className="font-bold ltr-nums" style={{ color: automation.errors24h > 0 ? "#fda4b4" : "#5dd9cb" }}>{automation.errors24h}</span>
              </div>
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: "var(--text-4)" }}>
              مفتاح n8n غير مضبوط على الخادم — الحالة الحية غير متاحة هنا (الأتمتة نفسها تعمل)
            </p>
          )}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="eyebrow mb-2" style={{ fontSize: 9 }}>آخر أخطاء سُرى المسجّلة</p>
            {(sysErrors ?? []).length === 0 ? (
              <p className="text-[12px]" style={{ color: "#5dd9cb" }}>لا أخطاء ✓</p>
            ) : (
              <div className="space-y-1.5">
                {(sysErrors ?? []).map((e, i) => (
                  <p key={i} className="text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                    <span style={{ color: "#fda4b4" }}>●</span> {e.workflow_name} — {e.error_message?.slice(0, 40)} · {errAgo(e.created_at)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* تنبيهات العيادات */}
        <div className="col-span-12 lg:col-span-4 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-3">
            <AlertTriangle className="w-4 h-4" style={{ color: emergencies > 0 ? "#fda4b4" : "var(--accent-1)" }} />
            <h2>عمليات سُرى عبر المنصة</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span style={{ color: "var(--text-3)" }}>طوارئ مفتوحة</span><span className="font-bold ltr-nums" style={{ color: emergencies > 0 ? "#fda4b4" : "#fff" }}>{emergencies}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-3)" }}>شكاوى مفتوحة</span><span className="font-bold ltr-nums" style={{ color: complaints > 0 ? "#fcd34d" : "#fff" }}>{complaints}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-3)" }}>محادثات تنتظر مراجعة</span><span className="font-bold ltr-nums text-white">{hitlRes.count ?? 0}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-3)" }}>واتساب مربوط</span><span className="font-bold ltr-nums text-white">{waLinked.size} / {list.length} عيادة</span></div>
          </div>
        </div>

        {/* التجارب المنتهية */}
        <div className="col-span-12 lg:col-span-4 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-3">
            <Timer className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
            <h2>تجارب تنتهي قريباً</h2>
          </div>
          {trialsEnding.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--text-4)" }}>لا اشتراكات تجريبية حالياً</p>
          ) : (
            <div className="space-y-1.5">
              {trialsEnding.map((t) => (
                <Link key={t.clinic!.id} href={`/platform-admin/clinics/${t.clinic!.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-xl row-hover"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-[12px] font-semibold text-white truncate">{t.clinic!.name_ar ?? t.clinic!.name}</span>
                  <span className="text-[11px] font-bold ltr-nums" style={{ color: t.days <= 3 ? "#fda4b4" : "#fcd34d" }}>
                    {t.days <= 0 ? "انتهت!" : `${t.days} يوم`}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="text-[10px] mt-3" style={{ color: "var(--text-4)" }}>
            <Wallet className="w-3 h-3 inline" /> فرصة تحويلهم لاشتراك مدفوع
          </p>
        </div>
      </div>

      {/* ══ العيادات — صحة كل مستأجر ══ */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="section-title mb-4">
          <TawdBarsGlyph size={13} />
          <h2>العيادات — صحة كل عيادة</h2>
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
                <Link key={c.id} href={`/platform-admin/clinics/${c.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl flex-wrap row-hover"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Building2 style={{ color: "var(--text-2)", width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-white truncate">{c.name_ar ?? c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                      {TYPE_LABEL[c.clinic_type] ?? c.clinic_type} · باقة {c.plan}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] ltr-nums flex-wrap" style={{ color: "var(--text-3)" }}>
                    <span><span className="font-bold text-white">{patientsBy[c.id] ?? 0}</span> مريض</span>
                    <span><span className="font-bold text-white">{apptsBy[c.id] ?? 0}</span> موعد/شهر</span>
                    <span><span className="font-bold text-white">{fmt(revenueBy[c.id] ?? 0)}</span> ر.ع</span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" style={{ color: waLinked.has(c.id) ? "#5dd9cb" : "var(--text-4)" }} />
                      <span className="font-bold text-white">{msgsBy[c.id] ?? 0}</span> رسالة/7أيام
                    </span>
                  </div>
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
        )}
      </div>

      <p className="text-[10px] text-center flex items-center justify-center gap-1.5" style={{ color: "var(--text-4)" }}>
        <Bot className="w-3 h-3" /> كل الأرقام حية من قاعدة البيانات والأتمتة — واسأل سُرى عن أي تفصيل
      </p>
    </div>
  );
}
