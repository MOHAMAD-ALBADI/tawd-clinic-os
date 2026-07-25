"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Plus, X, CheckCircle2, AlertTriangle, FileSignature } from "lucide-react";
import { recordConsent, withdrawConsent, type ConsentType } from "@/app/actions/consents";

export type Consent = {
  id: string; consent_type: string; signed_at: string;
  is_active: boolean; expires_at: string | null;
};

const TYPE_AR: Record<string, string> = {
  general_treatment: "موافقة على العلاج",
  data_processing: "معالجة البيانات (PDPL)",
  marketing: "التواصل التسويقي",
  specific_procedure: "إجراء محدّد",
};
const TYPES: ConsentType[] = ["general_treatment", "data_processing", "marketing", "specific_procedure"];

/** PDPL (Oman RD 6/2022) consent record for a patient — required for lawful
    processing of health data. Withdrawal keeps the record and flags it inactive. */
export function PatientConsents({ patientId, consents }: { patientId: string; consents: Consent[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ConsentType>("data_processing");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string, after?: () => void) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        after?.(); setFlash(msg); setTimeout(() => setFlash(null), 2500); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const active = consents.filter((c) => c.is_active);
  const hasPdpl = active.some((c) => c.consent_type === "data_processing");

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="section-title">
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>الموافقات</h2>
        </div>
        <button className="btn-ghost" onClick={() => { setErr(null); setOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> تسجيل موافقة
        </button>
      </div>

      {!hasPdpl && (
        <div className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-xl mb-3"
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          لا توجد موافقة على معالجة البيانات — مطلوبة نظاماً (قانون حماية البيانات العُماني)
        </div>
      )}
      {flash && <div className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-xl mb-3" style={{ background: "rgba(45,212,191,0.1)", color: "#5dd9cb" }}><CheckCircle2 className="w-3.5 h-3.5" /> {flash}</div>}
      {err && <p className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}

      {consents.length === 0 ? (
        <p className="text-[12px] text-center py-4" style={{ color: "var(--text-4)" }}>لا موافقات مسجّلة</p>
      ) : (
        <div className="space-y-1.5">
          {consents.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
              <FileSignature className="w-3.5 h-3.5 shrink-0" style={{ color: c.is_active ? "#5dd9cb" : "var(--text-4)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: c.is_active ? "#fff" : "var(--text-3)" }}>
                  {TYPE_AR[c.consent_type] ?? c.consent_type}
                </p>
                <p className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>{(c.signed_at ?? "").slice(0, 10)}</p>
              </div>
              {c.is_active ? (
                <button disabled={pending} onClick={() => run(() => withdrawConsent(c.id, patientId), "سُحبت الموافقة")}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                  style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}>
                  سحب
                </button>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-4)" }}>مسحوبة</span>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm panel-feature" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="float-start" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
            <h3 className="font-bold text-white text-lg mb-3">تسجيل موافقة</h3>
            <label className="block mb-3">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>نوع الموافقة</span>
              <select className="field" value={type} onChange={(e) => setType(e.target.value as ConsentType)}>
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_AR[t]}</option>)}
              </select>
            </label>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-4)" }}>تُسجَّل الموافقة باسم المريض مع التاريخ والوقت كسجل نظامي</p>
            {err && <p className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
            <button className="btn-primary w-full justify-center" disabled={pending}
              onClick={() => run(() => recordConsent({ patient_id: patientId, consent_type: type }), "سُجّلت الموافقة", () => setOpen(false))}>
              {pending ? "…" : "تسجيل"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
