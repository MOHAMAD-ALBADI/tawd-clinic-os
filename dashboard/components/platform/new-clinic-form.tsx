"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, AlertCircle, AlertTriangle, Copy, KeyRound, Wand2, Stethoscope, Plus, Trash2 } from "lucide-react";
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

type StaffDraft = { name: string; email: string; password: string; roles: string[]; specialty: string };

const ROLE_CHOICES: { key: string; label: string }[] = [
  { key: "doctor",       label: "طبيب" },
  { key: "receptionist", label: "استقبال" },
  { key: "accountant",   label: "محاسبة" },
  { key: "clinic_admin", label: "إدارة" },
];

/* The shapes a clinic actually comes in. Each is just a starting role set —
   every one stays editable after it is added. */
const PRESETS: { label: string; roles: string[]; hint: string }[] = [
  { label: "طبيب",              roles: ["doctor"],                      hint: "" },
  { label: "استقبال",           roles: ["receptionist"],                hint: "" },
  { label: "محاسب",             roles: ["accountant"],                  hint: "" },
  { label: "استقبال + محاسبة",  roles: ["receptionist", "accountant"],  hint: "حساب واحد لجهاز واحد" },
];

export function NewClinicForm({ plans }: { plans: { code: string; name_ar: string; price_omr: number }[] }) {
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
  const [plan, setPlan] = useState(plans[0]?.code ?? "starter");
  const [trialDays, setTrialDays] = useState("14");
  /* One list, any shape of clinic. The old form offered "N doctors" plus a
     single account hardwired to receptionist+accountant, which fit exactly one
     kind of clinic. A practice with a separate receptionist AND a separate
     accountant could not be set up at all, and neither could a manager who also
     treats patients. Every member is now a person with a role set — the same
     model the clinic's own staff screen uses. */
  const [staff, setStaff] = useState<StaffDraft[]>([]);
  const [teamInfo, setTeamInfo] = useState<{ doctors: number; frontdesk: boolean }>({ doctors: 0, frontdesk: false });
  /* createClinic seeds eight tables and returns a `warnings` list for the parts
     that failed — a doctor account rejected for a duplicate email, a service
     template that did not insert. Nothing read that list, so a half-built clinic
     reported success and the gap surfaced later as "why does this clinic have no
     services". Handing over credentials for an incomplete clinic is worse than
     an outright failure, because nobody goes looking. */
  const [warnings, setWarnings] = useState<string[]>([]);
  /* Passwords are generated server-side and shown once, here. Creating logins
     and never revealing them makes every staff account unusable. */
  const [creds, setCreds] = useState<{ name: string; email: string; password: string; roles: string[] }[]>([]);

  const addStaff = (roles: string[]) =>
    setStaff((d) => [...d, { name: "", email: "", password: genPassword(), roles, specialty: "" }]);
  const patchStaff = (i: number, p: Partial<StaffDraft>) =>
    setStaff((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const removeStaff = (i: number) => setStaff((d) => d.filter((_, j) => j !== i));
  const toggleRole = (i: number, role: string) =>
    setStaff((d) => d.map((x, j) => {
      if (j !== i) return x;
      const has = x.roles.includes(role);
      // never leave a member with no role at all
      const roles = has ? x.roles.filter((r) => r !== role) : [...x.roles, role];
      return { ...x, roles: roles.length ? roles : x.roles };
    }));

  function submit() {
    setErr(null);
    start(async () => {
      try {
        const r = await createClinic({
          ...form,
          plan,
          trialDays: Number(trialDays) || 0,
          staff: staff.filter((m) => m.name.trim() && m.email.trim()),
        });
        if (!r.ok) { setErr(r.reason); return; }
        setTeamInfo({ doctors: r.doctorsCreated ?? 0, frontdesk: !!r.frontdeskCreated });
        setWarnings(r.warnings ?? []);
        setCreds(r.staffCreds ?? []);
        setDone({ clinicId: r.clinicId, email: r.adminEmail, password: form.adminPassword, services: r.servicesSeeded });
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  /* Copies every account, not just the manager's. The staff passwords are
     generated server-side and shown exactly once — if they are not carried out
     of this screen, those logins are unusable and have to be reset one by one. */
  function copyCreds() {
    if (!done) return;
    const lines = [
      `منصة طود — بيانات دخول عيادة ${form.nameAr}`,
      "https://tawd-clinic-os.vercel.app",
      "",
      "مدير العيادة",
      `البريد: ${done.email}`,
      `كلمة المرور: ${done.password}`,
      ...creds.flatMap((c) => ["", c.name, `البريد: ${c.email}`, `كلمة المرور: ${c.password}`]),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (done) {
    return (
      <div className="panel-feature text-center" style={{ padding: "2.25rem", maxWidth: 640 }}>
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4"
          style={{ color: warnings.length ? "#fbbf24" : "var(--accent-1)" }} />
        <p className="text-xl font-bold text-white mb-2">
          {warnings.length ? `عيادة «${form.nameAr}» أُنشئت — مع ملاحظات` : `عيادة «${form.nameAr}» جاهزة 🎉`}
        </p>
        <p className="text-sm mb-5" style={{ color: "var(--text-2)" }}>
          {/* The trial length and the team shape are choices now, so this line
              has to report what was actually created rather than a fixed script. */}
          الإعدادات، دوام افتراضي، نظام الولاء الذكي،
          {Number(trialDays) > 0 ? ` تجربة ${trialDays} يوماً، ` : " اشتراك نشط من اليوم، "}
          {done.services} خدمات حسب التخصص
          {teamInfo.doctors > 0 && `، ${teamInfo.doctors} حساب طبيب`}
          {teamInfo.frontdesk && "، وحسابات الاستقبال/المحاسبة"}
        </p>

        {warnings.length > 0 && (
          <div className="rounded-2xl p-4 text-start mx-auto mb-5"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)", maxWidth: 420 }}>
            <p className="flex items-center gap-2 text-[12.5px] font-bold mb-2" style={{ color: "#fbbf24" }}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              لم يكتمل كل شيء — عالجها قبل تسليم العيادة
            </p>
            <ul className="space-y-1 text-[11.5px]" style={{ color: "var(--text-2)" }}>
              {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </div>
        )}

        <div className="rounded-2xl p-4 text-start mx-auto" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", maxWidth: 460 }}>
          <p className="eyebrow mb-3">بيانات الدخول — تظهر مرة واحدة فقط</p>

          <div className="rounded-xl px-3 py-2.5 mb-2"
            style={{ background: "rgb(var(--accent-1-rgb) / 0.07)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)" }}>
            <p className="text-[11px] font-bold mb-1" style={{ color: "var(--accent-1)" }}>مدير العيادة</p>
            <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
              <span className="font-bold ltr-nums text-white">{done.email}</span>
            </p>
            <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
              كلمة المرور: <span className="font-bold ltr-nums text-white">{done.password}</span>
            </p>
          </div>

          {/* Every generated password, shown once. Creating logins and never
              revealing them leaves accounts nobody can sign into. */}
          {creds.map((c) => (
            <div key={c.email} className="rounded-xl px-3 py-2.5 mb-2"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
              <p className="text-[11px] font-bold mb-1 text-white">
                {c.name}
                <span className="font-normal" style={{ color: "var(--text-4)" }}>
                  {" · "}{c.roles.map((r) => ROLE_CHOICES.find((x) => x.key === r)?.label ?? r).join(" + ")}
                </span>
              </p>
              <p className="text-[12.5px] ltr-nums" style={{ color: "var(--text-2)" }}>{c.email}</p>
              <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                كلمة المرور: <span className="font-bold ltr-nums text-white">{c.password}</span>
              </p>
            </div>
          ))}

          <button onClick={copyCreds} className="btn-primary w-full mt-2">
            <Copy className="w-3.5 h-3.5" />
            {copied ? "نُسخت كل البيانات ✓" : `نسخ كل البيانات (${creds.length + 1} حساب)`}
          </button>
          <p className="text-[10.5px] mt-2 text-center" style={{ color: "#fbbf24" }}>
            انسخها الآن — لا يمكن استرجاعها بعد إغلاق هذه الشاشة
          </p>
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
                  background: form.clinicType === t.key ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${form.clinicType === t.key ? "rgb(var(--accent-1-rgb) / 0.35)" : "rgba(255,255,255,0.08)"}`,
                  color: form.clinicType === t.key ? "var(--accent-1)" : "var(--text-2)",
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
        {/* الباقة */}
        <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="eyebrow mb-2">الباقة والتجربة</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <select className="field" value={plan} onChange={(e) => setPlan(e.target.value)} style={{ cursor: "pointer" }}>
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name_ar} — {p.price_omr.toFixed(3)} ر.ع/شهر
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              {["0", "14", "30"].map((d) => (
                <button key={d} type="button" onClick={() => setTrialDays(d)}
                  className="text-[11.5px] font-bold px-2.5 py-2 rounded-xl transition-colors"
                  style={{
                    background: trialDays === d ? "rgb(var(--accent-1-rgb) / 0.14)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${trialDays === d ? "rgb(var(--accent-1-rgb) / 0.35)" : "var(--hairline)"}`,
                    color: trialDays === d ? "var(--accent-1)" : "var(--text-3)",
                  }}>
                  {d === "0" ? "بلا تجربة" : `${d} يوم`}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-4)" }}>
            سعر الباقة يُنسخ على اشتراك هذه العيادة — تغييره لاحقاً في الكتالوج لا يحرّكها
            {trialDays === "0" && " · بلا تجربة يعني أنها تبدأ نشطة ومحسوبة في دخلك من اليوم"}
          </p>
        </div>

        {/* الفريق — أي تركيبة */}
        <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="eyebrow flex items-center gap-1.5 mb-1">
            <Stethoscope className="w-3 h-3" /> فريق العيادة
          </p>
          <p className="text-[10.5px] mb-3" style={{ color: "var(--text-4)" }}>
            المدير أعلاه يُنشأ دائماً — أضف هنا بقية الفريق بأي تركيبة
          </p>

          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => addStaff(p.roles)}
                className="btn-ghost" style={{ padding: "0.3rem 0.7rem", fontSize: 11 }}
                title={p.hint || undefined}>
                <Plus className="w-3 h-3" /> {p.label}
              </button>
            ))}
          </div>

          {staff.map((m, i) => (
            <div key={i} className="rounded-xl p-2.5 mb-2"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                <input value={m.name} onChange={(e) => patchStaff(i, { name: e.target.value })}
                  className="field" placeholder="الاسم" style={{ fontSize: 12 }} />
                <input value={m.email} onChange={(e) => patchStaff(i, { email: e.target.value })}
                  className="field ltr-nums" dir="ltr" placeholder="name@clinic.om" style={{ fontSize: 12 }} />
                <button onClick={() => removeStaff(i)} className="w-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(244,63,94,0.07)", color: "#fda4b4" }} aria-label="حذف">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {ROLE_CHOICES.map((r) => {
                  const on = m.roles.includes(r.key);
                  return (
                    <button key={r.key} type="button" onClick={() => toggleRole(i, r.key)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                      style={{
                        background: on ? "rgb(var(--accent-1-rgb) / 0.14)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.35)" : "var(--hairline)"}`,
                        color: on ? "var(--accent-1)" : "var(--text-4)",
                      }}>
                      {r.label}
                    </button>
                  );
                })}
                {m.roles.includes("doctor") && (
                  <input value={m.specialty} onChange={(e) => patchStaff(i, { specialty: e.target.value })}
                    className="field" placeholder="التخصص" style={{ fontSize: 11, width: 120, padding: "0.3rem 0.6rem" }} />
                )}
              </div>
            </div>
          ))}

          {staff.length > 0 && (
            <p className="text-[10px]" style={{ color: "var(--text-4)" }}>
              كلمات المرور تتولّد تلقائياً وتظهر في ملف العيادة · الدور الأول هو اللوحة التي تُفتح عند الدخول
            </p>
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
          ينشئ تلقائياً: الإعدادات + الدوام + نظام الولاء + الاشتراك على الباقة المختارة + خدمات التخصص + كل الحسابات
        </p>
      </div>
    </div>
  );
}
