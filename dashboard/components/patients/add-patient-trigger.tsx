"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, User, Phone, Calendar, Mail, IdCard, CheckCircle2, Pencil, Archive } from "lucide-react";
import { createPatient, updatePatient, archivePatient } from "@/app/actions/patients";

export type PatientRecord = {
  id: string;
  name: string;
  phone: string;
  dob?: string | null;
  gender?: string | null;
  email?: string | null;
  national_id?: string | null;
};

function FieldLabel({ icon: Icon, label, hint }: { icon: React.ElementType; label: string; hint?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: "var(--text-2)" }}>
      <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} />
      {label}
      {hint && <span className="text-[10px] font-normal" style={{ color: "var(--text-4)" }}>{hint}</span>}
    </label>
  );
}

function PatientModal({ patient, onClose }: { patient?: PatientRecord; onClose: () => void }) {
  const router = useRouter();
  const isEdit = !!patient;
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: patient?.name ?? "",
    phone: patient?.phone ?? "",
    dob: patient?.dob ?? "",
    gender: patient?.gender ?? "",
    email: patient?.email ?? "",
    national_id: patient?.national_id ?? "",
  });

  function field(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleSubmit() {
    if (!form.name.trim()) { setError("اسم المريض مطلوب"); return; }
    if (!form.phone.trim()) { setError("رقم الجوال مطلوب"); return; }
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          name: form.name.trim(),
          phone: form.phone.trim(),
          dob: form.dob || undefined,
          gender: form.gender || undefined,
          email: form.email || undefined,
          national_id: form.national_id || undefined,
        };
        if (isEdit) await updatePatient(patient!.id, payload);
        else await createPatient(payload);
        setDone(true);
        router.refresh();
        setTimeout(onClose, 1000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(2,8,18,0.82)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md panel animate-scale-in" style={{ background: "rgba(8,14,24,0.98)", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="eyebrow mb-1">{isEdit ? "EDIT PATIENT" : "NEW PATIENT"}</p>
            <h2 className="text-white font-bold text-lg">{isEdit ? "تعديل بيانات المريض" : "إضافة مريض جديد"}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(52,211,153,0.14)" }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: "var(--color-ok)" }} />
            </div>
            <p className="text-white font-bold">{isEdit ? "تم حفظ التعديلات" : "تم إضافة المريض بنجاح"}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <FieldLabel icon={User} label="الاسم الكامل *" />
              <input className="field" value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="اسم المريض" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel icon={Phone} label="رقم الجوال *" />
                <input className="field ltr-nums" type="tel" value={form.phone} onChange={(e) => field("phone", e.target.value)} placeholder="+968 9xxx xxxx" />
              </div>
              <div>
                <FieldLabel icon={IdCard} label="رقم الهوية" />
                <input className="field ltr-nums" value={form.national_id} onChange={(e) => field("national_id", e.target.value)} placeholder="—" />
              </div>
            </div>
            <div>
              <FieldLabel icon={Mail} label="البريد الإلكتروني" />
              <input className="field ltr-nums" type="email" value={form.email} onChange={(e) => field("email", e.target.value)} placeholder="—" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel icon={Calendar} label="تاريخ الميلاد" />
                <input className="field" type="date" value={form.dob ?? ""} onChange={(e) => field("dob", e.target.value)} />
              </div>
              <div>
                <FieldLabel icon={User} label="الجنس" />
                <select className="field" value={form.gender ?? ""} onChange={(e) => field("gender", e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="">اختر</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="text-sm py-2.5 px-3.5 rounded-xl" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="btn-ghost flex-1 h-11">إلغاء</button>
              <button onClick={handleSubmit} disabled={pending} className="btn-primary flex-1 h-11">
                {pending ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المريض"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AddPatientTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <UserPlus className="w-4 h-4" />
        إضافة مريض
      </button>
      {open && <PatientModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditPatientTrigger({ patient }: { patient: PatientRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost" title="تعديل">
        <Pencil className="w-3.5 h-3.5" /> تعديل
      </button>
      {open && <PatientModal patient={patient} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ArchivePatientTrigger({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      try { await archivePatient(id, reason); router.refresh(); setOpen(false); }
      catch (e) { setError(e instanceof Error ? e.message : "حدث خطأ"); }
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-danger" title="أرشفة">
        <Archive className="w-3.5 h-3.5" /> أرشفة
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(2,8,18,0.82)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-sm panel animate-scale-in" style={{ background: "rgba(8,14,24,0.98)", padding: "1.5rem" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.22)" }}>
                <Archive className="w-5 h-5" style={{ color: "#fda4b4" }} />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">أرشفة المريض</h2>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>{name}</p>
              </div>
            </div>
            <p className="text-[13px] mb-3" style={{ color: "var(--text-2)" }}>
              لن يُحذف السجل الطبي نهائياً — سيُنقل إلى الأرشيف ويمكن استرجاعه لاحقاً.
            </p>
            <input className="field mb-3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الأرشفة (اختياري)" />
            {error && <p className="text-[13px] mb-3" style={{ color: "#fda4b4" }}>{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1 h-10">إلغاء</button>
              <button onClick={handleArchive} disabled={pending} className="btn-danger flex-1 h-10">
                {pending ? "جارٍ..." : "أرشفة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
