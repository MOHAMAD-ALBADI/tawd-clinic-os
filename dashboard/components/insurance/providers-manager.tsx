"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Archive, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";
import { saveProvider, archiveProvider } from "@/app/actions/insurance";

export type ProviderRow = {
  id: string; provider_name: string; provider_name_ar: string;
  dhamani_code: string; contact_email: string; notes: string;
};

export function ProvidersManager({ providers }: { providers: ProviderRow[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<ProviderRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const ok = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2500); };

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string) {
    setErr(null);
    start(async () => {
      try { const r = await fn(); if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; } setModal(null); ok(msg); router.refresh(); }
      catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="section-title"><Building2 className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} /><h2>مزوّدو التأمين</h2></div>
        <button className="btn-ghost" onClick={() => { setErr(null); setModal("new"); }}><Plus className="w-3.5 h-3.5" /> مزوّد</button>
      </div>
      {flash && <div className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-xl mb-3" style={{ background: "rgba(45,212,191,0.1)", color: "#5dd9cb" }}><CheckCircle2 className="w-3.5 h-3.5" /> {flash}</div>}
      {providers.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>لا مزوّدون — أضف أول مزوّد تأمين</p>
      ) : (
        <div className="space-y-1.5">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-[13px] truncate">{p.provider_name_ar || p.provider_name}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>{p.dhamani_code ? `ضمان: ${p.dhamani_code}` : p.contact_email || "—"}</p>
              </div>
              <button title="تعديل" onClick={() => { setErr(null); setModal(p); }} className="w-7 h-7 rounded-lg inline-flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", color: "var(--text-2)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button title="أرشفة" onClick={() => run(() => archiveProvider(p.id), "تمت الأرشفة")} className="w-7 h-7 rounded-lg inline-flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", color: "var(--text-3)" }}><Archive className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ProviderModal row={modal === "new" ? null : modal} pending={pending} err={err} onClose={() => setModal(null)}
          onSave={(v) => run(() => saveProvider(v), modal === "new" ? "أُضيف المزوّد" : "حُدّث المزوّد")} />
      )}
    </div>
  );
}

function ProviderModal({ row, onSave, onClose, pending, err }: {
  row: ProviderRow | null; pending: boolean; err: string | null;
  onSave: (v: { id?: string; provider_name: string; provider_name_ar?: string; dhamani_code?: string; contact_email?: string; notes?: string }) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    provider_name: row?.provider_name ?? "", provider_name_ar: row?.provider_name_ar ?? "",
    dhamani_code: row?.dhamani_code ?? "", contact_email: row?.contact_email ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block"><span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>{label}</span>{children}</label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-md panel-feature" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-start" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        <h3 className="font-bold text-white text-lg mb-3">{row ? "تعديل مزوّد" : "مزوّد جديد"}</h3>
        <div className="space-y-3">
          <F label="الاسم (عربي)"><input className="field" value={f.provider_name_ar} onChange={(e) => set("provider_name_ar", e.target.value)} placeholder="ضمان، الملكية للتأمين…" /></F>
          <F label="الاسم (إنجليزي) *"><input className="field" dir="ltr" value={f.provider_name} onChange={(e) => set("provider_name", e.target.value)} placeholder="Dhamani" /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="رمز ضمان"><input className="field ltr-nums" dir="ltr" value={f.dhamani_code} onChange={(e) => set("dhamani_code", e.target.value)} /></F>
            <F label="البريد"><input className="field ltr-nums" dir="ltr" value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="claims@" /></F>
          </div>
          {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
          <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSave({ id: row?.id, ...f })}>{pending ? "…" : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}
