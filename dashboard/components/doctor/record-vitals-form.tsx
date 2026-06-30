"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Save, Loader2, CheckCircle2 } from "lucide-react";
import { recordVitals, type VitalsInput } from "@/app/actions/doctor";

const FIELDS: { key: keyof VitalsInput; label: string; unit: string; step?: string }[] = [
  { key: "weight_kg", label: "الوزن", unit: "كجم", step: "0.1" },
  { key: "height_cm", label: "الطول", unit: "سم", step: "0.1" },
  { key: "blood_pressure_systolic", label: "ضغط انقباضي", unit: "" },
  { key: "blood_pressure_diastolic", label: "ضغط انبساطي", unit: "" },
  { key: "pulse_bpm", label: "النبض", unit: "bpm" },
  { key: "temperature_c", label: "الحرارة", unit: "°م", step: "0.1" },
  { key: "oxygen_saturation", label: "الأكسجين", unit: "%" },
];

export function RecordVitalsForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});

  function save() {
    setError(null);
    const payload: VitalsInput = {};
    for (const f of FIELDS) {
      const raw = vals[f.key];
      if (raw !== undefined && raw !== "") (payload as Record<string, number>)[f.key] = parseFloat(raw);
    }
    if (Object.keys(payload).length === 0) { setError("أدخل قيمة واحدة على الأقل"); return; }
    startTransition(async () => {
      try {
        await recordVitals(patientId, payload);
        setVals({});
        setDone(true);
        router.refresh();
        setTimeout(() => setDone(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: "#5dd9cb" }} />
          <h3 className="font-bold text-white text-sm">تسجيل العلامات الحيوية</h3>
        </div>
        {done && <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#34D399" }}><CheckCircle2 className="w-3.5 h-3.5" /> تم</span>}
      </div>
      {error && <div className="text-xs py-2 px-3 rounded-lg mb-3" style={{ background: "rgba(239,68,68,0.08)", color: "#F87171" }}>{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-[11px] font-medium block mb-1" style={{ color: "rgba(148,163,184,0.6)" }}>{f.label} {f.unit && <span className="opacity-60">({f.unit})</span>}</label>
            <input type="number" step={f.step ?? "1"} value={vals[f.key] ?? ""} onChange={(e) => setVals((s) => ({ ...s, [f.key]: e.target.value }))}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(226,232,240,0.92)", borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: 13, outline: "none" }} />
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={save} disabled={pending} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", color: "white" }}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ القياسات
        </button>
      </div>
    </div>
  );
}
