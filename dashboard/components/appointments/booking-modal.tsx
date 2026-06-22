"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { createAppointment } from "@/app/actions/appointments";
import { createInvoice } from "@/app/actions/invoices";
import { Calendar, User, Stethoscope, Clock, CheckCircle2, FileText } from "lucide-react";

type Patient  = { id: string; name: string; phone?: string };
type Service  = { id: string; name: string; price?: number };
type Doctor   = { id: string; name: string; name_ar?: string };

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
  services: Service[];
  doctors: Doctor[];
}

type Step = "form" | "success" | "invoice";

interface BookingResult {
  appointmentId: string;
  patientName: string;
  serviceName: string;
  servicePrice: number;
  slotTime: string;
}

function FieldLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: "rgba(148,163,184,0.7)" }}>
      <Icon className="w-3.5 h-3.5" style={{ color: "#14b8a6" }} />
      {label}
    </label>
  );
}

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(226,232,240,0.95)",
  borderRadius: "0.75rem",
  padding: "0.625rem 0.875rem",
  width: "100%",
  fontSize: "14px",
  outline: "none",
  transition: "border-color 0.15s",
};

export function BookingModal({ open, onClose, patients, services, doctors }: BookingModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [form, setForm] = useState({
    patient_id: "",
    service_id: "",
    doctor_id:  "",
    date:       new Date().toISOString().split("T")[0],
    time:       "09:00",
    notes:      "",
  });

  useEffect(() => {
    if (!open) {
      setStep("form");
      setError(null);
      setResult(null);
      setForm((f) => ({ ...f, notes: "" }));
    }
  }, [open]);

  function field(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleBook() {
    if (!form.patient_id || !form.service_id || !form.doctor_id || !form.date || !form.time) {
      setError("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const slotTime = `${form.date}T${form.time}:00`;
      const res = await createAppointment({
        patient_id: form.patient_id,
        service_id: form.service_id,
        doctor_id:  form.doctor_id,
        slot_time:  slotTime,
        notes:      form.notes || undefined,
      });

      const patient = patients.find((p) => p.id === form.patient_id);
      const service = services.find((s) => s.id === form.service_id);
      setResult({
        appointmentId: res.appointment.id,
        patientName:   patient?.name ?? "",
        serviceName:   service?.name ?? "",
        servicePrice:  service?.price ?? 0,
        slotTime,
      });
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvoice() {
    if (!result) return;
    const patient = patients.find((p) => p.id === form.patient_id);
    setInvoiceLoading(true);
    try {
      await createInvoice({
        patient_id: form.patient_id,
        appt_id:    result.appointmentId,
        status:     "sent",
        items: [{
          description: result.serviceName || "خدمة",
          service_id:  form.service_id || null,
          quantity:    1,
          unit_price:  result.servicePrice,
        }],
      });
      setStep("invoice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في إنشاء الفاتورة");
    } finally {
      setInvoiceLoading(false);
    }
    void patient;
  }

  const selectStyle = { ...inputStyle, cursor: "pointer" };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "invoice" ? "الفاتورة" : step === "success" ? "تم الحجز!" : "حجز موعد جديد"}
      subtitle={
        step === "form"
          ? "أدخل بيانات الموعد لحجزه في النظام"
          : step === "success"
          ? "تم حجز الموعد بنجاح — هل تريد إنشاء فاتورة؟"
          : undefined
      }
    >
      {/* ── FORM STEP ── */}
      {step === "form" && (
        <div className="space-y-4">
          {/* Patient */}
          <div>
            <FieldLabel icon={User} label="المريض *" />
            <select
              value={form.patient_id}
              onChange={(e) => field("patient_id", e.target.value)}
              style={selectStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            >
              <option value="">اختر المريض</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.phone ? ` — ${p.phone}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <FieldLabel icon={Stethoscope} label="الخدمة *" />
            <select
              value={form.service_id}
              onChange={(e) => field("service_id", e.target.value)}
              style={selectStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            >
              <option value="">اختر الخدمة</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.price ? ` — ${s.price} ر.ع` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor */}
          <div>
            <FieldLabel icon={User} label="الطبيب *" />
            <select
              value={form.doctor_id}
              onChange={(e) => field("doctor_id", e.target.value)}
              style={selectStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            >
              <option value="">اختر الطبيب</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name_ar ?? d.name}</option>
              ))}
            </select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={Calendar} label="التاريخ *" />
              <input
                type="date"
                value={form.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => field("date", e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>
            <div>
              <FieldLabel icon={Clock} label="الوقت *" />
              <input
                type="time"
                value={form.time}
                onChange={(e) => field("time", e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <FieldLabel icon={FileText} label="ملاحظات (اختياري)" />
            <textarea
              value={form.notes}
              onChange={(e) => field("notes", e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={2}
              style={{ ...inputStyle, resize: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(20,184,166,0.6)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {error && (
            <div
              className="text-sm py-2.5 px-3.5 rounded-xl"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.8)" }}
            >
              إلغاء
            </button>
            <button
              onClick={handleBook}
              disabled={loading}
              className="flex-1 h-11 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 active:scale-95"
              style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", boxShadow: "0 4px 16px rgba(20,184,166,0.3)" }}
            >
              {loading ? "جارٍ الحجز..." : "تأكيد الحجز ←"}
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === "success" && result && (
        <div className="space-y-5">
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(20,184,166,0.15)" }}
            >
              <CheckCircle2 className="w-7 h-7" style={{ color: "#5dd9cb" }} />
            </div>
            <h3 className="text-white font-bold text-lg mb-1">تم الحجز بنجاح!</h3>
            <p className="text-sm" style={{ color: "rgba(148,163,184,0.7)" }}>
              {result.patientName} — {result.serviceName}
            </p>
          </div>

          {error && (
            <div className="text-sm py-2.5 px-3.5 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.8)" }}
            >
              إغلاق
            </button>
            <button
              onClick={handleCreateInvoice}
              disabled={invoiceLoading}
              className="flex-1 h-11 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 active:scale-95"
              style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)", boxShadow: "0 4px 16px rgba(20,184,166,0.3)" }}
            >
              {invoiceLoading ? "جارٍ الإنشاء..." : "إنشاء فاتورة ←"}
            </button>
          </div>
        </div>
      )}

      {/* ── INVOICE STEP ── */}
      {step === "invoice" && result && (
        <div className="space-y-5">
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(20,184,166,0.07)", border: "1px solid rgba(20,184,166,0.2)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(20,184,166,0.15)" }}>
                <FileText className="w-5 h-5" style={{ color: "#2dd4bf" }} />
              </div>
              <div>
                <p className="text-white font-bold">تم إنشاء الفاتورة</p>
                <p className="text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>فاتورة بانتظار التحصيل</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "المريض",  value: result.patientName },
                { label: "الخدمة",  value: result.serviceName },
                { label: "المبلغ",  value: `${result.servicePrice} ر.ع` },
                { label: "الحالة",  value: "بانتظار التحصيل" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>{r.label}</span>
                  <span className="text-sm font-semibold text-white ltr-nums">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}
          >
            إغلاق
          </button>
        </div>
      )}
    </Modal>
  );
}
