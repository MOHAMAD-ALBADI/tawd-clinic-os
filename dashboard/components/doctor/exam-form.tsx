"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Stethoscope } from "lucide-react";
import { saveExamNote } from "@/app/actions/doctor";

const FIELDS = [
  { key: "complaint", label: "الشكوى", ph: "ما الذي يشكو منه المريض؟" },
  { key: "findings",  label: "الفحص",  ph: "نتائج الفحص السريري…" },
  { key: "diagnosis", label: "التشخيص", ph: "التشخيص المبدئي/النهائي…" },
  { key: "plan",      label: "الخطة",  ph: "العلاج، الوصفة، الموعد القادم…" },
] as const;

/** Structured exam note (SOAP-style) — saves to the file and can close the visit. */
export function ExamForm({
  patientId,
  appointmentId,
}: {
  patientId: string;
  appointmentId: string;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [form, setForm] = useState({ complaint: "", findings: "", diagnosis: "", plan: "" });
  const [isPrivate, setIsPrivate] = useState(false);

  const filled = Object.values(form).some((v) => v.trim());

  function save(complete: boolean) {
    if (!filled) { alert("اكتب شيئاً واحداً على الأقل"); return; }
    startSave(async () => {
      try {
        await saveExamNote(patientId, appointmentId, {
          ...form,
          isPrivate,
          completeAppointment: complete,
        });
        if (complete) router.push("/doctor");
        else router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-4">
        <Stethoscope className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        توثيق الكشف
      </h3>

      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-2)" }}>
              {f.label}
            </label>
            <textarea
              value={form[f.key]}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.ph}
              rows={f.key === "plan" ? 3 : 2}
              className="field"
              style={{ resize: "vertical" }}
            />
          </div>
        ))}

        <label className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: "var(--text-3)" }}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="accent-teal-500"
          />
          ملاحظة خاصة (تظهر لي فقط)
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={() => save(true)} disabled={saving || !filled} className="btn-primary flex-1">
            <ClipboardCheck className="w-4 h-4" />
            {saving ? "جارٍ الحفظ…" : "حفظ وإنهاء الكشف"}
          </button>
          <button onClick={() => save(false)} disabled={saving || !filled} className="btn-ghost">
            حفظ فقط
          </button>
        </div>
      </div>
    </div>
  );
}
