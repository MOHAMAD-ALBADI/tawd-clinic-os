"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Save } from "lucide-react";
import { saveMedicalHistory } from "@/app/actions/doctor";

const BLOOD_TYPES = ["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export type MedicalHistory = {
  blood_type: string | null;
  allergies: string[] | null;
  chronic_diseases: string[] | null;
  current_medications: string[] | null;
  notes: string | null;
} | null;

/** Unified medical history editor — allergies here power the red-flag badge everywhere. */
export function MedicalHistoryForm({
  patientId,
  history,
}: {
  patientId: string;
  history: MedicalHistory;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();
  const [form, setForm] = useState({
    blood_type: history?.blood_type ?? "unknown",
    allergies: (history?.allergies ?? []).join("، "),
    chronic: (history?.chronic_diseases ?? []).join("، "),
    meds: (history?.current_medications ?? []).join("، "),
    notes: history?.notes ?? "",
  });

  const split = (s: string) => s.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean);

  function save() {
    startSave(async () => {
      try {
        await saveMedicalHistory(patientId, {
          blood_type: form.blood_type,
          allergies: split(form.allergies),
          chronic_diseases: split(form.chronic),
          current_medications: split(form.meds),
          notes: form.notes,
        });
        setEditing(false);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  const chips = (items: string[] | null | undefined, danger = false) =>
    (items ?? []).length === 0 ? (
      <span className="text-[11px]" style={{ color: "var(--text-4)" }}>لا يوجد</span>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {(items ?? []).map((x) => (
          <span
            key={x}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={
              danger
                ? { background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)", color: "#fda4b4" }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "var(--text-2)" }
            }
          >
            {x}
          </span>
        ))}
      </div>
    );

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <HeartPulse className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          الملف الطبي
        </h3>
        <button onClick={() => setEditing(!editing)} className="btn-ghost" style={{ padding: "0.3rem 0.75rem", fontSize: 11 }}>
          {editing ? "إلغاء" : history ? "تعديل" : "إنشاء الملف"}
        </button>
      </div>

      {!editing ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="eyebrow mb-1.5" style={{ fontSize: 9 }}>فصيلة الدم</p>
            <span className="text-sm font-bold ltr-nums text-white">
              {history?.blood_type && history.blood_type !== "unknown" ? history.blood_type : "غير محددة"}
            </span>
          </div>
          <div>
            <p className="eyebrow mb-1.5" style={{ fontSize: 9, color: (history?.allergies ?? []).length ? "#fda4b4" : undefined }}>
              ⚠ الحساسية
            </p>
            {chips(history?.allergies, true)}
          </div>
          <div>
            <p className="eyebrow mb-1.5" style={{ fontSize: 9 }}>أمراض مزمنة</p>
            {chips(history?.chronic_diseases)}
          </div>
          <div>
            <p className="eyebrow mb-1.5" style={{ fontSize: 9 }}>أدوية حالية</p>
            {chips(history?.current_medications)}
          </div>
          {history?.notes && (
            <div className="sm:col-span-2">
              <p className="eyebrow mb-1.5" style={{ fontSize: 9 }}>ملاحظات</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>{history.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>فصيلة الدم</label>
              <select
                value={form.blood_type}
                onChange={(e) => setForm((p) => ({ ...p, blood_type: e.target.value }))}
                className="field ltr-nums"
              >
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b} style={{ background: "#131315" }}>
                    {b === "unknown" ? "غير محددة" : b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "#fda4b4" }}>الحساسية (افصل بفاصلة)</label>
              <input
                value={form.allergies}
                onChange={(e) => setForm((p) => ({ ...p, allergies: e.target.value }))}
                placeholder="بنسلين، لاتكس…"
                className="field"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>أمراض مزمنة</label>
              <input
                value={form.chronic}
                onChange={(e) => setForm((p) => ({ ...p, chronic: e.target.value }))}
                placeholder="سكري، ضغط…"
                className="field"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>أدوية حالية</label>
              <input
                value={form.meds}
                onChange={(e) => setForm((p) => ({ ...p, meds: e.target.value }))}
                placeholder="ميتفورمين…"
                className="field"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>ملاحظات عامة</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="field"
              style={{ resize: "vertical" }}
            />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full">
            <Save className="w-3.5 h-3.5" />
            {saving ? "جارٍ الحفظ…" : "حفظ الملف الطبي"}
          </button>
        </div>
      )}
    </div>
  );
}
