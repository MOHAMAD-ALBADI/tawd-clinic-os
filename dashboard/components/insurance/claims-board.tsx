"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Send, CheckCircle2, XCircle, Ban, AlertTriangle, FileText } from "lucide-react";
import { createClaim, submitClaim, resolveClaim, cancelClaim } from "@/app/actions/insurance";
import type { ProviderRow } from "@/components/insurance/providers-manager";
import type { PatientOpt } from "@/components/insurance/patient-insurance-manager";

export type ClaimRow = {
  id: string; status: "pending" | "submitted" | "approved" | "rejected" | "cancelled";
  submitted_amount: number; approved_amount: number; claim_ref: string; rejection_reason: string;
  patient_name: string; provider_name: string;
};

const STATUS: Record<ClaimRow["status"], { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "#fbbf24" },
  submitted: { label: "مقدّمة", color: "#5dd9cb" },
  approved: { label: "معتمدة", color: "#2dd4bf" },
  rejected: { label: "مرفوضة", color: "#fda4b4" },
  cancelled: { label: "ملغاة", color: "#71717a" },
};
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export function ClaimsBoard({ claims, providers, patients }: {
  claims: ClaimRow[]; providers: ProviderRow[]; patients: PatientOpt[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [resolve, setResolve] = useState<{ claim: ClaimRow; outcome: "approved" | "rejected" } | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const ok = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2500); };

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string, after?: () => void) {
    setErr(null);
    start(async () => {
      try { const r = await fn(); if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; } after?.(); ok(msg); router.refresh(); }
      catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="section-title"><FileText className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} /><h2>المطالبات</h2></div>
        <button className="btn-primary" disabled={providers.length === 0} onClick={() => { setErr(null); setCreating(true); }}><Plus className="w-4 h-4" /> مطالبة</button>
      </div>
      {flash && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}><CheckCircle2 className="w-4 h-4" /> {flash}</div>}
      {err && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {claims.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>لا مطالبات — تُفتح تلقائياً عند فوترة مريض مؤمَّن، أو أضف واحدة يدوياً</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["المريض", "المزوّد", "المبلغ", "المعتمد", "الحالة", ""].map((h) => (
                  <th key={h} className="text-start px-2.5 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => {
                const st = STATUS[c.status];
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td className="px-2.5 py-2.5 font-bold text-white">{c.patient_name}</td>
                    <td className="px-2.5 py-2.5" style={{ color: "var(--text-3)" }}>{c.provider_name}</td>
                    <td className="px-2.5 py-2.5 ltr-nums text-white">{fmt(c.submitted_amount)}</td>
                    <td className="px-2.5 py-2.5 ltr-nums" style={{ color: c.approved_amount > 0 ? "#5dd9cb" : "var(--text-4)" }}>{c.status === "approved" ? fmt(c.approved_amount) : "—"}</td>
                    <td className="px-2.5 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}44` }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />{st.label}
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        {c.status === "pending" && (
                          <IconBtn title="تقديم" color="#5dd9cb" onClick={() => run(() => submitClaim(c.id), "قُدّمت المطالبة")}><Send className="w-3.5 h-3.5" /></IconBtn>
                        )}
                        {c.status === "submitted" && (
                          <>
                            <IconBtn title="اعتماد" color="#2dd4bf" onClick={() => { setErr(null); setResolve({ claim: c, outcome: "approved" }); }}><CheckCircle2 className="w-3.5 h-3.5" /></IconBtn>
                            <IconBtn title="رفض" color="#fda4b4" onClick={() => { setErr(null); setResolve({ claim: c, outcome: "rejected" }); }}><XCircle className="w-3.5 h-3.5" /></IconBtn>
                          </>
                        )}
                        {(c.status === "pending" || c.status === "submitted") && (
                          <IconBtn title="إلغاء" color="#71717a" onClick={() => run(() => cancelClaim(c.id), "أُلغيت المطالبة")}><Ban className="w-3.5 h-3.5" /></IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateClaimModal providers={providers} patients={patients} pending={pending} err={err} onClose={() => setCreating(false)}
          onSave={(v) => run(() => createClaim(v), "أُنشئت المطالبة", () => setCreating(false))} />
      )}
      {resolve && (
        <ResolveModal claim={resolve.claim} outcome={resolve.outcome} pending={pending} err={err} onClose={() => setResolve(null)}
          onSave={(v) => run(() => resolveClaim({ id: resolve.claim.id, outcome: resolve.outcome, ...v }), resolve.outcome === "approved" ? "اعتُمدت المطالبة" : "رُفضت المطالبة", () => setResolve(null))} />
      )}
    </div>
  );
}

function IconBtn({ children, title, color, onClick }: { children: React.ReactNode; title: string; color: string; onClick: () => void }) {
  return <button title={title} onClick={onClick} className="w-7 h-7 rounded-lg inline-flex items-center justify-center" style={{ background: `${color}14`, border: `1px solid ${color}33`, color }}>{children}</button>;
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-md panel-feature" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-start" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        {children}
      </div>
    </div>
  );
}

function CreateClaimModal({ providers, patients, onSave, onClose, pending, err }: {
  providers: ProviderRow[]; patients: PatientOpt[]; pending: boolean; err: string | null;
  onSave: (v: { patient_id: string; provider_id: string; submitted_amount: number }) => void; onClose: () => void;
}) {
  const [f, setF] = useState({ patient_id: "", provider_id: "", submitted_amount: "" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block"><span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>{label}</span>{children}</label>
  );
  return (
    <Overlay onClose={onClose}>
      <h3 className="font-bold text-white text-lg mb-3">مطالبة جديدة</h3>
      <div className="space-y-3">
        <F label="المريض"><select className="field" value={f.patient_id} onChange={(e) => set("patient_id", e.target.value)}><option value="">— اختر —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>
        <F label="المزوّد"><select className="field" value={f.provider_id} onChange={(e) => set("provider_id", e.target.value)}><option value="">— اختر —</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.provider_name_ar || p.provider_name}</option>)}</select></F>
        <F label="المبلغ المطالَب به (ر.ع)"><input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={f.submitted_amount} onChange={(e) => set("submitted_amount", e.target.value)} /></F>
        {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
        <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSave({ patient_id: f.patient_id, provider_id: f.provider_id, submitted_amount: Number(f.submitted_amount) })}>{pending ? "…" : "إنشاء المطالبة"}</button>
      </div>
    </Overlay>
  );
}

function ResolveModal({ claim, outcome, onSave, onClose, pending, err }: {
  claim: ClaimRow; outcome: "approved" | "rejected"; pending: boolean; err: string | null;
  onSave: (v: { approved_amount?: number; rejection_reason?: string }) => void; onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(claim.submitted_amount));
  const [reason, setReason] = useState("");
  return (
    <Overlay onClose={onClose}>
      <h3 className="font-bold text-white text-lg mb-3">{outcome === "approved" ? "اعتماد المطالبة" : "رفض المطالبة"}</h3>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-3)" }}>{claim.patient_name} · {claim.provider_name} · مطالَب: <span className="ltr-nums">{fmt(claim.submitted_amount)}</span></p>
      <div className="space-y-3">
        {outcome === "approved" ? (
          <label className="block"><span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>المبلغ المعتمد (ر.ع)</span>
            <input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        ) : (
          <label className="block"><span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>سبب الرفض</span>
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اختياري" /></label>
        )}
        {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
        <button className="btn-primary w-full justify-center" disabled={pending}
          onClick={() => onSave(outcome === "approved" ? { approved_amount: Number(amount) } : { rejection_reason: reason })}>
          {pending ? "…" : outcome === "approved" ? "اعتماد" : "رفض"}
        </button>
      </div>
    </Overlay>
  );
}
