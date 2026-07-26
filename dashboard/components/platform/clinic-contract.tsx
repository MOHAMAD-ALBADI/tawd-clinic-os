"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileSignature, Save, CheckCircle2, AlertTriangle, Wand2, Users, UserCircle,
  Stethoscope, MessageCircle,
} from "lucide-react";
import { saveEntitlements } from "@/app/actions/platform-plans";
import { NumField, F } from "@/components/ui/num-field";
import { MODULES, MODULE_GROUPS, monthlyTotal, type Entitlements } from "@/lib/modules";

export type PlanTemplate = {
  code: string; name_ar: string; description_ar: string | null;
  price_omr: number; per_doctor_omr: number; setup_fee_omr: number;
  max_doctors: number | null; max_staff: number | null;
  max_patients: number | null; max_whatsapp_msgs: number | null;
  modules: string[];
};

export type UsageNow = { doctors: number; staff: number; patients: number };

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** The consultation, written down.

    There is no fixed package: a clinic is priced on what it needs, and this is
    where that conversation becomes the contract the software enforces. A
    template fills the form in one click; everything in it is then editable,
    because the point is that the terms are this clinic's, not a tier's. */
export function ClinicContract({
  clinicId, clinicName, entitlements, templates, usage,
}: {
  clinicId: string;
  clinicName: string;
  entitlements: Entitlements;
  templates: PlanTemplate[];
  usage: UsageNow;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [source, setSource] = useState<string | null>(entitlements.sourcePlan);
  const [mods, setMods] = useState<string[]>(entitlements.modules);
  const [v, setV] = useState({
    doctors: entitlements.maxDoctors == null ? "" : String(entitlements.maxDoctors),
    staff: entitlements.maxStaff == null ? "" : String(entitlements.maxStaff),
    patients: entitlements.maxPatients == null ? "" : String(entitlements.maxPatients),
    msgs: entitlements.maxWhatsappMsgs == null ? "" : String(entitlements.maxWhatsappMsgs),
    base: String(entitlements.basePriceOmr),
    perDoc: String(entitlements.perDoctorOmr),
    setup: String(entitlements.setupFeeOmr),
    contracted: String(entitlements.contractedDoctors),
    discount: String(entitlements.discountPct),
    notes: entitlements.notes ?? "",
  });

  const monthly = useMemo(() => monthlyTotal({
    basePriceOmr: Number(v.base) || 0,
    perDoctorOmr: Number(v.perDoc) || 0,
    contractedDoctors: Number(v.contracted) || 0,
    discountPct: Number(v.discount) || 0,
  }), [v.base, v.perDoc, v.contracted, v.discount]);

  const gross = (Number(v.base) || 0) + (Number(v.perDoc) || 0) * (Number(v.contracted) || 0);

  function applyTemplate(t: PlanTemplate) {
    setSource(t.code);
    setMods(t.modules);
    setV((p) => ({
      ...p,
      doctors: t.max_doctors == null ? "" : String(t.max_doctors),
      staff: t.max_staff == null ? "" : String(t.max_staff),
      patients: t.max_patients == null ? "" : String(t.max_patients),
      msgs: t.max_whatsapp_msgs == null ? "" : String(t.max_whatsapp_msgs),
      base: String(t.price_omr),
      perDoc: String(t.per_doctor_omr),
      setup: String(t.setup_fee_omr),
      // what they have today is the honest starting point for what they'll pay for
      contracted: String(Math.max(1, usage.doctors)),
    }));
  }

  const toggleMod = (k: string) =>
    setMods((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  function save() {
    setErr(null); setWarnings([]);
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    start(async () => {
      const r = await saveEntitlements({
        clinicId, sourcePlan: source, modules: mods,
        maxDoctors: num(v.doctors), maxStaff: num(v.staff),
        maxPatients: num(v.patients), maxWhatsappMsgs: num(v.msgs),
        basePriceOmr: Number(v.base) || 0,
        perDoctorOmr: Number(v.perDoc) || 0,
        setupFeeOmr: Number(v.setup) || 0,
        contractedDoctors: Number(v.contracted) || 0,
        discountPct: Number(v.discount) || 0,
        notes: v.notes,
      });
      if (!r.ok) { setErr(r.reason); return; }
      setWarnings(r.warnings);
      setFlash(`حُفظ اتفاق ${clinicName} — ${fmt(r.monthly)} ر.ع شهرياً`);
      setTimeout(() => setFlash(null), 6000);
      router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="section-title mb-1">
        <FileSignature className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>الاتفاق والصلاحيات</h2>
      </div>
      <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
        ما اتُّفق عليه مع هذه العيادة بعد الاستشارة — وهو ما يطبّقه النظام فعلياً:
        الشاشات التي تظهر لها والحدود التي تقف عندها
      </p>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
        </div>
      )}
      {/* A cap below current usage does not remove anyone — it stops the next
          addition. Silence here would look like the save failed. */}
      {warnings.length > 0 && (
        <div className="rounded-xl px-4 py-2.5 mb-3"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)" }}>
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold mb-1" style={{ color: "#fbbf24" }}>
            <AlertTriangle className="w-3.5 h-3.5" /> حُفظ، لكن الحد أقل مما لديهم الآن
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-[11.5px]" style={{ color: "#fbbf24" }}>· {w}</p>
          ))}
          <p className="text-[11px] mt-1" style={{ color: "var(--text-4)" }}>
            لن يُحذف أحد — لكنهم لن يستطيعوا الإضافة حتى ترفع الحد
          </p>
        </div>
      )}

      {/* what they actually use — the number the conversation should start from */}
      <div className="flex items-center gap-4 flex-wrap mb-4 px-3.5 py-2.5 rounded-xl"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
        <span className="text-[11px]" style={{ color: "var(--text-4)" }}>استخدامهم الآن:</span>
        <Usage icon={Stethoscope} n={usage.doctors} label="طبيب" />
        <Usage icon={Users} n={usage.staff} label="حساب" />
        <Usage icon={UserCircle} n={usage.patients} label="مريض" />
      </div>

      <p className="eyebrow mb-2">ابدأ من قالب</p>
      <div className="flex items-center gap-1.5 flex-wrap mb-5">
        {templates.map((t) => (
          <button key={t.code} type="button" onClick={() => applyTemplate(t)}
            title={t.description_ar ?? undefined}
            className="text-[11.5px] font-bold px-3 py-2 rounded-xl transition-colors text-start"
            style={{
              background: source === t.code ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${source === t.code ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
              color: source === t.code ? "var(--accent-1)" : "var(--text-2)",
            }}>
            <Wand2 className="w-3 h-3 inline ms-1" />
            {t.name_ar}
            <span className="block text-[10px] font-normal ltr-nums mt-0.5" style={{ color: "var(--text-4)" }}>
              {fmt(t.price_omr)} ر.ع
            </span>
          </button>
        ))}
      </div>

      <p className="eyebrow mb-2">الخدمات المتاحة لهم</p>
      <div className="space-y-3 mb-5">
        {MODULE_GROUPS.map((g) => (
          <div key={g}>
            <p className="text-[10.5px] mb-1.5" style={{ color: "var(--text-4)" }}>{g}</p>
            <div className="flex flex-wrap gap-1.5">
              {MODULES.filter((m) => m.group === g).map((m) => {
                const on = mods.includes(m.key);
                return (
                  <button key={m.key} type="button" onClick={() => toggleMod(m.key)} title={m.blurb}
                    className="text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
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

      <p className="eyebrow mb-2">الحدود — فارغ = بلا حد</p>
      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        <F label="أطباء"><NumField allowDecimal={false} value={v.doctors} onChange={(x) => setV({ ...v, doctors: x })} placeholder="∞" /></F>
        <F label="حسابات"><NumField allowDecimal={false} value={v.staff} onChange={(x) => setV({ ...v, staff: x })} placeholder="∞" /></F>
        <F label="مرضى"><NumField allowDecimal={false} value={v.patients} onChange={(x) => setV({ ...v, patients: x })} placeholder="∞" /></F>
        <F label="رسائل واتساب/شهر"><NumField allowDecimal={false} value={v.msgs} onChange={(x) => setV({ ...v, msgs: x })} placeholder="∞" /></F>
      </div>

      <p className="eyebrow mb-2">السعر المتفق عليه</p>
      <div className="grid sm:grid-cols-5 gap-3 mb-3">
        <F label="أساسي (ر.ع)"><NumField value={v.base} onChange={(x) => setV({ ...v, base: x })} /></F>
        <F label="لكل طبيب"><NumField value={v.perDoc} onChange={(x) => setV({ ...v, perDoc: x })} /></F>
        <F label="عدد الأطباء المتعاقد"><NumField allowDecimal={false} value={v.contracted} onChange={(x) => setV({ ...v, contracted: x })} /></F>
        <F label="خصم %"><NumField max={100} value={v.discount} onChange={(x) => setV({ ...v, discount: x })} /></F>
        <F label="رسوم تأسيس"><NumField value={v.setup} onChange={(x) => setV({ ...v, setup: x })} /></F>
      </div>

      <div className="rounded-xl px-4 py-3 mb-4"
        style={{ background: "rgb(var(--accent-1-rgb) / 0.06)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)" }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>الشهري المستحق</span>
          <span className="text-[24px] font-black ltr-nums" style={{ color: "var(--accent-1)" }}>{fmt(monthly)}</span>
          <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>ر.ع</span>
          {Number(v.discount) > 0 && (
            <span className="text-[11px] line-through ltr-nums" style={{ color: "var(--text-4)" }}>{fmt(gross)}</span>
          )}
        </div>
        <p className="text-[10.5px] mt-1" style={{ color: "var(--text-4)" }}>
          {fmt(Number(v.base) || 0)} أساسي
          {Number(v.perDoc) > 0 && ` + ${fmt(Number(v.perDoc))} × ${v.contracted || 0} طبيب`}
          {Number(v.discount) > 0 && ` − ${v.discount}٪ خصم`}
          {" · "}يُحدَّث اشتراكهم ودخل المنصة فوراً عند الحفظ
        </p>
      </div>

      <F label="ما اتُّفق عليه في الاستشارة">
        <textarea className="field" rows={3} style={{ resize: "vertical" }}
          value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })}
          placeholder="مثال: وافقوا على التأمين لاحقاً بعد ٣ أشهر · السعر مثبَّت سنة · التدريب مشمول" />
      </F>

      <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-4)" }}>
          <MessageCircle className="w-3 h-3" />
          الخدمات المغلقة تختفي من قائمتهم، وبياناتها تبقى كما هي إن أُعيدت
        </p>
        <button className="btn-primary" disabled={pending} onClick={save}>
          <Save className="w-4 h-4" /> {pending ? "جارٍ الحفظ…" : "حفظ الاتفاق"}
        </button>
      </div>
    </div>
  );
}

function Usage({ icon: Icon, n, label }: { icon: typeof Users; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-2)" }}>
      <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
      <span className="font-black ltr-nums text-white">{n}</span> {label}
    </span>
  );
}
