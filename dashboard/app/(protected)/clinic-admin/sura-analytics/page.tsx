import { redirect } from "next/navigation";
import { Bot, Moon, AlertTriangle, Hourglass, TrendingUp } from "lucide-react";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KpiGrid } from "@/components/dashboard/kpi-grid";

export const metadata = { title: "تحليلات سُرى — طود" };

type Analytics = {
  total_messages: number; conversations: number; patient_msgs: number;
  sura_bookings: number; recovered: number; recovered_month: number;
  waiting: number; alerts_open: number; afterhours_pct: number;
  top_services: { name: string; n: number }[];
  daily: { day: string; n: number }[];
};

export default async function SuraAnalyticsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const { data } = await sb.rpc("sura_analytics");
  const a = (data ?? {}) as Analytics;

  const conversations = Number(a.conversations ?? 0);
  const messages      = Number(a.total_messages ?? 0);
  const bookings      = Number(a.sura_bookings ?? 0);
  const recovered     = Number(a.recovered ?? 0);
  const afterhours    = Number(a.afterhours_pct ?? 0);
  const waiting       = Number(a.waiting ?? 0);
  const alerts        = Number(a.alerts_open ?? 0);
  const convRate      = conversations > 0 ? Math.round((bookings / conversations) * 100) : 0;
  const cur           = "ر.ع";
  const top           = (a.top_services ?? []).map((s) => ({ ...s, n: Number(s.n) }));
  const topMax        = Math.max(1, ...top.map((s) => s.n));
  const daily         = (a.daily ?? []).map((d) => ({ ...d, n: Number(d.n) }));
  const dailyMax      = Math.max(1, ...daily.map((d) => d.n));
  const fmt           = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="space-y-4 pb-28 animate-fade-in">

      {/* HERO */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(20,184,166,0.10) 0%, rgba(10,13,22,0.95) 55%, rgba(10,13,22,1) 100%)",
          border: "1px solid rgba(20,184,166,0.14)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.5)",
          padding: "1.9rem 2rem",
        }}
      >
        <div className="absolute pointer-events-none" style={{ width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.09) 0%, transparent 60%)", top: -180, insetInlineStart: -60 }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4" style={{ color: "#14b8a6" }} />
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(20,184,166,0.5)" }}>أداء سُرى</p>
            </div>
            <h1 className="font-black text-white leading-tight" style={{ fontSize: "clamp(1.4rem,2.4vw,1.9rem)" }}>
              سُرى تولّت <span style={{ color: "#14b8a6" }} className="ltr-nums">{fmt(conversations)}</span> محادثة
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(148,163,184,0.55)" }}>
              ردّت على {fmt(messages)} رسالة، وحوّلت {fmt(bookings)} منها إلى حجز — بدون تدخّل بشري.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full self-start" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22C55E", boxShadow: "0 0 6px #22C55E" }} />
            <span className="text-[11px] font-bold" style={{ color: "#22C55E" }}>تعمل ٢٤/٧</span>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { k: "نسبة التحويل", v: `${convRate}%`, c: "#14b8a6", s: "محادثة ← حجز" },
            { k: "إيراد مسترجَع", v: fmt(recovered), c: "#4ADE80", s: `${cur} (انتظار+استدعاء+استرجاع)` },
            { k: "خارج الدوام", v: `${afterhours}%`, c: "#38bdf8", s: "من الرسائل بعد ساعات العمل" },
            { k: "تنبيهات طوارئ", v: fmt(alerts), c: alerts > 0 ? "#F87171" : "#4ADE80", s: alerts > 0 ? "مفتوحة الآن" : "لا شيء عاجل" },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-bold" style={{ color: "rgba(148,163,184,0.45)" }}>{x.k}</p>
              <p className="font-black ltr-nums mt-0.5" style={{ fontSize: "1.6rem", color: x.c }}>{x.v}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(148,163,184,0.35)" }}>{x.s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI ROW */}
      <KpiGrid items={[
        { label: "محادثات سُرى", value: fmt(conversations), sub: `${fmt(messages)} رسالة إجمالاً`, color: "#14b8a6", glow: "rgba(20,184,166,0.08)", border: "rgba(20,184,166,0.14)", spark: daily.map((d) => d.n), iconName: "Bot" },
        { label: "حجوزات عبر سُرى", value: fmt(bookings), sub: "موعد أُنشئ تلقائياً", color: "#38bdf8", glow: "rgba(56,189,248,0.07)", border: "rgba(56,189,248,0.14)", spark: [1,2,2,3,4,5, bookings], iconName: "Calendar" },
        { label: "نسبة التحويل", value: `${convRate}%`, sub: "من المحادثات إلى حجز", color: "#5dd9cb", glow: "rgba(94,217,203,0.07)", border: "rgba(94,217,203,0.16)", spark: [40,55,60,52,68,70, convRate], iconName: "TrendingUp" },
        { label: "إيراد مسترجَع", value: fmt(recovered), sub: `${cur} — مواعيد مستردّة`, color: "#4ADE80", glow: "rgba(74,222,128,0.06)", border: "rgba(74,222,128,0.14)", spark: [10,30,45,60,90,120, recovered], iconName: "Banknote" },
      ]} />

      {/* TOP SERVICES + 7-DAY ACTIVITY */}
      <div className="grid grid-cols-12 gap-4">

        {/* Top services */}
        <div className="col-span-12 lg:col-span-6 rounded-3xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", padding: "1.5rem" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "linear-gradient(180deg,#14b8a6,#0d9488)" }} />
            <h2 className="font-bold text-white">أكثر الخدمات حجزاً عبر سُرى</h2>
          </div>
          <div className="space-y-3">
            {top.length === 0 && <p className="text-xs" style={{ color: "rgba(148,163,184,0.3)" }}>لا توجد حجوزات بعد</p>}
            {top.map((s, i) => (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>{s.name}</span>
                  <span className="text-[13px] font-black ltr-nums" style={{ color: "#14b8a6" }}>{fmt(s.n)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round((s.n / topMax) * 100)}%`, background: i === 0 ? "linear-gradient(90deg,#0f766e,#14b8a6,#5dd9cb)" : "rgba(20,184,166,0.4)", boxShadow: i === 0 ? "0 0 12px rgba(20,184,166,0.5)" : "none" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7-day activity */}
        <div className="col-span-12 lg:col-span-6 rounded-3xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", padding: "1.5rem" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "linear-gradient(180deg,#38bdf8,#0284c7)" }} />
            <h2 className="font-bold text-white">نشاط الرسائل — آخر ٧ أيام</h2>
          </div>
          <div className="flex items-end justify-between gap-2" style={{ height: 150 }}>
            {daily.length === 0 && <p className="text-xs" style={{ color: "rgba(148,163,184,0.3)" }}>لا يوجد نشاط</p>}
            {daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 justify-end h-full">
                <span className="text-[10px] font-bold ltr-nums" style={{ color: "rgba(148,163,184,0.5)" }}>{d.n}</span>
                <div className="w-full rounded-t-lg" style={{ height: `${Math.max(4, Math.round((d.n / dailyMax) * 110))}px`, background: "linear-gradient(180deg,#38bdf8,rgba(56,189,248,0.25))" }} />
                <span className="text-[9px] ltr-nums" style={{ color: "rgba(148,163,184,0.3)" }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECONDARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Moon, k: "يخدم بعد الدوام", v: `${afterhours}%`, c: "#38bdf8" },
          { icon: Hourglass, k: "في قائمة الانتظار", v: fmt(waiting), c: "#fbbf24" },
          { icon: AlertTriangle, k: "تنبيهات طوارئ", v: fmt(alerts), c: alerts > 0 ? "#F87171" : "#4ADE80" },
          { icon: TrendingUp, k: "إجمالي الرسائل", v: fmt(messages), c: "#14b8a6" },
        ].map((x) => (
          <div key={x.k} className="rounded-2xl flex items-center gap-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", padding: "1.1rem 1.3rem" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${x.c}14`, border: `1px solid ${x.c}25` }}>
              <x.icon className="w-4 h-4" style={{ color: x.c }} />
            </div>
            <div>
              <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.35rem", color: "rgba(255,255,255,0.9)" }}>{x.v}</p>
              <p className="text-[10px] mt-1" style={{ color: "rgba(148,163,184,0.45)" }}>{x.k}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
