"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, CheckCircle2, AlertTriangle, UserCheck, UserX, Wallet } from "lucide-react";
import { F } from "@/components/ui/num-field";
import {
  saveHrProfile, markAttendance, clearAttendance,
  type HrInput, type AttendanceStatus,
} from "@/app/actions/payroll";

export type StaffRow = {
  id: string; name: string; role: string; hasProfile: boolean;
  basic: number; housing: number; transport: number; other: number;
  commission_rate: number;
  contract_type: string; annual_leave_days: number;
  job_title: string; hire_date: string; bank_name: string; iban: string;
  monthAbsence: number; todayStatus: string | null;
};

/** every attendance_status the DB allows — a manager needs leave/sick/half-day,
    not just present-or-absent */
const ATT_OPTIONS: { v: AttendanceStatus; label: string; color: string }[] = [
  { v: "present",  label: "حاضر",   color: "#5dd9cb" },
  { v: "absent",   label: "غائب",   color: "#fda4b4" },
  { v: "leave",    label: "إجازة",  color: "#38bdf8" },
  { v: "sick",     label: "مرضي",   color: "#fbbf24" },
  { v: "half_day", label: "نصف يوم", color: "#a1a1aa" },
  { v: "holiday",  label: "عطلة",   color: "#71717a" },
];

const ROLE_AR: Record<string, string> = {
  clinic_admin: "مدير", doctor: "طبيب", receptionist: "استقبال", accountant: "محاسبة", admin: "مدير",
};
const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(v);

export function SalaryAndAttendance({ staff, today, attDate }: {
  staff: StaffRow[]; today: string; attDate: string;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<StaffRow | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busyAtt, setBusyAtt] = useState<string | null>(null);

  function flashOk(m: string) { setFlash(m); setTimeout(() => setFlash(null), 2500); }

  /* The day being logged lives in the URL (?d=) so the server refetches that day's
     records — the highlighted status therefore always matches the chosen date
     instead of showing a stale "today". Back-filling is normal clinic reality. */
  function pickDate(v: string) {
    const d = v || today;
    router.push(d === today ? "/clinic-admin/finance/payroll" : `/clinic-admin/payroll?d=${d}`);
  }

  function attend(id: string, status: AttendanceStatus) {
    setBusyAtt(id + status);
    start(async () => {
      try {
        const r = await markAttendance({ staff_id: id, work_date: attDate, status });
        if (r.ok) router.refresh();
      } finally { setBusyAtt(null); }
    });
  }
  function clearDay(id: string) {
    setBusyAtt(id + "clear");
    start(async () => {
      try {
        const r = await clearAttendance(id, attDate);
        if (r.ok) router.refresh();
      } finally { setBusyAtt(null); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="section-title">
          <Wallet className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>رواتب الموظفين والحضور</h2>
        </div>
        <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-3)" }}>
          يوم الحضور
          <input type="date" dir="ltr" className="field ltr-nums" style={{ width: 150, padding: "0.35rem 0.6rem" }}
            value={attDate} max={today} onChange={(e) => pickDate(e.target.value)} />
        </label>
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}

      {staff.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>لا موظفون بعد</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["الموظف", "إجمالي الراتب", "غياب الشهر", "حضور اليوم", ""].map((h) => (
                  <th key={h} className="text-start px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const total = s.basic + s.housing + s.transport + s.other;
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td className="px-3 py-3">
                      <p className="font-bold text-white">{s.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{ROLE_AR[s.role] ?? s.role}</p>
                    </td>
                    <td className="px-3 py-3">
                      {s.hasProfile ? (
                        <span className="font-bold ltr-nums text-white">{fmt(total)} <span className="text-[11px]" style={{ color: "var(--text-4)" }}>ر.ع</span></span>
                      ) : (
                        <span className="text-[11px]" style={{ color: "#fbbf24" }}>لم يُحدَّد</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="ltr-nums font-bold" style={{ color: s.monthAbsence > 0 ? "#fbbf24" : "var(--text-3)" }}>{s.monthAbsence}</span>
                      <span className="text-[11px] mx-1" style={{ color: "var(--text-4)" }}>يوم</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {ATT_OPTIONS.map((o) => (
                          <AttBtn key={o.v} active={s.todayStatus === o.v} busy={busyAtt === s.id + o.v}
                            color={o.color} onClick={() => attend(s.id, o.v)}>{o.label}</AttBtn>
                        ))}
                        {s.todayStatus && (
                          <button title="حذف السجل" disabled={busyAtt === s.id + "clear"} onClick={() => clearDay(s.id)}
                            className="text-[11px] px-1.5 py-1 rounded-lg" style={{ color: "var(--text-4)" }}>✕</button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-end">
                      <button title="تعديل الراتب" onClick={() => { setErr(null); setEdit(s); }}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", color: "var(--text-2)" }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <SalaryModal staff={edit} pending={pending} err={err} onClose={() => setEdit(null)}
          onSave={(v) => {
            setErr(null);
            start(async () => {
              try {
                const r = await saveHrProfile(v);
                if (!r.ok) { setErr(r.reason ?? "تعذّر الحفظ"); return; }
                setEdit(null); flashOk("حُفظت بيانات الراتب"); router.refresh();
              } catch { setErr("تعذّر الاتصال"); }
            });
          }} />
      )}
    </div>
  );
}

function AttBtn({ children, active, busy, color, onClick }: {
  children: React.ReactNode; active: boolean; busy: boolean; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={busy}
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
      style={active
        ? { background: `${color}1f`, border: `1px solid ${color}55`, color }
        : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--hairline)", color: "var(--text-3)" }}>
      {children}
    </button>
  );
}

function SalaryModal({ staff, onSave, onClose, pending, err }: {
  staff: StaffRow; pending: boolean; err: string | null;
  onSave: (v: HrInput) => void; onClose: () => void;
}) {
  const [f, setF] = useState<HrInput>({
    staff_id: staff.id, job_title: staff.job_title, hire_date: staff.hire_date || "",
    basic_salary: staff.basic, housing_allowance: staff.housing,
    transport_allowance: staff.transport, other_allowance: staff.other,
    commission_rate: staff.commission_rate,
    contract_type: staff.contract_type || "full_time",
    annual_leave_days: staff.annual_leave_days ?? 30,
    bank_name: staff.bank_name, iban: staff.iban,
  });
  const set = (k: keyof HrInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const total = (Number(f.basic_salary) || 0) + (Number(f.housing_allowance) || 0) + (Number(f.transport_allowance) || 0) + (Number(f.other_allowance) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-md panel-feature" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-start" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        <h3 className="font-bold text-white text-lg mb-1">راتب {staff.name}</h3>
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="المسمى الوظيفي"><input className="field" value={f.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} placeholder="طبيب أسنان" /></F>
            <F label="تاريخ التعيين"><input className="field ltr-nums" type="date" dir="ltr" value={f.hire_date ?? ""} onChange={(e) => set("hire_date", e.target.value)} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="الراتب الأساسي (ر.ع)"><input className="field ltr-nums" type="text" inputMode="decimal" min={0} step="0.001" dir="ltr" value={f.basic_salary ?? 0} onChange={(e) => set("basic_salary", e.target.value)} /></F>
            <F label="بدل سكن"><input className="field ltr-nums" type="text" inputMode="decimal" min={0} step="0.001" dir="ltr" value={f.housing_allowance ?? 0} onChange={(e) => set("housing_allowance", e.target.value)} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="بدل نقل"><input className="field ltr-nums" type="text" inputMode="decimal" min={0} step="0.001" dir="ltr" value={f.transport_allowance ?? 0} onChange={(e) => set("transport_allowance", e.target.value)} /></F>
            <F label="بدلات أخرى"><input className="field ltr-nums" type="text" inputMode="decimal" min={0} step="0.001" dir="ltr" value={f.other_allowance ?? 0} onChange={(e) => set("other_allowance", e.target.value)} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="نوع العقد">
              <select className="field" value={f.contract_type ?? "full_time"} onChange={(e) => set("contract_type", e.target.value)}>
                <option value="full_time">دوام كامل</option>
                <option value="part_time">دوام جزئي</option>
                <option value="visiting">زائر / بالحصة</option>
                <option value="contract">عقد مؤقت</option>
              </select>
            </F>
            <F label="رصيد الإجازة السنوية (يوم)">
              <input className="field ltr-nums" type="text" inputMode="decimal" dir="ltr"
                value={f.annual_leave_days ?? 30} onChange={(e) => set("annual_leave_days", e.target.value)} />
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="نسبة العمولة % (للأطباء)"><input className="field ltr-nums" type="text" inputMode="decimal" min={0} max={100} step="0.5" dir="ltr" value={f.commission_rate ?? 0} onChange={(e) => set("commission_rate", e.target.value)} /></F>
            <F label="البنك"><input className="field" value={f.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} placeholder="اختياري" /></F>
          </div>
          <F label="IBAN"><input className="field ltr-nums" dir="ltr" value={f.iban ?? ""} onChange={(e) => set("iban", e.target.value)} placeholder="OM.." /></F>
          <div className="flex items-center justify-between text-[13px] px-3 py-2 rounded-xl" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.2)" }}>
            <span style={{ color: "var(--text-2)" }}>إجمالي الراتب الشهري</span>
            <span className="font-black ltr-nums" style={{ color: "#5dd9cb" }}>{fmt(total)} ر.ع</span>
          </div>
          {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
          <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSave(f)}>{pending ? "…" : "حفظ الراتب"}</button>
        </div>
      </div>
    </div>
  );
}
