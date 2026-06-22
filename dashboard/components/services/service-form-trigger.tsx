"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Edit2, X, Stethoscope, Banknote, Clock, FileText, CheckCircle2 } from "lucide-react";
import { createService, updateService } from "@/app/actions/services";

type Service = { id: string; name: string; price: number; duration_minutes?: number | null; description?: string | null };

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(226,232,240,0.95)",
  borderRadius: "0.75rem",
  padding: "0.625rem 0.875rem",
  width: "100%",
  fontSize: "14px",
  outline: "none",
};

function FieldLabel({ icon: Icon, label, hint }: { icon: React.ElementType; label: string; hint?: string }) {
  return (
    <div className="mb-2">
      <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: "rgba(148,163,184,0.7)" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
        {label}
      </label>
      {hint && <p className="text-[11px] mt-0.5" style={{ color: "rgba(148,163,184,0.4)" }}>{hint}</p>}
    </div>
  );
}

interface ServiceFormProps {
  service?: Service;
  onClose: () => void;
}

function ServiceForm({ service, onClose }: ServiceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name:             service?.name ?? "",
    price:            service?.price?.toString() ?? "",
    duration_minutes: service?.duration_minutes?.toString() ?? "",
    description:      service?.description ?? "",
  });

  function field(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleSubmit() {
    if (!form.name.trim() || !form.price) { setError("اسم الخدمة والسعر مطلوبان"); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setError("سعر غير صالح"); return; }
    setError(null);
    startTransition(async () => {
      try {
        const data = {
          name: form.name.trim(),
          price,
          duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined,
          description: form.description.trim() || undefined,
        };
        if (service) await updateService(service.id, data);
        else await createService(data);
        router.refresh();
        setDone(true);
        setTimeout(onClose, 1000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(20,184,166,0.15)" }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: "#5dd9cb" }} />
        </div>
        <p className="text-white font-bold">{service ? "تم تحديث الخدمة" : "تم إضافة الخدمة"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel icon={Stethoscope} label="اسم الخدمة *" />
        <input value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="مثال: كشف عام، تنظيف أسنان..." style={inputStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel icon={Banknote} label="السعر (ر.ع) *" />
          <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => field("price", e.target.value)} placeholder="0.00" style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
        </div>
        <div>
          <FieldLabel
            icon={Clock}
            label="مدة الجلسة (دقيقة)"
            hint="كم دقيقة تأخذ هذه الخدمة؟ يساعد في تنظيم المواعيد"
          />
          <input type="number" min="5" step="5" value={form.duration_minutes} onChange={(e) => field("duration_minutes", e.target.value)} placeholder="مثال: 30" style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
        </div>
      </div>

      <div>
        <FieldLabel icon={FileText} label="ملاحظة على الخدمة (اختياري)" hint="وصف مختصر يظهر للموظفين فقط" />
        <textarea value={form.description} onChange={(e) => field("description", e.target.value)} placeholder="مثال: تشمل فحص الضغط والسكر..." rows={2} style={{ ...inputStyle, resize: "none" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
      </div>

      {error && (
        <div className="text-sm py-2.5 px-3.5 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.8)" }}>
          إلغاء
        </button>
        <button onClick={handleSubmit} disabled={pending} className="flex-1 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
          style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", boxShadow: "0 4px 16px rgba(20,184,166,0.3)" }}>
          {pending ? "جارٍ الحفظ..." : service ? "حفظ التعديلات ←" : "إضافة الخدمة ←"}
        </button>
      </div>
    </div>
  );
}

/* ── Modal shell ── */
function ServiceModal({ service, onClose }: { service?: Service; onClose: () => void }) {
  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(2,8,20,0.8)", backdropFilter: "blur(8px)", zIndex: 9999 }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "rgba(6,14,30,0.97)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">{service ? "تعديل الخدمة" : "إضافة خدمة جديدة"}</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>
              {service ? `تعديل: ${service.name}` : "الخدمات تظهر فوراً في نموذج الحجز"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06]"
            style={{ color: "rgba(148,163,184,0.5)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ServiceForm service={service} onClose={onClose} />
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}

/* ── Add Trigger ── */
export function AddServiceTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
        style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", boxShadow: "0 4px 16px rgba(20,184,166,0.3)" }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(20,184,166,0.45)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(20,184,166,0.3)"; }}
      >
        <Plus className="w-4 h-4" />
        إضافة خدمة
      </button>
      {open && <ServiceModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* ── Edit Trigger ── */
export function EditServiceTrigger({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.7)" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.35)"; e.currentTarget.style.color = "#5dd9cb"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(148,163,184,0.7)"; }}
      >
        <Edit2 className="w-3 h-3" />
        تعديل
      </button>
      {open && <ServiceModal service={service} onClose={() => setOpen(false)} />}
    </>
  );
}
