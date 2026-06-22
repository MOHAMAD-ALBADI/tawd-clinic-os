"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Clock, Banknote, CheckCircle2, Edit3, X, Save } from "lucide-react";
import { updateClinicInfo } from "@/app/actions/clinic-settings";

const TIMEZONES = [
  { value: "Asia/Muscat",  label: "مسقط (GMT+4)" },
  { value: "Asia/Riyadh", label: "الرياض (GMT+3)" },
  { value: "Asia/Dubai",  label: "دبي (GMT+4)" },
  { value: "Asia/Kuwait", label: "الكويت (GMT+3)" },
  { value: "Asia/Bahrain",label: "البحرين (GMT+3)" },
  { value: "Asia/Qatar",  label: "الدوحة (GMT+3)" },
];

const COUNTRIES = [
  { value: "OM", label: "عُمان" },
  { value: "SA", label: "المملكة العربية السعودية" },
  { value: "AE", label: "الإمارات العربية المتحدة" },
  { value: "KW", label: "الكويت" },
  { value: "BH", label: "البحرين" },
  { value: "QA", label: "قطر" },
];

const CURRENCIES = [
  { value: "OMR", label: "ريال عُماني (OMR)" },
  { value: "SAR", label: "ريال سعودي (SAR)" },
  { value: "AED", label: "درهم إماراتي (AED)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
];

type Props = {
  name: string;
  name_ar: string | null;
  country_code: string;
  timezone: string;
  currency: string;
  vat_enabled: boolean;
  is_active: boolean;
  plan: string;
};

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(226,232,240,0.95)",
  borderRadius: "0.75rem",
  padding: "0.65rem 1rem",
  width: "100%",
  fontSize: "14px",
  outline: "none",
};

export function ClinicInfoForm(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name:         props.name,
    name_ar:      props.name_ar ?? "",
    country_code: props.country_code,
    timezone:     props.timezone,
    currency:     props.currency as "OMR" | "SAR" | "AED" | "USD",
    vat_enabled:  props.vat_enabled,
  });

  function field<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSave() {
    if (!form.name.trim()) { setError("اسم العيادة (إنجليزي) مطلوب"); return; }
    setError(null);
    startTransition(async () => {
      try {
        await updateClinicInfo(form);
        router.refresh();
        setDone(true);
        setEditing(false);
        setTimeout(() => setDone(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  const planLabel: Record<string, string> = {
    starter: "Starter", growth: "Growth", pro: "Pro", enterprise: "Enterprise",
  };

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <Building2 className="w-4 h-4" style={{ color: "#5dd9cb" }} />
          </div>
          <div>
            <h3 className="font-bold text-white">معلومات العيادة</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>البيانات الأساسية للعيادة في النظام</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
            style={props.is_active
              ? { background: "rgba(16,185,129,0.1)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }
              : { background: "rgba(239,68,68,0.1)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            {props.is_active ? "نشط" : "غير نشط"}
          </span>
          {/* Plan badge */}
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "rgba(20,184,166,0.1)", color: "#2dd4bf", border: "1px solid rgba(20,184,166,0.2)" }}>
            {planLabel[props.plan] ?? props.plan}
          </span>

          {done ? (
            <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl" style={{ color: "#34D399", background: "rgba(16,185,129,0.1)" }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> تم الحفظ
            </span>
          ) : editing ? (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setError(null); setForm({ name: props.name, name_ar: props.name_ar ?? "", country_code: props.country_code, timezone: props.timezone, currency: props.currency as "OMR"|"SAR"|"AED"|"USD", vat_enabled: props.vat_enabled }); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.7)" }}>
                <X className="w-3.5 h-3.5" /> إلغاء
              </button>
              <button onClick={handleSave} disabled={pending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "white" }}>
                <Save className="w-3.5 h-3.5" />
                {pending ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
              style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", color: "#5dd9cb" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.1)"; }}>
              <Edit3 className="w-3.5 h-3.5" /> تعديل
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm py-2.5 px-4 rounded-xl mb-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name EN */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "rgba(148,163,184,0.6)" }}>
            <Building2 className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
            اسم العيادة (إنجليزي) *
          </label>
          {editing ? (
            <input value={form.name} onChange={(e) => field("name", e.target.value)} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
          ) : (
            <div className="px-4 py-2.5 rounded-xl text-sm text-white" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>{props.name}</div>
          )}
        </div>

        {/* Name AR */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "rgba(148,163,184,0.6)" }}>
            <Building2 className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
            اسم العيادة (عربي)
          </label>
          {editing ? (
            <input value={form.name_ar} onChange={(e) => field("name_ar", e.target.value)} style={inputStyle} dir="rtl"
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
          ) : (
            <div className="px-4 py-2.5 rounded-xl text-sm text-white" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>{props.name_ar ?? "—"}</div>
          )}
        </div>

        {/* Country */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "rgba(148,163,184,0.6)" }}>
            <Globe className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
            الدولة
          </label>
          {editing ? (
            <select value={form.country_code} onChange={(e) => field("country_code", e.target.value)} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <div className="px-4 py-2.5 rounded-xl text-sm text-white" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {COUNTRIES.find((c) => c.value === props.country_code)?.label ?? props.country_code}
            </div>
          )}
        </div>

        {/* Timezone */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "rgba(148,163,184,0.6)" }}>
            <Clock className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
            المنطقة الزمنية
          </label>
          {editing ? (
            <select value={form.timezone} onChange={(e) => field("timezone", e.target.value)} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          ) : (
            <div className="px-4 py-2.5 rounded-xl text-sm text-white" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {TIMEZONES.find((t) => t.value === props.timezone)?.label ?? props.timezone}
            </div>
          )}
        </div>

        {/* Currency */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "rgba(148,163,184,0.6)" }}>
            <Banknote className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
            العملة الافتراضية
          </label>
          {editing ? (
            <select value={form.currency} onChange={(e) => field("currency", e.target.value as "OMR"|"SAR"|"AED"|"USD")} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <div className="px-4 py-2.5 rounded-xl text-sm text-white" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {CURRENCIES.find((c) => c.value === props.currency)?.label ?? props.currency}
            </div>
          )}
        </div>

        {/* VAT */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "rgba(148,163,184,0.6)" }}>
            <Banknote className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
            ضريبة القيمة المضافة (VAT)
          </label>
          <div
            className="px-4 py-2.5 rounded-xl flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-sm" style={{ color: form.vat_enabled ? "#34D399" : "rgba(148,163,184,0.6)" }}>
              {form.vat_enabled ? "مفعّل" : "معطّل"}
            </span>
            {editing && (
              <button
                onClick={() => field("vat_enabled", !form.vat_enabled)}
                className="relative w-11 h-6 rounded-full transition-all"
                style={{ background: form.vat_enabled ? "#14b8a6" : "rgba(255,255,255,0.1)" }}
              >
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: form.vat_enabled ? "calc(100% - 1.375rem)" : "2px" }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
