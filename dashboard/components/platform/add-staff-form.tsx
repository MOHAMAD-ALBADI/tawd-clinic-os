"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, CheckCircle2, AlertCircle, Wand2 } from "lucide-react";
import { createStaffAccount } from "@/app/actions/platform";
import type { Role } from "@/types/tawd";

const ROLE_OPTIONS: { key: Role; label: string }[] = [
  { key: "clinic_admin", label: "مدير العيادة" },
  { key: "doctor",       label: "طبيب" },
  { key: "receptionist", label: "استقبال" },
  { key: "accountant",   label: "محاسبة" },
];

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return "Tw@" + p;
}

/** Add a staff account — select MULTIPLE roles for one-PC clinics (استقبال+محاسبة). */
export function AddStaffForm({ clinicId }: { clinicId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: genPassword(),
    roles: ["receptionist"] as Role[],
  });

  const toggleRole = (r: Role) =>
    setForm((p) => ({
      ...p,
      roles: p.roles.includes(r) ? p.roles.filter((x) => x !== r) : [...p.roles, r],
    }));

  function submit() {
    setErr(null);
    start(async () => {
      try {
        const r = await createStaffAccount(clinicId, form);
        if (!r.ok) { setErr(r.reason); return; }
        setDone({ email: r.email, password: form.password });
        setForm({ name: "", email: "", password: genPassword(), roles: ["receptionist"] });
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
        <UserPlus className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        إضافة موظف
      </h3>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-3)" }}>
        اختر أكثر من دور لنفس الحساب — مثالي لعيادة بكمبيوتر واحد (استقبال + محاسبة)
      </p>

      {done && (
        <div className="rounded-xl px-3 py-2.5 mb-3" style={{ background: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.2)" }}>
          <p className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "#5dd9cb" }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> أُنشئ الحساب —
            <span className="ltr-nums">{done.email}</span> / <span className="ltr-nums">{done.password}</span>
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الاسم *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="field" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>البريد *</label>
            <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="field ltr-nums" dir="ltr" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold block mb-2" style={{ color: "var(--text-3)" }}>الأدوار (يمكن اختيار أكثر من دور)</label>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map((r) => {
              const on = form.roles.includes(r.key);
              return (
                <button
                  key={r.key}
                  onClick={() => toggleRole(r.key)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: on ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? "rgba(45,212,191,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: on ? "#5dd9cb" : "var(--text-3)",
                  }}
                >
                  {on ? "✓ " : ""}{r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>كلمة المرور *</label>
          <div className="flex gap-2">
            <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="field flex-1 ltr-nums" dir="ltr" />
            <button onClick={() => setForm((p) => ({ ...p, password: genPassword() }))} className="btn-ghost shrink-0">
              <Wand2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {err && (
          <p className="text-[12px] font-semibold flex items-center gap-1.5 rounded-lg px-3 py-2"
            style={{ background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
          </p>
        )}

        <button onClick={submit} disabled={pending} className="btn-primary w-full">
          <UserPlus className="w-4 h-4" />
          {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
        </button>
      </div>
    </div>
  );
}
