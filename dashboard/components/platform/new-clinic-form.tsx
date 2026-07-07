"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, AlertCircle, Copy, KeyRound, Wand2, Stethoscope, Plus, Trash2 } from "lucide-react";
import { createClinic } from "@/app/actions/platform";

const TYPES = [
  { key: "dental",        label: "أسنان 🦷" },
  { key: "cosmetic",      label: "تجميل ✨" },
  { key: "dermatology",   label: "جلدية" },
  { key: "pediatric",     label: "أطفال" },
  { key: "ophthalmology", label: "عيون" },
  { key: "general",       label: "عام" },
];

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return "Tw@" + p;
}

export function NewClinicForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ clinicId: string; email: string; password: string; services: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    nameAr: "",
    name: "",
    clinicType: "dental",
    phone: "",
    adminName: "",
    adminEmail: "",
    adminPassword: genPassword(),
  });
  const [doctors, setDoctors] = useState<{ name: string; email: string; password: string }[]>([]);
  const [withFrontdesk, setWithFrontdesk] = useState(false);
  const [frontdesk, setFrontdesk] = useState({ email: "", password: genPassword() });
  const [teamInfo, setTeamInfo] = useState<{ doctors: number; frontdesk: boolean }>({ doctors: 0, frontdesk: false });

  const addDoctor = () => setDoctors((d) => [...d, { name: "", email: "", password: genPassword() }]);
  const patchDoctor = (i: number, p: Partial<{ name: string; email: string; password: string }>) =>
    setDoctors((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const removeDoctor = (i: number) => setDoctors((d) => d.filter((_, j) => j !== i));

  function submit() {
    setErr(null);
    start(async () => {
      try {
        const r = await createClinic({
          ...form,
          doctors: doctors.filter((d) => d.name.trim() && d.email.trim()),
          frontdesk: withFrontdesk && frontdesk.email.trim() ? frontdesk : null,
        });
        if (!r.ok) { setErr(r.reason); return; }
        setTeamInfo({ doctors: r.doctorsCreated ?? 0, frontdesk: !!r.frontdeskCreated });
        setDone({ clinicId: r.clinicId, email: r.adminEmail, password: form.adminPassword, services: r.servicesSeeded });
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  function copyCreds() {
    if (!done) return;
    navigator.clipboard.writeText(
      `منصة طود — بيانات دخول عيادة ${form.nameAr}\nhttps://tawd-clinic-os.vercel.app\nالبريد: ${done.email}\nكلمة المرور: ${done.password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (done) {
    return (
      <div className="panel-feature text-center" style={{ padding: "2.25rem", maxWidth: 640 }}>
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--accent-1)" }} />
        <p className="text-xl font-bold text-white mb-2">عيادة «{form.nameAr}» جاهزة 🎉</p>
        <p className="text-sm mb-5" style={{ color: "var(--text-2)" }}>
          أُنشئت بكل شيء: الإعدادات، دوام افتراضي، نظام الولاء الذكي، اشتراك تجريبي 14 يوماً،
          {done.services} خدمات حسب التخصص
          {teamInfo.doctors > 0 && `، ${teamInfo.doctors} حساب طبيب`}
          {teamInfo.frontdesk && "، وحساب استقبال+محاسبة"}
        </p>

        <div className="rounded-2xl p-4 text-start mx-auto" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", maxWidth: 420 }}>
          <p className="eyebrow mb-3">بيانات دخول مدير العيادة — سلّمها له</p>
          <div className="space-y-1.5 text-[13px]">
            <p style={{ color: "var(--text-2)" }}>البريد: <span className="font-bold ltr-nums text-white">{done.email}</span></p>
            <p style={{ color: "var(--text-2)" }}>كلمة المرور: <span className="font-bold ltr-nums text-white">{done.password}</span></p>
          </div>
          <button onClick={copyCreds} className="btn-ghost w-full mt-3">
            <Copy className="w-3.5 h-3.5" />
            {copied ? "نُسخت ✓" : "نسخ البيانات"}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <a href={`/platform-admin/clinics/${done.clinicId}`} className="btn-primary">فتح ملف العيادة</a>
          <a href="/platform-admin/clinics/new" className="btn-ghost">إضافة عيادة أخرى</a>
        </div>
        <p className="text-[11px] mt-4" style={{ color: "var(--text-4)" }}>
          الخطوة التالية من ملف العيادة: إضافة الموظفين + ربط واتساب سُرى
        </p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: "1.5rem", maxWidth: 640 }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-5">
        <Building2 className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        بيانات العيادة الجديدة
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>اسم العيادة بالعربية *</label>
            <input value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} className="field" placeholder="عيادة النور للأسنان" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>بالإنجليزية *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="field" dir="ltr" placeholder="Alnoor Dental Clinic" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold block mb-2" style={{ color: "var(--text-3)" }}>نوع العيادة — يحدد الخدمات الجاهزة</label>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setForm((p) => ({ ...p, clinicType: t.key }))}
                className="text-[12px] font-bold px-3 py-2 rounded-xl transition-colors"
                style={{
                  background: form.clinicType === t.key ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${form.clinicType === t.key ? "rgba(45,212,191,0.35)" : "rgba(255,255,255,0.08)"}`,
                  color: form.clinicType === t.key ? "#5dd9cb" : "var(--text-2)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>هاتف العيادة (اختياري)</label>
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="field ltr-nums" dir="ltr" placeholder="+968…" />
        </div>

        <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="eyebrow mb-3 flex items-center gap-1.5">
            <KeyRound className="w-3 h-3" /> حساب مدير العيادة
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الاسم *</label>
              <input value={form.adminName} onChange={(e) => setForm((p) => ({ ...p, adminName: e.target.value }))} className="field" />
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>البريد الإلكتروني *</label>
              <input value={form.adminEmail} onChange={(e) => setForm((p) => ({ ...p, adminEmail: e.target.value }))} className="field ltr-nums" dir="ltr" placeholder="admin@clinic.om" />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>كلمة المرور *</label>
            <div className="flex gap-2">
              <input value={form.adminPassword} onChange={(e) => setForm((p) => ({ ...p, adminPassword: e.target.value }))} className="field flex-1 ltr-nums" dir="ltr" />
              <button onClick={() => setForm((p) => ({ ...p, adminPassword: genPassword() }))} className="btn-ghost shrink-0" title="توليد كلمة قوية">
                <Wand2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* الفريق — مرن: أي عدد أطباء + استقبال اختياري */}
        <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow flex items-center gap-1.5">
              <Stethoscope className="w-3 h-3" /> فريق العيادة (اختياري — أضف بأي عدد)
            </p>
            <button onClick={addDoctor} className="btn-ghost" style={{ padding: "0.3rem 0.75rem", fontSize: 11 }}>
              <Plus className="w-3.5 h-3.5" /> طبيب
            </button>
          </div>

          {doctors.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
              <input value={d.name} onChange={(e) => patchDoctor(i, { name: e.target.value })} className="field" placeholder={`اسم الطبيب ${i + 1}`} style={{ fontSize: 12 }} />
              <input value={d.email} onChange={(e) => patchDoctor(i, { email: e.target.value })} className="field ltr-nums" dir="ltr" placeholder="doctor@clinic.om" style={{ fontSize: 12 }} />
              <button onClick={() => removeDoctor(i)} className="w-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(244,63,94,0.07)", color: "#fda4b4" }} aria-label="حذف الطبيب">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {doctors.length > 0 && (
            <p className="text-[10px] mb-2" style={{ color: "var(--text-4)" }}>كلمات مرور الأطباء تتولّد تلقائياً وتظهر في ملف العيادة</p>
          )}

          <label className="flex items-center gap-2 text-[12px] cursor-pointer mt-2" style={{ color: "var(--text-2)" }}>
            <input type="checkbox" checked={withFrontdesk} onChange={(e) => setWithFrontdesk(e.target.checked)} className="accent-teal-500" />
            إنشاء حساب استقبال + محاسبة (لعيادة بكمبيوتر واحد)
          </label>
          {withFrontdesk && (
            <input value={frontdesk.email} onChange={(e) => setFrontdesk((p) => ({ ...p, email: e.target.value }))}
              className="field mt-2 ltr-nums" dir="ltr" placeholder="frontdesk@clinic.om" style={{ fontSize: 12 }} />
          )}
        </div>

        {err && (
          <p className="text-[12px] font-semibold flex items-center gap-1.5 rounded-lg px-3 py-2"
            style={{ background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
          </p>
        )}

        <button onClick={submit} disabled={pending} className="btn-primary w-full">
          <Building2 className="w-4 h-4" />
          {pending ? "جارٍ تجهيز العيادة…" : "إنشاء العيادة كاملة"}
        </button>
        <p className="text-[10px] text-center" style={{ color: "var(--text-4)" }}>
          ينشئ تلقائياً: الإعدادات + الدوام + نظام الولاء + اشتراك تجريبي 14 يوم + خدمات التخصص + حساب المدير
        </p>
      </div>
    </div>
  );
}
