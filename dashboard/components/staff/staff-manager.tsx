"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, X, Pencil, Trash2, KeyRound, Power, Mail, Phone, Percent,
  CheckCircle2, AlertTriangle, Stethoscope, ShieldAlert,
} from "lucide-react";
import {
  createStaffMember, updateStaffMember, setStaffActive, deleteStaffMember, resetStaffPassword,
} from "@/app/actions/staff";
import { APP_ROLES, ROLE_LABEL_AR, ROLE_COLOR, toAppRole, type AppRole } from "@/lib/staff-roles";
import { NumField, F } from "@/components/ui/num-field";

export type StaffRow = {
  id: string; name: string; name_ar: string; email: string; phone: string;
  role: string; all_roles: string[]; is_active: boolean;
  commission_rate: number; specialty: string;
};

const appRoles = (rs: string[]): AppRole[] =>
  [...new Set(rs.map(toAppRole).filter((r): r is AppRole => !!r))];

export function StaffManager({ staff, selfId }: { staff: StaffRow[]; selfId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffRow | "new" | null>(null);
  const [pwFor, setPwFor] = useState<StaffRow | null>(null);
  const [confirmDel, setConfirmDel] = useState<StaffRow | null>(null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3500); }
  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string, after?: () => void) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        after?.(); ok(msg); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const active = staff.filter((s) => s.is_active);
  const disabled = staff.filter((s) => !s.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label: "الفريق", value: staff.length, color: "#5dd9cb" },
            { label: "الأطباء", value: staff.filter((s) => appRoles(s.all_roles).includes("doctor")).length, color: "#38bdf8" },
            { label: "نشطون", value: active.length, color: "#4ADE80" },
            ...(disabled.length ? [{ label: "معطّلون", value: disabled.length, color: "#F87171" }] : []),
          ].map((s) => (
            <div key={s.label} className="pill">
              <span className="pill-dot" style={{ background: s.color }} />
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{s.label}</span>
              <span className="text-[13px] font-black ltr-nums" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => { setErr(null); setEditing("new"); }}>
          <UserPlus className="w-4 h-4" /> إضافة موظف
        </button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && !editing && !pwFor && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {staff.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center gap-3 py-20">
          <UserPlus className="w-6 h-6" style={{ color: "var(--accent-1)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>لا يوجد موظفون — أضف أول عضو في الفريق</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["الموظف", "الأدوار", "التواصل", "العمولة", "الحالة", ""].map((h) => (
                    <th key={h} className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((m) => {
                  const rs = appRoles(m.all_roles);
                  const primary = rs[0] ?? "doctor";
                  const display = m.name_ar || m.name;
                  const isSelf = m.id === selfId;
                  return (
                    <tr key={m.id} style={{ borderTop: "1px solid var(--hairline-2)", opacity: m.is_active ? 1 : 0.55 }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black shrink-0"
                            style={{ background: `${ROLE_COLOR[primary]}14`, color: ROLE_COLOR[primary], border: `1px solid ${ROLE_COLOR[primary]}25` }}>
                            {display.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white truncate">{display}</span>
                              {isSelf && <span className="badge badge-brand text-[9px]">أنت</span>}
                            </div>
                            {m.specialty && (
                              <span className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>
                                <Stethoscope className="w-3 h-3" />{m.specialty}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {rs.map((r) => (
                            <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${ROLE_COLOR[r]}12`, color: ROLE_COLOR[r], border: `1px solid ${ROLE_COLOR[r]}28` }}>
                              {ROLE_LABEL_AR[r]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text-3)" }}>
                          <Mail className="w-3 h-3 shrink-0" />{m.email}
                        </span>
                        {m.phone && (
                          <span className="flex items-center gap-1.5 text-[11.5px] ltr-nums mt-0.5" style={{ color: "var(--text-4)" }}>
                            <Phone className="w-3 h-3 shrink-0" />{m.phone}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {m.commission_rate > 0 ? (
                          <span className="flex items-center gap-1 text-[12px] font-bold ltr-nums" style={{ color: "var(--accent-1)" }}>
                            <Percent className="w-3 h-3" />{m.commission_rate}
                          </span>
                        ) : <span style={{ color: "var(--text-4)" }}>—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: m.is_active ? "#4ADE80" : "#F87171" }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
                          {m.is_active ? "نشط" : "معطّل"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-ghost" disabled={pending} title="تعديل"
                            onClick={() => { setErr(null); setEditing(m); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-ghost" disabled={pending} title="كلمة مرور جديدة"
                            onClick={() => { setErr(null); setPwFor(m); }}>
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-ghost" disabled={pending || isSelf}
                            title={isSelf ? "لا يمكنك تعطيل حسابك" : m.is_active ? "تعطيل الدخول" : "إعادة التفعيل"}
                            onClick={() => run(() => setStaffActive(m.id, !m.is_active),
                              m.is_active ? "عُطّل الحساب ومُنع الدخول" : "أُعيد تفعيل الحساب")}>
                            <Power className="w-3.5 h-3.5" style={{ color: m.is_active ? "#fbbf24" : "#4ADE80" }} />
                          </button>
                          <button className="btn-ghost" disabled={pending || isSelf}
                            title={isSelf ? "لا يمكنك حذف حسابك" : "حذف"}
                            onClick={() => { setErr(null); setConfirmDel(m); }}>
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <StaffForm
          member={editing === "new" ? null : editing}
          pending={pending}
          error={err}
          onClose={() => setEditing(null)}
          onSubmit={(v, password) =>
            editing === "new"
              ? run(() => createStaffMember({ ...v, password }),
                  password ? "أُضيف الموظف — يمكنه الدخول الآن" : "أُرسلت الدعوة على البريد",
                  () => setEditing(null))
              : run(() => updateStaffMember(editing.id, v), "حُفظ التعديل", () => setEditing(null))
          }
        />
      )}

      {pwFor && (
        <PasswordForm
          name={pwFor.name_ar || pwFor.name}
          pending={pending}
          error={err}
          onClose={() => setPwFor(null)}
          onSubmit={(pw) => run(() => resetStaffPassword(pwFor.id, pw), "غُيّرت كلمة المرور", () => setPwFor(null))}
        />
      )}

      {confirmDel && (
        <Modal title="حذف موظف" onClose={() => setConfirmDel(null)}>
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#fda4b4" }} />
            <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
              سيُمنع <span className="font-bold text-white">{confirmDel.name_ar || confirmDel.name}</span> من الدخول نهائياً
              ويُخفى من القوائم. مواعيده وفواتيره السابقة تبقى في السجلات كما هي.
            </p>
          </div>
          {err && <p className="text-[12.5px] mb-3" style={{ color: "#fda4b4" }}>{err}</p>}
          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmDel(null)}>إلغاء</button>
            <button className="btn-danger" disabled={pending}
              onClick={() => run(() => deleteStaffMember(confirmDel.id), "حُذف الموظف", () => setConfirmDel(null))}>
              <Trash2 className="w-4 h-4" /> تأكيد الحذف
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── modal shell ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="w-full glass" style={{ maxWidth: 560, borderRadius: "1.25rem", padding: "1.5rem", maxHeight: "88vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-black text-white">{title}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── add / edit ── */
type FormValues = {
  name: string; name_ar: string; email: string; phone: string;
  roles: string[]; commission_rate: number; specialty: string;
};

function StaffForm({
  member, pending, error, onClose, onSubmit,
}: {
  member: StaffRow | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (v: FormValues, password?: string) => void;
}) {
  const isNew = !member;
  const [v, setV] = useState<FormValues>({
    name: member?.name ?? "",
    name_ar: member?.name_ar ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    roles: member ? appRoles(member.all_roles) : ["doctor"],
    commission_rate: member?.commission_rate ?? 0,
    specialty: member?.specialty ?? "",
  });
  const [mode, setMode] = useState<"password" | "invite">("password");
  const [password, setPassword] = useState("");

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const toggleRole = (r: AppRole) =>
    setV((p) => ({ ...p, roles: p.roles.includes(r) ? p.roles.filter((x) => x !== r) : [...p.roles, r] }));

  const isDoctor = v.roles.includes("doctor");

  return (
    <Modal title={isNew ? "إضافة موظف" : "تعديل بيانات الموظف"} onClose={onClose}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="الاسم بالعربية">
            <input className="field" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} placeholder="د. سالم الحارثي" />
          </F>
          <F label="الاسم بالإنجليزية">
            <input className="field" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Salim Al Harthy" />
          </F>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="البريد الإلكتروني">
            <input className="field ltr-nums" dir="ltr" type="email" value={v.email}
              onChange={(e) => set("email", e.target.value)} placeholder="name@clinic.om" />
          </F>
          <F label="رقم الجوال">
            <input className="field ltr-nums" dir="ltr" inputMode="tel" value={v.phone}
              onChange={(e) => set("phone", e.target.value)} placeholder="+968…" />
          </F>
        </div>

        <F label="الأدوار — يمكن اختيار أكثر من دور لحساب واحد">
          <div className="flex items-center gap-1.5 flex-wrap">
            {APP_ROLES.map((r) => {
              const on = v.roles.includes(r);
              return (
                <button key={r} type="button" onClick={() => toggleRole(r)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
                  style={{
                    background: on ? `${ROLE_COLOR[r]}18` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? `${ROLE_COLOR[r]}45` : "var(--hairline)"}`,
                    color: on ? ROLE_COLOR[r] : "var(--text-3)",
                  }}>
                  {ROLE_LABEL_AR[r]}
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] mt-1.5" style={{ color: "var(--text-4)" }}>
            الدور الأول هو الأساسي — لوحته هي التي تُفتح بعد الدخول
          </p>
        </F>

        {isDoctor && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F label="التخصص">
              <input className="field" value={v.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="تقويم أسنان" />
            </F>
            <F label="نسبة العمولة %">
              <NumField value={v.commission_rate} max={100} onChange={(x) => set("commission_rate", Number(x) || 0)} />
            </F>
          </div>
        )}

        {isNew && (
          <>
            <div className="flex items-center gap-1.5">
              {([["password", "تعيين كلمة مرور الآن"], ["invite", "إرسال دعوة بالبريد"]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
                  style={{
                    background: mode === m ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${mode === m ? "rgba(45,212,191,0.35)" : "var(--hairline)"}`,
                    color: mode === m ? "var(--accent-1)" : "var(--text-3)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {mode === "password" ? (
              <F label="كلمة المرور — ٨ أحرف على الأقل">
                <input className="field ltr-nums" dir="ltr" type="text" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </F>
            ) : (
              <p className="text-[12px] px-3.5 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--hairline)", color: "var(--text-3)" }}>
                يصل الموظف رابط تفعيل على بريده ويختار كلمة مروره بنفسه.
              </p>
            )}
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-[12.5px] px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending}
            onClick={() => onSubmit(v, isNew && mode === "password" ? password : undefined)}>
            {isNew ? "إضافة" : "حفظ"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── password reset ── */
function PasswordForm({
  name, pending, error, onClose, onSubmit,
}: { name: string; pending: boolean; error: string | null; onClose: () => void; onSubmit: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  return (
    <Modal title={`كلمة مرور جديدة — ${name}`} onClose={onClose}>
      <div className="space-y-3.5">
        <F label="كلمة المرور الجديدة — ٨ أحرف على الأقل">
          <input className="field ltr-nums" dir="ltr" type="text" value={pw}
            onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </F>
        <p className="text-[11.5px]" style={{ color: "var(--text-4)" }}>
          سلّمها للموظف مباشرة — لن تُرسل تلقائياً.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-[12.5px] px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending} onClick={() => onSubmit(pw)}>تغيير</button>
        </div>
      </div>
    </Modal>
  );
}
