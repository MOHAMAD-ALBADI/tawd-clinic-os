"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Star, Users, Coins, Settings2, ToggleLeft, ToggleRight, Zap, Gift,
  CheckCircle2, AlertTriangle, Calculator, CalendarClock, Percent,
} from "lucide-react";
import { updateLoyaltySettings, type LoyaltyInput } from "@/app/actions/loyalty";
import { NumField, F } from "@/components/ui/num-field";

export type LoyaltySettings = {
  is_active: boolean;
  points_per_omr: number;
  redemption_rate: number;
  min_redeem_points: number;
  max_redeem_pct: number;
  expiry_months: number;
} | null;

const fmt3 = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/* Defaults match the engine's own fallbacks in app/actions/accountant.ts, so an
   unconfigured clinic sees the behaviour it will actually get. */
const DEFAULTS = {
  is_active: true,
  points_per_omr: 1,
  redemption_rate: 0.03,
  min_redeem_points: 100,
  max_redeem_pct: 30,
  expiry_months: 6,
};

export function LoyaltyEditor({
  settings,
  stats,
}: {
  settings: LoyaltySettings;
  stats: { members: number; totalBal: number };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  /* Held as strings while being edited so Arabic-Indic digits and a half-typed
     "0." survive until submit. */
  const init = settings ?? DEFAULTS;
  const [active, setActive] = useState(init.is_active);
  const [form, setForm] = useState({
    points_per_omr: String(init.points_per_omr),
    redemption_rate: String(init.redemption_rate),
    min_redeem_points: String(init.min_redeem_points),
    max_redeem_pct: String(init.max_redeem_pct),
    expiry_months: String(init.expiry_months),
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const num = (k: keyof typeof form) => Number(form[k]) || 0;

  function save() {
    setErr(null);
    const payload: LoyaltyInput = {
      is_active: active,
      points_per_omr: num("points_per_omr"),
      redemption_rate: num("redemption_rate"),
      min_redeem_points: num("min_redeem_points"),
      max_redeem_pct: num("max_redeem_pct"),
      expiry_months: num("expiry_months"),
    };
    if (payload.redemption_rate <= 0) { setErr("قيمة النقطة يجب أن تكون أكبر من صفر"); return; }
    if (payload.min_redeem_points < 1) { setErr("الحد الأدنى للاستبدال نقطة واحدة على الأقل"); return; }
    if (payload.max_redeem_pct < 1 || payload.max_redeem_pct > 100) { setErr("نسبة الخصم بين ١ و ١٠٠"); return; }

    startSave(async () => {
      try {
        const r = await updateLoyaltySettings(payload);
        if (!r.ok) { setErr(r.reason); return; }
        setEditing(false);
        setFlash("حُفظت قواعد الولاء");
        setTimeout(() => setFlash(null), 3000);
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  /* A worked example beats a table of parameters: this is what a patient who
     spends 100 rials actually gets back. */
  const exampleSpend = 100;
  const earned = Math.floor(exampleSpend * num("points_per_omr"));
  const earnedValue = earned * num("redemption_rate");
  const cashbackPct = exampleSpend > 0 ? (earnedValue / exampleSpend) * 100 : 0;
  const balanceValue = stats.totalBal * num("redemption_rate");

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">LOYALTY</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">نقاط الولاء</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          تُمنح النقاط تلقائياً عند الدفع، وتُستبدل عند الكاشير ضمن الحدود التي تضعها هنا
        </p>
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}

      {/* ── status hero ── */}
      <div className="relative rounded-3xl overflow-hidden"
        style={{
          background: active
            ? "linear-gradient(145deg, rgb(var(--accent-2-rgb) / 0.1) 0%, rgba(13,13,15,0.95) 60%)"
            : "linear-gradient(145deg, rgba(107,114,128,0.08) 0%, rgba(13,13,15,0.95) 60%)",
          border: `1px solid ${active ? "rgb(var(--accent-2-rgb) / 0.15)" : "rgba(107,114,128,0.12)"}`,
          padding: "1.75rem 2rem",
        }}>
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: active ? "rgb(var(--accent-2-rgb) / 0.2)" : "rgba(107,114,128,0.1)",
                border: `1px solid ${active ? "rgb(var(--accent-2-rgb) / 0.3)" : "rgba(107,114,128,0.18)"}`,
              }}>
              <Zap className="w-6 h-6" style={{ color: active ? "var(--accent-2)" : "#6B7280" }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-black text-white text-lg">برنامج النقاط</h2>
                <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: active ? "rgba(74,222,128,0.1)" : "rgba(107,114,128,0.08)",
                    color: active ? "#4ADE80" : "#9CA3AF",
                    border: `1px solid ${active ? "rgba(74,222,128,0.2)" : "rgba(107,114,128,0.15)"}`,
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#4ADE80" : "#6B7280" }} />
                  {active ? "نشط" : "معطّل"}
                </span>
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                {active
                  ? <>كل ريال يُدفع = <span className="ltr-nums font-bold">{num("points_per_omr")}</span> نقطة · النقطة تساوي <span className="ltr-nums font-bold">{fmt3(num("redemption_rate"))}</span> ر.ع</>
                  : "النظام معطّل — لا تُمنح نقاط ولا تُستبدل"}
              </p>
            </div>
          </div>

          <button onClick={() => { setErr(null); setEditing(!editing); }}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            style={{
              background: editing ? "rgba(239,68,68,0.08)" : "rgb(var(--accent-2-rgb) / 0.08)",
              color: editing ? "#F87171" : "var(--accent-1)",
              border: `1px solid ${editing ? "rgba(239,68,68,0.18)" : "rgb(var(--accent-2-rgb) / 0.18)"}`,
            }}>
            <Settings2 className="w-3.5 h-3.5" />
            {editing ? "إلغاء التعديل" : "تعديل القواعد"}
          </button>
        </div>
      </div>

      {/* ── editor ── */}
      {editing && (
        <div className="panel animate-fade-in" style={{ padding: "1.5rem", border: "1px solid rgb(var(--accent-2-rgb) / 0.14)" }}>
          <p className="eyebrow mb-5">قواعد الاكتساب والاستبدال</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <F label="نقاط لكل ريال يُدفع">
              <NumField value={form.points_per_omr} onChange={set("points_per_omr")} />
              <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
                يُحتسب على المبلغ المدفوع فعلاً، لا على قيمة الفاتورة
              </span>
            </F>
            <F label="قيمة النقطة (ر.ع)">
              <NumField value={form.redemption_rate} onChange={set("redemption_rate")} />
              <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
                كم ريالاً تخصم كل نقطة عند الاستبدال
              </span>
            </F>
            <F label="أقل رصيد للاستبدال (نقطة)">
              <NumField value={form.min_redeem_points} allowDecimal={false} onChange={set("min_redeem_points")} />
              <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
                يمنع استبدال مبالغ تافهة عند الكاشير
              </span>
            </F>
            <F label="أقصى خصم من الفاتورة (٪)">
              <NumField value={form.max_redeem_pct} allowDecimal={false} max={100} onChange={set("max_redeem_pct")} />
              <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
                سقف يضمن ألّا تُدفع فاتورة كاملة بالنقاط
              </span>
            </F>
            <F label="انتهاء الرصيد الخامل (شهر)">
              <NumField value={form.expiry_months} allowDecimal={false} onChange={set("expiry_months")} />
              <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
                رصيد لم يتحرك طوال هذه المدة يُصفَّر
              </span>
            </F>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-4"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
              <AlertTriangle className="w-4 h-4" /> {err}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={() => setActive((a) => !a)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors"
              style={{
                background: active ? "rgba(74,222,128,0.06)" : "rgba(107,114,128,0.06)",
                color: active ? "#4ADE80" : "#9CA3AF",
                border: `1px solid ${active ? "rgba(74,222,128,0.15)" : "rgba(107,114,128,0.12)"}`,
              }}>
              {active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {active ? "النظام نشط — انقر لتعطيله" : "النظام معطّل — انقر لتفعيله"}
            </button>
            <button onClick={save} disabled={saving} className="btn-primary justify-center py-3">
              {saving ? "جارٍ الحفظ…" : "حفظ القواعد"}
            </button>
          </div>
        </div>
      )}

      {/* ── what the rules mean in money ── */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="section-title mb-4">
          <Calculator className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>مثال: مريض دفع ١٠٠ ر.ع</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: "يكسب", value: `${earned}`, unit: "نقطة", Icon: Star, color: "#38bdf8" },
            { label: "تساوي", value: fmt3(earnedValue), unit: "ر.ع", Icon: Coins, color: "var(--accent-1)" },
            { label: "أي عائد", value: `${cashbackPct.toFixed(1)}%`, unit: "من قيمة ما دفع", Icon: Percent, color: "#4ADE80" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl px-4 py-3.5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px]" style={{ color: "var(--text-4)" }}>{c.label}</span>
                <c.Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
              </div>
              <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.6rem", color: c.color }}>{c.value}</p>
              <p className="text-[10.5px] mt-1" style={{ color: "var(--text-4)" }}>{c.unit}</p>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] mt-4 pt-3" style={{ color: "var(--text-3)", borderTop: "1px solid var(--hairline)" }}>
          يبدأ الاستبدال من <span className="ltr-nums font-bold text-white">{num("min_redeem_points")}</span> نقطة،
          وبحد أقصى <span className="ltr-nums font-bold text-white">{num("max_redeem_pct")}٪</span> من قيمة أي فاتورة،
          ويُصفَّر الرصيد بعد <span className="ltr-nums font-bold text-white">{num("expiry_months")}</span> أشهر بلا حركة.
        </p>
      </div>

      {/* ── real balances only ── */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: "أعضاء لديهم رصيد", value: String(stats.members), Icon: Users, color: "#38bdf8" },
          { label: "إجمالي النقاط القائمة", value: stats.totalBal.toLocaleString("en-US"), Icon: Star, color: "var(--accent-1)" },
          { label: "التزام مالي مقابلها (ر.ع)", value: fmt3(balanceValue), Icon: Gift, color: "#fbbf24" },
        ].map((s) => (
          <div key={s.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{s.label}</p>
              <s.Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
            </div>
            <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.7rem", color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-4)" }}>
        <CalendarClock className="w-3 h-3" />
        «الالتزام المالي» هو ما تساويه النقاط القائمة لو استُبدلت كلها — تكلفة مؤجلة على العيادة
      </p>
    </div>
  );
}
