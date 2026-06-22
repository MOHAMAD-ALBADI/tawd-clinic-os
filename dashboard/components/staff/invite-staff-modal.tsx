"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  UserPlus, X, Mail, Phone, User, Briefcase, CheckCircle2,
} from "lucide-react";
import { inviteStaffMember } from "@/app/actions/staff";

const ROLES = [
  { value: "doctor",       label: "طبيب" },
  { value: "receptionist", label: "موظف استقبال" },
  { value: "accountant",   label: "محاسب" },
  { value: "admin",        label: "مدير العيادة" },
];

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(226,232,240,0.9)",
  borderRadius: "0.625rem",
  padding: "0.6rem 0.85rem",
  fontSize: "14px",
  outline: "none",
  width: "100%",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-[12px] font-semibold mb-1.5 block"
        style={{ color: "rgba(148,163,184,0.6)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function InputIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "rgba(148,163,184,0.4)" }}
      >
        {children}
      </span>
    </div>
  );
}

export function InviteStaffModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name_ar: "", name: "", email: "", phone: "", role: "doctor", commission_rate: "",
  });

  function reset() {
    setForm({ name_ar: "", name: "", email: "", phone: "", role: "doctor", commission_rate: "" });
    setError(null);
    setDone(false);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(reset, 300);
  }

  function handleSubmit() {
    const displayName = form.name_ar.trim() || form.name.trim();
    if (!displayName || !form.email.trim()) {
      setError("الاسم والبريد الإلكتروني مطلوبان");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await inviteStaffMember({
          name: form.name.trim() || form.name_ar.trim(),
          name_ar: form.name_ar.trim() || undefined,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          commission_rate: form.commission_rate ? parseFloat(form.commission_rate) : undefined,
        });
        setDone(true);
        router.refresh();
        setTimeout(handleClose, 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ أثناء الإرسال");
      }
    });
  }

  const modal = open ? (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        onClick={handleClose}
      />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{
          background: "rgba(8,18,36,0.98)",
          border: "1px solid rgba(20,184,166,0.3)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)" }}
            >
              <UserPlus className="w-4 h-4" style={{ color: "#5dd9cb" }} />
            </div>
            <div>
              <h3 className="font-bold text-white">دعوة موظف جديد</h3>
              <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.5)" }}>
                سيتلقى بريداً للتسجيل في النظام
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.6)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <CheckCircle2 className="w-7 h-7" style={{ color: "#34D399" }} />
            </div>
            <p className="font-bold text-white">تمت الدعوة بنجاح</p>
            <p className="text-sm text-center" style={{ color: "rgba(148,163,184,0.6)" }}>
              سيصل بريد الدعوة إلى<br />
              <span className="text-white font-semibold ltr-nums">{form.email}</span>
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div
                className="text-sm py-2.5 px-4 rounded-xl"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}
              >
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Field label="الاسم بالعربي *">
                <div className="relative">
                  <User
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: "rgba(148,163,184,0.4)" }}
                  />
                  <input
                    type="text"
                    value={form.name_ar}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name_ar: e.target.value,
                        name: f.name || e.target.value,
                      }))
                    }
                    placeholder="مثال: أحمد الزهراني"
                    style={{ ...INPUT_STYLE, paddingRight: "2.2rem" }}
                  />
                </div>
              </Field>

              <Field label="الاسم بالإنجليزي">
                <div className="relative">
                  <User
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: "rgba(148,163,184,0.4)" }}
                  />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ahmed Alzahrani"
                    style={{ ...INPUT_STYLE, paddingRight: "2.2rem" }}
                  />
                </div>
              </Field>

              <Field label="البريد الإلكتروني *">
                <div className="relative">
                  <Mail
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: "rgba(148,163,184,0.4)" }}
                  />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="employee@clinic.com"
                    style={{ ...INPUT_STYLE, paddingRight: "2.2rem", direction: "ltr", textAlign: "left" }}
                  />
                </div>
              </Field>

              <Field label="الجوال">
                <div className="relative">
                  <Phone
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: "rgba(148,163,184,0.4)" }}
                  />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+966 5X XXX XXXX"
                    style={{ ...INPUT_STYLE, paddingRight: "2.2rem", direction: "ltr", textAlign: "left" }}
                  />
                </div>
              </Field>

              <Field label="الوظيفة *">
                <div className="relative">
                  <Briefcase
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: "rgba(148,163,184,0.4)" }}
                  />
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    style={{ ...INPUT_STYLE, paddingRight: "2.2rem", cursor: "pointer" }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value} style={{ background: "#0a1628" }}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              {["doctor", "accountant"].includes(form.role) && (
                <Field label="نسبة العمولة (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.commission_rate}
                    onChange={(e) => setForm((f) => ({ ...f, commission_rate: e.target.value }))}
                    placeholder="0.0"
                    style={{ ...INPUT_STYLE, direction: "ltr" }}
                  />
                </Field>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(148,163,184,0.7)",
                }}
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={pending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "white" }}
              >
                <UserPlus className="w-4 h-4" />
                {pending ? "جارٍ الإرسال..." : "إرسال الدعوة"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
        style={{
          background: "linear-gradient(135deg, #0d9488, #0f766e)",
          color: "white",
          boxShadow: "0 4px 16px rgba(20,184,166,0.3)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(20,184,166,0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(20,184,166,0.3)";
        }}
      >
        <UserPlus className="w-4 h-4" />
        إضافة موظف
      </button>
      {typeof window !== "undefined" && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
