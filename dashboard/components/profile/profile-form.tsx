"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User, Save, CheckCircle2, AlertTriangle, KeyRound, LogOut, ShieldAlert, Mail,
} from "lucide-react";
import { F } from "@/components/ui/num-field";
import {
  updateMyProfile, changeMyPassword, signOutEverywhere, type ProfileInput,
} from "@/app/actions/profile";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { ROLE_LABEL_AR, toAppRole, type AppRole } from "@/lib/staff-roles";

export type MyProfile = {
  name: string; name_ar: string; email: string; phone: string;
  job_title: string; specialty: string; bio: string;
  avatar_url: string | null; all_roles: string[];
};

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [v, setV] = useState<ProfileInput>({
    name: profile.name,
    name_ar: profile.name_ar,
    phone: profile.phone,
    job_title: profile.job_title,
    specialty: profile.specialty,
    bio: profile.bio,
  });
  const set = <K extends keyof ProfileInput>(k: K) => (val: ProfileInput[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const roles = [...new Set(profile.all_roles.map(toAppRole).filter((r): r is AppRole => !!r))];
  const isDoctor = roles.includes("doctor");

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3000); }

  function save() {
    setErr(null);
    start(async () => {
      try {
        const r = await updateMyProfile(v);
        if (!r.ok) { setErr(r.reason); return; }
        ok("حُفظت بياناتك");
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const display = v.name_ar || v.name || "—";

  return (
    <div className="space-y-4">
      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}

      {/* ── identity ── */}
      <div className="panel" style={{ padding: "1.5rem" }}>
        <AvatarPicker currentUrl={profile.avatar_url} name={display} />

        <div className="flex items-center gap-2 flex-wrap mt-5 pt-5" style={{ borderTop: "1px solid var(--hairline)" }}>
          <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-3)" }}>
            <Mail className="w-3.5 h-3.5" /> {profile.email}
          </span>
          <span className="w-px h-3.5" style={{ background: "var(--hairline)" }} />
          {roles.map((r) => (
            <span key={r} className="badge badge-brand text-[10px]">{ROLE_LABEL_AR[r]}</span>
          ))}
          <span className="text-[11px] ms-auto" style={{ color: "var(--text-4)" }}>
            البريد والصلاحيات يغيّرهما مدير العيادة
          </span>
        </div>
      </div>

      {/* ── details ── */}
      <div className="panel" style={{ padding: "1.5rem" }}>
        <div className="section-title mb-4">
          <User className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>بياناتك</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <F label="الاسم بالعربية">
            <input className="field" value={v.name_ar} onChange={(e) => set("name_ar")(e.target.value)} placeholder="د. سالم الحارثي" />
          </F>
          <F label="الاسم بالإنجليزية">
            <input className="field" dir="ltr" value={v.name} onChange={(e) => set("name")(e.target.value)} placeholder="Salim Al Harthy" />
          </F>
          <F label="رقم الجوال">
            <input className="field ltr-nums" dir="ltr" inputMode="tel" value={v.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="+968…" />
          </F>
          <F label="المسمّى الوظيفي">
            <input className="field" value={v.job_title} onChange={(e) => set("job_title")(e.target.value)} placeholder="استشاري" />
          </F>
          {isDoctor && (
            <F label="التخصص">
              <input className="field" value={v.specialty} onChange={(e) => set("specialty")(e.target.value)} placeholder="تقويم أسنان" />
            </F>
          )}
        </div>

        <div className="mt-4">
          <F label="نبذة مختصرة">
            <textarea className="field" rows={3} style={{ resize: "none" }}
              value={v.bio} onChange={(e) => set("bio")(e.target.value)}
              placeholder="تظهر لزملائك في العيادة" />
          </F>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mt-4"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
            <AlertTriangle className="w-4 h-4" /> {err}
          </div>
        )}

        <div className="flex justify-end mt-5">
          <button className="btn-primary" disabled={pending} onClick={save}>
            <Save className="w-4 h-4" /> {pending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      <SecurityPanel />
    </div>
  );
}

/* ── security ── */
function SecurityPanel() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  function changePw() {
    setErr(null); setFlash(null);
    start(async () => {
      try {
        const r = await changeMyPassword(current, next);
        if (!r.ok) { setErr(r.reason); return; }
        setCurrent(""); setNext("");
        setFlash("غُيّرت كلمة المرور");
        setTimeout(() => setFlash(null), 3000);
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  function outEverywhere() {
    setErr(null);
    start(async () => {
      try {
        const r = await signOutEverywhere();
        if (!r.ok) { setErr(r.reason); return; }
        // this session was ended too, so send them to the login screen
        router.push("/login");
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="section-title mb-1">
        <KeyRound className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>الأمان</h2>
      </div>
      <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
        حسابك يفتح ملفات مرضى — لا تشارك كلمة المرور، وغيّرها فوراً إن شككت أن أحداً يعرفها
      </p>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <F label="كلمة المرور الحالية">
          <input className="field" dir="ltr" type="password" autoComplete="current-password"
            value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
        </F>
        <F label="كلمة المرور الجديدة — ٨ أحرف على الأقل">
          <input className="field" dir="ltr" type="password" autoComplete="new-password"
            value={next} onChange={(e) => setNext(e.target.value)} placeholder="••••••••" />
        </F>
      </div>

      {err && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mt-4"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button className="btn-primary" disabled={pending || !current || !next} onClick={changePw}>
          تغيير كلمة المرور
        </button>
      </div>

      <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--hairline)" }}>
        {confirmOut ? (
          <div className="flex items-start gap-3 flex-wrap">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
            <p className="text-[12.5px] flex-1 min-w-[200px]" style={{ color: "var(--text-2)" }}>
              سيُغلق حسابك على كل الأجهزة بما فيها هذا — وستحتاج لتسجيل الدخول من جديد.
            </p>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={() => setConfirmOut(false)}>إلغاء</button>
              <button className="btn-danger" disabled={pending} onClick={outEverywhere}>تأكيد</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[13px] font-bold text-white">إنهاء الجلسات على كل الأجهزة</p>
              <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-4)" }}>
                استخدمها إذا سجّلت دخولك على جهاز لم يعد بحوزتك
              </p>
            </div>
            <button className="btn-ghost" onClick={() => setConfirmOut(true)}>
              <LogOut className="w-3.5 h-3.5" /> إنهاء الجلسات
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
