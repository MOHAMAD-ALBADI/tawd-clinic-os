"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, ShieldCheck, Save } from "lucide-react";
import { savePatientInsurance } from "@/app/actions/insurance";
import type { ProviderRow } from "@/components/insurance/providers-manager";

export type CoverageRow = {
  id: string; policy_number: string; coverage_percent: number; valid_until: string;
  patient_name: string; provider_name: string;
};
export type PatientOpt = { id: string; name: string };

export function PatientInsuranceManager({ coverage, providers, patients }: {
  coverage: CoverageRow[]; providers: ProviderRow[]; patients: PatientOpt[];
}) {
  const router = useRouter();
  const [f, setF] = useState({ patient_id: "", provider_id: "", policy_number: "", coverage_percent: "80", valid_until: "" });
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    setErr(null);
    start(async () => {
      try {
        const r = await savePatientInsurance({
          patient_id: f.patient_id, provider_id: f.provider_id, policy_number: f.policy_number,
          coverage_percent: Number(f.coverage_percent), valid_until: f.valid_until || null,
        });
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        setF({ patient_id: "", provider_id: "", policy_number: "", coverage_percent: "80", valid_until: "" });
        setFlash("حُفظ تأمين المريض"); setTimeout(() => setFlash(null), 2500); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block"><span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>{label}</span>{children}</label>
  );

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="section-title mb-4"><ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} /><h2>تغطية المرضى</h2></div>

      {providers.length === 0 ? (
        <p className="text-[12px] py-2" style={{ color: "#fbbf24" }}>أضف مزوّد تأمين أولاً</p>
      ) : (
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="المريض"><select className="field" value={f.patient_id} onChange={(e) => set("patient_id", e.target.value)}><option value="">— اختر —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>
            <F label="المزوّد"><select className="field" value={f.provider_id} onChange={(e) => set("provider_id", e.target.value)}><option value="">— اختر —</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.provider_name_ar || p.provider_name}</option>)}</select></F>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <F label="رقم الوثيقة"><input className="field ltr-nums" dir="ltr" value={f.policy_number} onChange={(e) => set("policy_number", e.target.value)} /></F>
            <F label="نسبة التغطية %"><input className="field ltr-nums" type="number" min={0} max={100} dir="ltr" value={f.coverage_percent} onChange={(e) => set("coverage_percent", e.target.value)} /></F>
            <F label="سارية حتى"><input className="field ltr-nums" type="date" dir="ltr" value={f.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></F>
          </div>
          {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
          {flash && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#5dd9cb" }}><CheckCircle2 className="w-3.5 h-3.5" /> {flash}</p>}
          <button className="btn-primary" disabled={pending || !f.patient_id || !f.provider_id} onClick={save}><Save className="w-3.5 h-3.5" /> {pending ? "…" : "حفظ التغطية"}</button>
        </div>
      )}

      {coverage.length > 0 && (
        <div className="space-y-1.5">
          {coverage.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[12px]" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
              <span className="font-bold text-white flex-1 truncate">{c.patient_name}</span>
              <span style={{ color: "var(--text-3)" }} className="truncate">{c.provider_name}</span>
              <span className="ltr-nums font-bold" style={{ color: "#5dd9cb" }}>{c.coverage_percent}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
