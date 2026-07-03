"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Star, Users, TrendingUp, Coins, Settings2,
  ToggleLeft, ToggleRight, Zap, Gift, ArrowUpRight,
} from "lucide-react";
import { updateLoyaltySettings } from "@/app/actions/loyalty";
import { SparkLine } from "@/components/dashboard/spark-line";

type Settings = {
  points_per_visit: number;
  points_per_referral: number;
  redemption_rate: number;
  is_active: boolean;
} | null;

const INPUT: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(226,232,240,0.9)",
  borderRadius: "0.875rem",
  padding: "0.7rem 1rem",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  direction: "ltr",
  textAlign: "left",
  transition: "border-color 0.15s",
};

export function LoyaltyEditor({
  settings,
  stats,
}: {
  settings: Settings;
  stats: { members: number; totalBal: number; lifetimePts: number };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startSave]   = useTransition();
  const [form, setForm] = useState({
    points_per_visit:    settings?.points_per_visit    ?? 10,
    points_per_referral: settings?.points_per_referral ?? 50,
    redemption_rate:     settings?.redemption_rate     ?? 0.1,
    is_active:           settings?.is_active           ?? true,
  });

  function handleSave() {
    startSave(async () => {
      try {
        await updateLoyaltySettings({
          points_per_visit:    Number(form.points_per_visit),
          points_per_referral: Number(form.points_per_referral),
          redemption_rate:     Number(form.redemption_rate),
          is_active:           form.is_active,
        });
        setEditing(false);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  const rate       = Number(form.redemption_rate);
  const totalValue = (stats.totalBal * rate).toFixed(3);
  const hasData    = stats.members > 0;

  /* fake sparkline trends for visual weight */
  const membersSpark    = [0, 0, 1, 1, 2, stats.members > 3 ? stats.members - 1 : 1, stats.members];
  const balanceSpark    = [0, 0, 1, stats.totalBal > 10 ? stats.totalBal / 3 : 1, stats.totalBal > 10 ? stats.totalBal / 2 : 2, stats.totalBal > 10 ? stats.totalBal * 0.8 : 3, stats.totalBal];
  const lifetimeSpark   = [0, 1, 2, stats.lifetimePts > 10 ? stats.lifetimePts / 3 : 2, stats.lifetimePts > 10 ? stats.lifetimePts * 0.6 : 4, stats.lifetimePts > 10 ? stats.lifetimePts * 0.85 : 5, stats.lifetimePts];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── System status hero ── */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: form.is_active
            ? "linear-gradient(145deg, rgba(20,184,166,0.1) 0%, rgba(13,13,15,0.95) 60%)"
            : "linear-gradient(145deg, rgba(107,114,128,0.08) 0%, rgba(13,13,15,0.95) 60%)",
          border: `1px solid ${form.is_active ? "rgba(20,184,166,0.15)" : "rgba(107,114,128,0.12)"}`,
          boxShadow: form.is_active ? "0 0 40px rgba(20,184,166,0.05)" : "none",
          padding: "1.75rem 2rem",
        }}
      >
        <div className="absolute pointer-events-none" style={{ width: 350, height: 350, borderRadius: "50%", background: form.is_active ? "radial-gradient(circle, rgba(20,184,166,0.07) 0%, transparent 65%)" : "none", top: -120, insetInlineEnd: -60 }} />

        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: form.is_active
                  ? "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(13,148,136,0.15))"
                  : "rgba(107,114,128,0.1)",
                border: `1px solid ${form.is_active ? "rgba(20,184,166,0.3)" : "rgba(107,114,128,0.18)"}`,
                boxShadow: form.is_active ? "0 0 30px rgba(20,184,166,0.15)" : "none",
              }}
            >
              <Zap className="w-6 h-6" style={{ color: form.is_active ? "#14b8a6" : "#6B7280" }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-black text-white text-lg">نظام نقاط الولاء</h2>
                <span
                  className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: form.is_active ? "rgba(74,222,128,0.1)" : "rgba(107,114,128,0.08)",
                    color:      form.is_active ? "#4ADE80"               : "#9CA3AF",
                    border:     `1px solid ${form.is_active ? "rgba(74,222,128,0.2)" : "rgba(107,114,128,0.15)"}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: form.is_active ? "#4ADE80" : "#6B7280",
                      boxShadow: form.is_active ? "0 0 6px rgba(74,222,128,0.9)" : "none",
                    }}
                  />
                  {form.is_active ? "نشط" : "معطّل"}
                </span>
              </div>
              <p className="text-[12px]" style={{ color: "rgba(148,163,184,0.45)" }}>
                {form.is_active
                  ? `${form.points_per_visit} نقطة/زيارة · ${form.points_per_referral} نقطة/إحالة · قيمة النقطة ${rate.toFixed(3)} ر.ع`
                  : "النظام معطّل — لا تُمنح نقاط لحظياً"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            style={{
              background: editing ? "rgba(239,68,68,0.08)" : "rgba(20,184,166,0.08)",
              color:      editing ? "#F87171"               : "#5dd9cb",
              border:     `1px solid ${editing ? "rgba(239,68,68,0.18)" : "rgba(20,184,166,0.18)"}`,
            }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = editing ? "rgba(239,68,68,0.14)" : "rgba(20,184,166,0.14)"; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = editing ? "rgba(239,68,68,0.08)" : "rgba(20,184,166,0.08)"; }}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {editing ? "إلغاء التعديل" : "تعديل الإعدادات"}
          </button>
        </div>
      </div>

      {/* ── Edit form (slides in) ── */}
      {editing && (
        <div
          className="rounded-3xl overflow-hidden animate-fade-in"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(20,184,166,0.12)",
            padding: "1.75rem",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(20,184,166,0.45)" }}>
            تعديل إعدادات النقاط
          </p>
          <div className="grid sm:grid-cols-3 gap-5 mb-5">
            {[
              { key: "points_per_visit",    label: "نقاط الزيارة",       hint: "نقطة / زيارة" },
              { key: "points_per_referral", label: "نقاط الإحالة",       hint: "نقطة / إحالة" },
              { key: "redemption_rate",     label: "قيمة النقطة",        hint: "ر.ع / نقطة",   step: "0.001" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-[11px] font-semibold block mb-2" style={{ color: "rgba(148,163,184,0.5)" }}>
                  {f.label}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step={f.step ?? "1"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                    style={INPUT}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.4)"; e.currentTarget.style.background = "rgba(20,184,166,0.04)"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                  <span className="absolute inset-y-0 end-3 flex items-center text-[11px] pointer-events-none" style={{ color: "rgba(148,163,184,0.3)" }}>
                    {f.hint}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: form.is_active ? "rgba(74,222,128,0.06)" : "rgba(107,114,128,0.06)",
                color:      form.is_active ? "#4ADE80"               : "#9CA3AF",
                border:     `1px solid ${form.is_active ? "rgba(74,222,128,0.15)" : "rgba(107,114,128,0.12)"}`,
              }}
            >
              {form.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {form.is_active ? "النظام نشط — انقر لتعطيله" : "النظام معطّل — انقر لتفعيله"}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="py-3 rounded-2xl font-black text-sm disabled:opacity-40 transition-all"
              style={{
                background: "linear-gradient(135deg, #0d9488, #0f766e)",
                color: "white",
                boxShadow: "0 4px 24px rgba(13,148,136,0.35)",
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(13,148,136,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(13,148,136,0.35)"; e.currentTarget.style.transform = ""; }}
            >
              {saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
            </button>
          </div>
        </div>
      )}

      {/* ── 3 stat cards ── */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            label: "أعضاء الولاء",
            value: stats.members,
            sub: "مريض مسجّل في البرنامج",
            color: "#38bdf8",
            glow: "rgba(56,189,248,0.08)",
            border: "rgba(56,189,248,0.15)",
            Icon: Users,
            spark: membersSpark,
          },
          {
            label: "الرصيد الحالي",
            value: stats.totalBal,
            sub: "نقطة مجمّعة لدى المرضى",
            color: "#5dd9cb",
            glow: "rgba(94,217,203,0.07)",
            border: "rgba(94,217,203,0.14)",
            Icon: Coins,
            spark: balanceSpark,
          },
          {
            label: "مجموع المكتسب",
            value: stats.lifetimePts,
            sub: "نقطة على مر الوقت",
            color: "#4ADE80",
            glow: "rgba(74,222,128,0.07)",
            border: "rgba(74,222,128,0.14)",
            Icon: TrendingUp,
            spark: lifetimeSpark,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: `linear-gradient(145deg, ${s.glow} 0%, rgba(13,13,15,0.8) 100%)`,
              border: `1px solid ${s.border}`,
              padding: "1.4rem",
              transition: "border-color 0.2s, transform 0.2s",
            }}
            onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = s.color + "30"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = s.border; e.currentTarget.style.transform = ""; }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${s.color}18`, border: `1px solid ${s.color}28` }}
              >
                <s.Icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-end" style={{ color: "rgba(148,163,184,0.3)" }}>
                {s.label}
              </p>
            </div>
            <p
              className="text-4xl font-black ltr-nums leading-none mb-1"
              style={{
                color: s.value > 0 ? s.color : "rgba(148,163,184,0.15)",
                textShadow: s.value > 0 ? `0 0 30px ${s.color}50` : "none",
                letterSpacing: "-0.03em",
              }}
            >
              {s.value.toLocaleString("en-US")}
            </p>
            <p className="text-[11px] mb-4" style={{ color: s.value > 0 ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.2)" }}>
              {s.value > 0 ? s.sub : "لا توجد بيانات بعد"}
            </p>
            <SparkLine data={s.spark} color={s.color} width={120} height={36} />
          </div>
        ))}
      </div>

      {/* ── Points rules table ── */}
      {!editing && (
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}
          >
            <div className="flex items-center gap-2">
              <Star className="w-3.5 h-3.5" style={{ color: "#5dd9cb" }} />
              <span className="text-sm font-bold text-white">قواعد الاكتساب والاسترداد</span>
            </div>
            {hasData && rate > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(148,163,184,0.4)" }}>
                <Gift className="w-3 h-3" />
                القيمة الإجمالية:
                <span className="font-black ltr-nums" style={{ color: "#5dd9cb" }}>{totalValue} ر.ع</span>
              </div>
            )}
          </div>

          {/* rule cards */}
          <div className="grid sm:grid-cols-3 divide-x divide-x-reverse" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {[
              {
                Icon: Star,
                title: "الزيارة",
                value: form.points_per_visit,
                unit: "نقطة",
                desc: "لكل موعد مكتمل",
                color: "#14b8a6",
                bg: "rgba(20,184,166,0.04)",
              },
              {
                Icon: Users,
                title: "الإحالة",
                value: form.points_per_referral,
                unit: "نقطة",
                desc: "لكل مريض جديد تُحيله",
                color: "#38bdf8",
                bg: "rgba(56,189,248,0.04)",
              },
              {
                Icon: Coins,
                title: "القيمة",
                value: rate.toFixed(3),
                unit: "ر.ع",
                desc: "قيمة استرداد كل نقطة",
                color: "#4ADE80",
                bg: "rgba(74,222,128,0.04)",
              },
            ].map((r) => (
              <div key={r.title} className="px-6 py-5 text-center" style={{ background: r.bg }}>
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: `${r.color}15`, border: `1px solid ${r.color}22` }}
                >
                  <r.Icon className="w-4 h-4" style={{ color: r.color }} />
                </div>
                <p className="text-3xl font-black ltr-nums leading-none mb-1" style={{ color: r.color, textShadow: `0 0 25px ${r.color}50` }}>
                  {r.value}
                </p>
                <p className="text-[11px] font-bold mb-1" style={{ color: `${r.color}90` }}>
                  {r.unit} / {r.title}
                </p>
                <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.3)" }}>
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
