"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, CheckCircle2, Edit3, X, Save, AlertTriangle, Camera, Trash2, Loader2,
} from "lucide-react";
import { updateClinicInfo, saveClinicLogo, removeClinicLogo } from "@/app/actions/clinic-settings";

const TIMEZONES = [
  { value: "Asia/Muscat",  label: "مسقط (GMT+4)" },
  { value: "Asia/Riyadh",  label: "الرياض (GMT+3)" },
  { value: "Asia/Dubai",   label: "دبي (GMT+4)" },
  { value: "Asia/Kuwait",  label: "الكويت (GMT+3)" },
  { value: "Asia/Bahrain", label: "البحرين (GMT+3)" },
  { value: "Asia/Qatar",   label: "الدوحة (GMT+3)" },
];
const COUNTRIES = [
  { value: "OM", label: "عُمان" },
  { value: "SA", label: "السعودية" },
  { value: "AE", label: "الإمارات" },
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
const PLAN_LABEL: Record<string, string> = {
  starter: "Starter", growth: "Growth", pro: "Pro", enterprise: "Enterprise",
};

type Props = {
  name: string;
  name_ar: string | null;
  country_code: string;
  timezone: string;
  currency: string;
  vat_enabled: boolean;
  is_active: boolean;
  plan: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
};

const MAX_EDGE = 512;

/** Downscale in the browser, as the avatar picker does — a logo is rendered at
    invoice size, not at the 4000px the phone camera produced. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
  return blob ? new File([blob], "logo.webp", { type: "image/webp" }) : file;
}

export function ClinicInfoForm(props: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const initial = () => ({
    name: props.name,
    name_ar: props.name_ar ?? "",
    country_code: props.country_code,
    timezone: props.timezone,
    currency: props.currency as "OMR" | "SAR" | "AED" | "USD",
    vat_enabled: props.vat_enabled,
    phone: props.phone ?? "",
    address: props.address ?? "",
  });
  const [form, setForm] = useState(initial);

  function field<K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    if (!form.name.trim()) { setError("اسم العيادة (إنجليزي) مطلوب"); return; }
    setError(null);
    start(async () => {
      try {
        await updateClinicInfo(form);
        router.refresh();
        setDone(true);
        setEditing(false);
        setTimeout(() => setDone(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  async function pickLogo(file: File) {
    setError(null);
    setBusy(true);
    try {
      const small = await shrink(file);
      setPreview(URL.createObjectURL(small));
      const fd = new FormData();
      fd.append("logo", small);
      const r = await saveClinicLogo(fd);
      if (!r.ok) { setError(r.reason); setPreview(null); return; }
      router.refresh();
    } catch {
      setError("تعذّر تجهيز الصورة");
      setPreview(null);
    } finally { setBusy(false); }
  }

  function dropLogo() {
    setError(null);
    start(async () => {
      const r = await removeClinicLogo();
      if (!r.ok) { setError(r.reason); return; }
      setPreview(null);
      router.refresh();
    });
  }

  const logo = preview ?? props.logo_url;
  const working = pending || busy;

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="section-title mb-1">
            <Building2 className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>معلومات العيادة</h2>
          </div>
          <p className="text-[11.5px]" style={{ color: "var(--text-4)" }}>
            الاسم والشعار والعنوان يظهرون على الفواتير وصفحة الحجز التي يفتحها المريض
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge" style={props.is_active
            ? { background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }
            : { background: "rgba(248,113,113,0.1)", color: "#fda4b4", border: "1px solid rgba(248,113,113,0.22)" }}>
            {props.is_active ? "نشطة" : "غير نشطة"}
          </span>
          <span className="badge badge-mute">{PLAN_LABEL[props.plan] ?? props.plan}</span>

          {done ? (
            <span className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-xl"
              style={{ color: "var(--accent-1)", background: "rgb(var(--accent-1-rgb) / 0.1)" }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> حُفظت
            </span>
          ) : editing ? (
            <>
              <button className="btn-ghost" onClick={() => { setEditing(false); setError(null); setForm(initial()); }}>
                <X className="w-3.5 h-3.5" /> إلغاء
              </button>
              <button className="btn-primary" disabled={working} onClick={save}>
                <Save className="w-3.5 h-3.5" /> {pending ? "جارٍ الحفظ…" : "حفظ"}
              </button>
            </>
          ) : (
            <button className="btn-ghost" onClick={() => setEditing(true)}>
              <Edit3 className="w-3.5 h-3.5" /> تعديل
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-[12.5px] px-4 py-2.5 rounded-xl mb-4"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Logo saves on pick rather than waiting for the form — it is a file, not
          a field, and pairing it with a Save button invites losing the upload. */}
      <div className="flex items-center gap-4 mb-5 pb-5" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              background: "rgb(var(--accent-1-rgb) / 0.1)",
              border: "1px solid rgb(var(--accent-1-rgb) / 0.25)",
            }}>
            {logo
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={logo} alt="" className="w-full h-full object-contain" />
              : <Building2 className="w-7 h-7" style={{ color: "var(--accent-1)" }} />}
          </div>
          {working && (
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent-1)" }} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white mb-1.5">شعار العيادة</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className="btn-ghost" disabled={working} onClick={() => inputRef.current?.click()}>
              <Camera className="w-3.5 h-3.5" /> {logo ? "تغيير الشعار" : "رفع الشعار"}
            </button>
            {logo && (
              <button type="button" className="btn-ghost" disabled={working} onClick={dropLogo}>
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} /> حذف
              </button>
            )}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--text-4)" }}>
            يُطبع على الفواتير — JPG أو PNG أو WEBP، ويُصغَّر تلقائياً قبل الرفع
          </p>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickLogo(f); }} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Row label="اسم العيادة (إنجليزي)" required shown={props.name} editing={editing}>
          <input className="field" value={form.name} onChange={(e) => field("name", e.target.value)} dir="ltr" />
        </Row>

        <Row label="اسم العيادة (عربي)" shown={props.name_ar ?? "—"} editing={editing}>
          <input className="field" value={form.name_ar} onChange={(e) => field("name_ar", e.target.value)} />
        </Row>

        <Row label="هاتف العيادة" editing={editing}
          shown={props.phone ?? "لم يُضَف — ولا يظهر على الفواتير"}>
          <input className="field ltr-nums" value={form.phone} dir="ltr" placeholder="+968 9xxxxxxx"
            onChange={(e) => field("phone", e.target.value)} />
        </Row>

        <Row label="العنوان" editing={editing}
          shown={props.address ?? "لم يُضَف — ولا يظهر لمريض يبحث عنكم"}>
          <input className="field" value={form.address} placeholder="الولاية، المحافظة، وصف الموقع"
            onChange={(e) => field("address", e.target.value)} />
        </Row>

        <Row label="الدولة" editing={editing}
          shown={COUNTRIES.find((c) => c.value === props.country_code)?.label ?? props.country_code}>
          <select className="field" value={form.country_code} onChange={(e) => field("country_code", e.target.value)}>
            {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Row>

        <Row label="المنطقة الزمنية" editing={editing}
          shown={TIMEZONES.find((t) => t.value === props.timezone)?.label ?? props.timezone}>
          <select className="field" value={form.timezone} onChange={(e) => field("timezone", e.target.value)}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Row>

        <Row label="العملة" editing={editing}
          shown={CURRENCIES.find((c) => c.value === props.currency)?.label ?? props.currency}>
          <select className="field" value={form.currency}
            onChange={(e) => field("currency", e.target.value as "OMR" | "SAR" | "AED" | "USD")}>
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Row>

        <div>
          <label className="block text-[11.5px] mb-1.5" style={{ color: "var(--text-3)" }}>
            ضريبة القيمة المضافة
          </label>
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
            <span className="text-[13px]" style={{ color: form.vat_enabled ? "#34d399" : "var(--text-3)" }}>
              {form.vat_enabled ? "مفعّلة — ٥٪ على الخدمات الخاضعة" : "معطّلة"}
            </span>
            {editing && (
              <button type="button" onClick={() => field("vat_enabled", !form.vat_enabled)}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ background: form.vat_enabled ? "var(--accent-2)" : "rgba(255,255,255,0.1)" }}>
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

function Row({
  label, shown, editing, required, children,
}: {
  label: string; shown?: string; editing: boolean; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11.5px] mb-1.5" style={{ color: "var(--text-3)" }}>
        {label}{required && <span style={{ color: "#fda4b4" }}> *</span>}
      </label>
      {editing ? children : (
        <div className="px-4 py-2.5 rounded-xl text-[13px] truncate"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)", color: "#ffffff" }}>
          {shown}
        </div>
      )}
    </div>
  );
}
