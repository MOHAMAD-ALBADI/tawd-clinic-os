"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Layers, Plus, Pencil, Power, X, CheckCircle2, AlertTriangle, Star, Save,
} from "lucide-react";
import { savePlan, setPlanActive, type PlanInput } from "@/app/actions/platform-plans";
import { NumField, F } from "@/components/ui/num-field";
import { MODULES, MODULE_GROUPS } from "@/lib/modules";

export type PlanRow = PlanInput & { subscriberCount: number };

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const cap = (v: number | null) => (v === null ? "∞" : v.toLocaleString("en-US"));

export function PlansManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3500); }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="section-title">
          <Layers className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>قوالب الباقات</h2>
        </div>
        <button className="btn-primary" onClick={() => { setErr(null); setEditing("new"); }}>
          <Plus className="w-4 h-4" /> قالب جديد
        </button>
      </div>
      {/* The founder's own words: there are no fixed packages. These are the
          starting points a quote is built from, nothing more. */}
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        نقطة انطلاق للعرض بعد الاستشارة — تُنسخ للعيادة ثم تُعدَّل حسب اتفاقها.
        تعديل القالب لا يغيّر سعر أي عيادة قائمة
      </p>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && !editing && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((p) => (
          <div key={p.code} className="rounded-2xl p-4 flex flex-col"
            style={{
              background: p.is_default ? "rgb(var(--accent-1-rgb) / 0.05)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${p.is_default ? "rgb(var(--accent-1-rgb) / 0.28)" : "var(--hairline)"}`,
              opacity: p.is_active ? 1 : 0.55,
            }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{p.name_ar}</p>
                <p className="text-[10.5px] ltr-nums" style={{ color: "var(--text-4)" }}>{p.code}</p>
              </div>
              {p.is_default && (
                <span className="flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                  style={{ background: "rgb(var(--accent-1-rgb) / 0.14)", color: "var(--accent-1)" }}>
                  <Star className="w-2.5 h-2.5" /> الافتراضي
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[22px] font-black ltr-nums text-white">{fmt(p.price_omr)}</span>
              <span className="text-[11px]" style={{ color: "var(--text-4)" }}>ر.ع/شهر</span>
            </div>
            {p.per_doctor_omr > 0 && (
              <p className="text-[11px] mb-1" style={{ color: "var(--accent-1)" }}>
                + <span className="ltr-nums">{fmt(p.per_doctor_omr)}</span> لكل طبيب
              </p>
            )}
            {p.setup_fee_omr > 0 && (
              <p className="text-[10.5px]" style={{ color: "var(--text-4)" }}>
                رسوم تأسيس <span className="ltr-nums">{fmt(p.setup_fee_omr)}</span>
              </p>
            )}

            <div className="text-[11px] mt-3 space-y-0.5" style={{ color: "var(--text-3)" }}>
              <p><span className="ltr-nums text-white">{cap(p.max_doctors)}</span> طبيب · <span className="ltr-nums text-white">{cap(p.max_staff)}</span> حساب</p>
              <p><span className="ltr-nums text-white">{cap(p.max_patients)}</span> مريض</p>
            </div>

            <div className="flex flex-wrap gap-1 mt-2.5">
              {p.modules.slice(0, 5).map((m) => (
                <span key={m} className="text-[9.5px] px-1.5 py-0.5 rounded-md"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-3)" }}>
                  {MODULES.find((x) => x.key === m)?.label.split(" — ")[0] ?? m}
                </span>
              ))}
              {p.modules.length > 5 && (
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-md ltr-nums"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-4)" }}>
                  +{p.modules.length - 5}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 mt-auto pt-3">
              <button className="btn-ghost flex-1" onClick={() => { setErr(null); setEditing(p); }}>
                <Pencil className="w-3.5 h-3.5" /> تعديل
              </button>
              <button className="btn-ghost" disabled={pending}
                title={p.is_active ? "إخفاء من العروض الجديدة" : "إعادة للعروض"}
                onClick={() => start(async () => {
                  const r = await setPlanActive(p.code, !p.is_active);
                  if (!r.ok) { setErr(r.reason); return; }
                  ok(p.is_active ? `أُخفي ${p.name_ar} من العروض الجديدة` : `عاد ${p.name_ar} للعروض`);
                  router.refresh();
                })}>
                <Power className="w-3.5 h-3.5" style={{ color: p.is_active ? "#fbbf24" : "#34d399" }} />
              </button>
            </div>
            {p.subscriberCount > 0 && (
              <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-4)" }}>
                انطلقت منه <span className="ltr-nums">{p.subscriberCount}</span> عيادة
              </p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <PlanEditor
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => { setEditing(null); ok(`حُفظ قالب ${name}`); router.refresh(); }}
        />
      )}
    </div>
  );
}

function PlanEditor({
  plan, onClose, onSaved,
}: { plan: PlanRow | null; onClose: () => void; onSaved: (name: string) => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [v, setV] = useState({
    code: plan?.code ?? "",
    name: plan?.name_ar ?? "",
    desc: plan?.description_ar ?? "",
    price: String(plan?.price_omr ?? ""),
    perDoctor: String(plan?.per_doctor_omr ?? ""),
    setup: String(plan?.setup_fee_omr ?? ""),
    doctors: plan?.max_doctors == null ? "" : String(plan.max_doctors),
    staff: plan?.max_staff == null ? "" : String(plan.max_staff),
    patients: plan?.max_patients == null ? "" : String(plan.max_patients),
    msgs: plan?.max_whatsapp_msgs == null ? "" : String(plan.max_whatsapp_msgs),
    sort: String(plan?.sort_order ?? 0),
    active: plan?.is_active ?? true,
    isDefault: plan?.is_default ?? false,
  });
  const [mods, setMods] = useState<string[]>(plan?.modules ?? []);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const toggleMod = (k: string) =>
    setMods((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  function save() {
    setErr(null);
    start(async () => {
      const r = await savePlan({
        code: v.code, name_ar: v.name, description_ar: v.desc,
        price_omr: Number(v.price) || 0,
        per_doctor_omr: Number(v.perDoctor) || 0,
        setup_fee_omr: Number(v.setup) || 0,
        max_doctors: num(v.doctors), max_staff: num(v.staff),
        max_patients: num(v.patients), max_whatsapp_msgs: num(v.msgs),
        modules: mods,
        is_active: v.active, is_default: v.isDefault,
        sort_order: Number(v.sort) || 0,
      });
      if (!r.ok) { setErr(r.reason); return; }
      onSaved(v.name);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass my-8" style={{ maxWidth: 620, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-black text-white">{plan ? `تعديل ${plan.name_ar}` : "قالب جديد"}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-[12.5px] px-4 py-2.5 rounded-xl mb-3"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
            <AlertTriangle className="w-4 h-4" /> {err}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <F label="الاسم بالعربية">
            <input className="field" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })}
              placeholder="النمو" />
          </F>
          <F label="الرمز (إنجليزي)">
            <input className="field ltr-nums" dir="ltr" value={v.code} disabled={!!plan}
              onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="growth"
              style={plan ? { opacity: 0.55 } : undefined} />
          </F>
          <div className="sm:col-span-2">
            <F label="وصف مختصر — لك أنت أثناء الاستشارة">
              <input className="field" value={v.desc} onChange={(e) => setV({ ...v, desc: e.target.value })}
                placeholder="عيادة بطبيبين وموظف استقبال، بلا تأمين" />
            </F>
          </div>
        </div>

        <p className="eyebrow mb-2">التسعير</p>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <F label="السعر الشهري (ر.ع)">
            <NumField value={v.price} onChange={(x) => setV({ ...v, price: x })} placeholder="89" />
          </F>
          <F label="لكل طبيب إضافي">
            <NumField value={v.perDoctor} onChange={(x) => setV({ ...v, perDoctor: x })} placeholder="0" />
          </F>
          <F label="رسوم تأسيس (مرة واحدة)">
            <NumField value={v.setup} onChange={(x) => setV({ ...v, setup: x })} placeholder="0" />
          </F>
        </div>

        <p className="eyebrow mb-2">الحدود — اتركها فارغة لبلا حد</p>
        <div className="grid sm:grid-cols-4 gap-3 mb-4">
          <F label="أطباء"><NumField allowDecimal={false} value={v.doctors} onChange={(x) => setV({ ...v, doctors: x })} placeholder="∞" /></F>
          <F label="حسابات"><NumField allowDecimal={false} value={v.staff} onChange={(x) => setV({ ...v, staff: x })} placeholder="∞" /></F>
          <F label="مرضى"><NumField allowDecimal={false} value={v.patients} onChange={(x) => setV({ ...v, patients: x })} placeholder="∞" /></F>
          <F label="رسائل واتساب/شهر"><NumField allowDecimal={false} value={v.msgs} onChange={(x) => setV({ ...v, msgs: x })} placeholder="∞" /></F>
        </div>

        <p className="eyebrow mb-2">الخدمات المشمولة</p>
        <div className="space-y-3 mb-4">
          {MODULE_GROUPS.map((g) => (
            <div key={g}>
              <p className="text-[10.5px] mb-1.5" style={{ color: "var(--text-4)" }}>{g}</p>
              <div className="flex flex-wrap gap-1.5">
                {MODULES.filter((m) => m.group === g).map((m) => {
                  const on = mods.includes(m.key);
                  return (
                    <button key={m.key} type="button" onClick={() => toggleMod(m.key)} title={m.blurb}
                      className="text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg transition-colors text-start"
                      style={{
                        background: on ? "rgb(var(--accent-1-rgb) / 0.13)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.34)" : "var(--hairline)"}`,
                        color: on ? "var(--accent-1)" : "var(--text-3)",
                      }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap mb-4">
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: "var(--text-2)" }}>
            <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })}
              style={{ accentColor: "var(--accent-2)" }} />
            معروض للعيادات الجديدة
          </label>
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: "var(--text-2)" }}>
            <input type="checkbox" checked={v.isDefault} onChange={(e) => setV({ ...v, isDefault: e.target.checked })}
              style={{ accentColor: "var(--accent-2)" }} />
            نقطة الانطلاق الافتراضية
          </label>
          <div style={{ width: 90 }}>
            <F label="الترتيب"><NumField allowDecimal={false} value={v.sort} onChange={(x) => setV({ ...v, sort: x })} /></F>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending} onClick={save}>
            <Save className="w-4 h-4" /> {pending ? "جارٍ الحفظ…" : "حفظ القالب"}
          </button>
        </div>
      </div>
    </div>
  );
}
