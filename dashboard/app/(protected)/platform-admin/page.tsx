import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { clinicToday, clinicDayRange } from "@/lib/clinic-time";
import {
  Building2, Coins, TrendingDown, AlertTriangle, Hourglass, Bot,
  ChevronLeft, Activity, MessageSquare, Users,
} from "lucide-react";

export const metadata = { title: "نظرة المنصة — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const int = (v: number) => v.toLocaleString("en-US");

/* Rebuilt around decisions rather than around what happened to be queryable.
 *
 * The old page ran seventeen queries and rendered everything that came back, so
 * nothing was ranked: token counts sat beside revenue, and a clinic about to
 * churn looked exactly like one that signed yesterday. Four of those queries
 * pulled up to 100,000 rows to count them in JavaScript — the same truncation
 * that was already fixed twice elsewhere, waiting to under-report as the
 * platform grew.
 *
 * An operator's home page answers one question: what do I do today. So it opens
 * with the four numbers the business turns on, then ONE worklist ranked by the
 * revenue each item threatens, then quiet context.
 */
type Row = {
  id: string; name: string; name_ar: string | null; status: string;
  staff_count: number; patient_count: number; appts_30d: number;
  last_activity: string | null; sub_status: string | null;
  mrr: number; period_end: string | null; whatsapp_linked: boolean;
};

type Task = { id: string; clinic: string; text: string; bad: boolean; weight: number };

export default async function PlatformAdminPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const today = clinicToday();
  const { startUtc } = clinicDayRange(today);
  const monthStart = `${today.slice(0, 7)}-01T00:00:00`;

  /* Counts are counted by the database. None of these transfer rows. */
  const [
    { data: overview }, { data: costs }, { data: alerts },
    hitlRes, msgsRes, errRes, suraBookRes,
  ] = await Promise.all([
    sb.rpc("platform_clinic_overview"),
    sb.from("platform_costs").select("monthly_omr"),
    sb.from("sura_alerts")
      .select("id, patient_name, message")
      .eq("status", "open").order("created_at", { ascending: false }).limit(5),
    sb.from("ai_review_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", startUtc),
    sb.from("sura_errors").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    sb.from("appointments").select("id", { count: "exact", head: true })
      .eq("source_channel", "whatsapp").gte("created_at", monthStart).is("deleted_at", null),
  ]);

  const clinics = (overview ?? []) as unknown as Row[];
  const live = clinics.filter((c) => c.status === "active");
  const mrr = live.reduce((s, c) => s + Number(c.mrr ?? 0), 0);
  const monthlyCost = (costs ?? []).reduce((s, c) => s + Number(c.monthly_omr ?? 0), 0);
  const net = mrr - monthlyCost;

  const daysLeft = (c: Row) =>
    c.period_end ? Math.ceil((new Date(c.period_end).getTime() - Date.now()) / 86_400_000) : null;
  const idleFor = (c: Row) =>
    c.last_activity ? Math.floor((Date.now() - new Date(c.last_activity).getTime()) / 86_400_000) : null;

  /* Ranked by what each item threatens, not by when it happened. A clinic that
     has never opened the product is the likeliest to leave, so it outranks a
     renewal that is merely near. The clinic's own MRR breaks ties, because
     losing a 249 hurts more than losing a 49. */
  const tasks: Task[] = [];
  for (const c of clinics) {
    const label = c.name_ar ?? c.name;
    const money = Number(c.mrr ?? 0);
    const d = daysLeft(c);
    const i = idleFor(c);

    if (c.status === "suspended") {
      tasks.push({ id: c.id + "s", clinic: label, text: "موقوفة — لا تدفع ولا تستخدم", bad: true, weight: 100 });
    } else if (i === null) {
      tasks.push({ id: c.id + "n", clinic: label, text: "لم تُستخدم إطلاقاً منذ إنشائها", bad: true, weight: 90 + money });
    } else if (i >= 14) {
      tasks.push({ id: c.id + "i", clinic: label, text: `صامتة منذ ${i} يوم`, bad: true, weight: 80 + money });
    } else if (i >= 7) {
      tasks.push({ id: c.id + "q", clinic: label, text: `هدوء غير معتاد — ${i} أيام`, bad: false, weight: 40 + money });
    }

    if (d !== null && d <= 0) {
      tasks.push({ id: c.id + "x", clinic: label, text: `اشتراكها منتهٍ منذ ${Math.abs(d)} يوم`, bad: true, weight: 95 + money });
    } else if (d !== null && d <= 7) {
      tasks.push({ id: c.id + "r", clinic: label, text: `يُجدَّد خلال ${d} أيام`, bad: false, weight: 50 });
    }

    if (!c.whatsapp_linked && c.status !== "suspended") {
      tasks.push({ id: c.id + "w", clinic: label, text: "واتساب غير مربوط — سُرى معطّلة عندها", bad: false, weight: 60 });
    }
  }
  tasks.sort((a, b) => b.weight - a.weight);

  const kpis = [
    { label: "عيادات نشطة", value: int(live.length), Icon: Building2, color: "var(--accent-1)", href: "/platform-admin/clinics" },
    { label: "الدخل الشهري (ر.ع)", value: fmt(mrr), Icon: Coins, color: "var(--accent-1)", href: "/platform-admin/subscriptions" },
    { label: "التكاليف (ر.ع)", value: fmt(monthlyCost), Icon: TrendingDown, color: "#fbbf24", href: "/platform-admin/economy" },
    { label: "الصافي (ر.ع)", value: fmt(net), Icon: Activity, color: net >= 0 ? "#34d399" : "#fda4b4", href: "/platform-admin/economy" },
  ];

  const context = [
    { label: "رسائل سُرى اليوم", value: int(msgsRes.count ?? 0), Icon: MessageSquare },
    { label: "حجوزات سُرى هذا الشهر", value: int(suraBookRes.count ?? 0), Icon: Bot },
    { label: "بانتظار مراجعة بشرية", value: int(hitlRes.count ?? 0), Icon: Hourglass },
    { label: "أخطاء سُرى هذا الشهر", value: int(errRes.count ?? 0), Icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">PLATFORM</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">نظرة المنصة</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          حالة طَود كشركة — ما تكسبه، ما تدفعه، وما يحتاج تدخّلك اليوم
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="panel panel-hover" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.7rem", color: k.color }}>{k.value}</p>
          </Link>
        ))}
      </div>

      {/* An unanswered emergency in someone's clinic outranks every business
          number on this page, so it sits above them. */}
      {(alerts ?? []).length > 0 && (
        <div className="panel" style={{ padding: "1.25rem", borderColor: "rgba(248,113,113,0.3)" }}>
          <div className="section-title mb-3">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
            <h2>تنبيهات طوارئ مفتوحة في العيادات</h2>
          </div>
          <div className="space-y-1.5">
            {(alerts ?? []).map((a) => (
              <div key={a.id as string} className="px-3 py-2 rounded-xl"
                style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.16)" }}>
                <p className="text-[12.5px] font-bold text-white">{(a.patient_name as string) ?? "مريض"}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                  {String(a.message ?? "").slice(0, 110)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="section-title">
            <Hourglass className="w-3.5 h-3.5" style={{ color: tasks.length ? "#fbbf24" : "var(--accent-1)" }} />
            <h2>يحتاج تدخّلك</h2>
          </div>
          <Link href="/platform-admin/clinics" className="btn-ghost">
            كل العيادات <ChevronLeft className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
          مرتّبة بحسب ما يهدّده كل بند من دخلك — لا بحسب تاريخه
        </p>

        {tasks.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--accent-1)" }}>
            كل العيادات نشطة ومحدَّثة ✓
          </p>
        ) : (
          <div className="space-y-1.5">
            {tasks.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${t.bad ? "rgba(248,113,113,0.22)" : "rgba(251,191,36,0.2)"}`,
                }}>
                <span className="font-bold text-white text-[13px]">{t.clinic}</span>
                <span className="text-[12px]" style={{ color: t.bad ? "#fda4b4" : "#fbbf24" }}>{t.text}</span>
              </div>
            ))}
            {tasks.length > 10 && (
              <p className="text-[11px] pt-1" style={{ color: "var(--text-4)" }}>
                و<span className="ltr-nums">{tasks.length - 10}</span> بنداً آخر — افتح العيادات وفلتر «تحتاج متابعة»
              </p>
            )}
          </div>
        )}
      </div>

      {/* Context, kept quiet: real usage of the thing you sell, not vanity. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {context.map((s) => (
          <div key={s.label} className="panel" style={{ padding: "0.95rem 1.1rem" }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px]" style={{ color: "var(--text-4)" }}>{s.label}</p>
              <s.Icon className="w-3 h-3" style={{ color: "var(--text-4)" }} />
            </div>
            <p className="font-black ltr-nums text-white" style={{ fontSize: "1.15rem" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[
          ["إضافة عيادة", "/platform-admin/clinics/new"],
          ["الأتمتة", "/platform-admin/automation"],
          ["الحملات", "/platform-admin/broadcast"],
          ["الإعدادات", "/platform-admin/settings"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="btn-ghost">{label}</Link>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] ms-auto" style={{ color: "var(--text-4)" }}>
          <Users className="w-3 h-3" />
          <span className="ltr-nums">{int(clinics.reduce((s, c) => s + Number(c.patient_count ?? 0), 0))}</span> مريض في كل العيادات
        </span>
      </div>
    </div>
  );
}
