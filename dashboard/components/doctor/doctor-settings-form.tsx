"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRound, KeyRound, Save, CheckCircle2 } from "lucide-react";
import { updateMyProfile, changeMyPassword } from "@/app/actions/doctor";

export function DoctorSettingsForm({
  nameAr,
  nameEn,
  email,
}: {
  nameAr: string;
  nameEn: string;
  email: string;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [profile, setProfile] = useState({ ar: nameAr, en: nameEn });
  const [pw, setPw] = useState({ p1: "", p2: "" });
  const [done, setDone] = useState<"" | "profile" | "password">("");
  const [err, setErr] = useState<string | null>(null);

  /* in-app messages — a native alert() pops a browser dialog outside the RTL dark UI */
  function saveProfile() {
    setErr(null);
    startSave(async () => {
      try {
        await updateMyProfile(profile.ar, profile.en);
        setDone("profile"); setTimeout(() => setDone(""), 2500);
        router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "تعذّر حفظ البيانات"); }
    });
  }

  function savePassword() {
    if (pw.p1.length < 8) { setErr("كلمة المرور 8 أحرف على الأقل"); return; }
    if (pw.p1 !== pw.p2) { setErr("كلمتا المرور غير متطابقتين"); return; }
    setErr(null);
    startSave(async () => {
      try {
        await changeMyPassword(pw.p1);
        setPw({ p1: "", p2: "" });
        setDone("password"); setTimeout(() => setDone(""), 2500);
      } catch (e) { setErr(e instanceof Error ? e.message : "تعذّر تغيير كلمة المرور"); }
    });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      {err && (
        <p className="lg:col-span-2 text-[12.5px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}>
          {err}
        </p>
      )}

      {/* profile */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
          <UserRound className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          بياناتي
        </h3>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-3)" }}>
          اسمك كما يظهر للمرضى في رسائل سُرى والحجوزات
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الاسم بالعربية</label>
            <input value={profile.ar} onChange={(e) => setProfile((p) => ({ ...p, ar: e.target.value }))} className="field" placeholder="د. سارة البلوشي" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الاسم بالإنجليزية</label>
            <input value={profile.en} onChange={(e) => setProfile((p) => ({ ...p, en: e.target.value }))} className="field" placeholder="Dr. Sara Al-Balushi" dir="ltr" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>البريد الإلكتروني</label>
            <input value={email} disabled className="field ltr-nums" style={{ opacity: 0.55 }} dir="ltr" />
          </div>
          <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">
            {done === "profile" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-3.5 h-3.5" />}
            {done === "profile" ? "تم الحفظ ✓" : saving ? "جارٍ الحفظ…" : "حفظ بياناتي"}
          </button>
        </div>
      </div>

      {/* password */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
          <KeyRound className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          تغيير كلمة المرور
        </h3>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-3)" }}>
          8 أحرف على الأقل — يفضّل مزيج حروف وأرقام
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>كلمة المرور الجديدة</label>
            <input type="password" value={pw.p1} onChange={(e) => setPw((p) => ({ ...p, p1: e.target.value }))} className="field" dir="ltr" autoComplete="new-password" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>تأكيد كلمة المرور</label>
            <input type="password" value={pw.p2} onChange={(e) => setPw((p) => ({ ...p, p2: e.target.value }))} className="field" dir="ltr" autoComplete="new-password" />
          </div>
          <button onClick={savePassword} disabled={saving || !pw.p1} className="btn-primary w-full">
            {done === "password" ? <CheckCircle2 className="w-4 h-4" /> : <KeyRound className="w-3.5 h-3.5" />}
            {done === "password" ? "تم التغيير ✓" : saving ? "جارٍ…" : "تغيير كلمة المرور"}
          </button>
        </div>
      </div>
    </div>
  );
}
