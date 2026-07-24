"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Trash2, Check, CheckCircle2, AlertTriangle, ClipboardList, ChevronLeft,
} from "lucide-react";
import {
  createPlan, updatePlanStatus, deletePlan, addPlanItem, togglePlanItem, deletePlanItem,
  type PlanStatus,
} from "@/app/actions/treatment-plans";

export type ItemRow = {
  id: string; description: string; tooth_number: string;
  quantity: number; unit_price: number; line_total: number; status: "pending" | "done";
};
export type PlanRow = {
  id: string; title: string; status: PlanStatus; total_estimate: number;
  patient_name: string; doctor_name: string; items: ItemRow[];
};
export type Opt = { id: string; label: string };
export type SvcOpt = { id: string; label: string; price: number };

const STATUS: Record<PlanStatus, { label: string; color: string }> = {
  draft: { label: "مسودّة", color: "#a1a1aa" },
  proposed: { label: "معروضة", color: "#fbbf24" },
  accepted: { label: "مقبولة", color: "#5dd9cb" },
  in_progress: { label: "جارية", color: "#2dd4bf" },
  completed: { label: "مكتملة", color: "#5dd9cb" },
  cancelled: { label: "ملغاة", color: "#71717a" },
};
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

const NEXT: Partial<Record<PlanStatus, { to: PlanStatus; label: string }>> = {
  draft: { to: "proposed", label: "عرض على المريض" },
  proposed: { to: "accepted", label: "موافقة المريض" },
  accepted: { to: "in_progress", label: "بدء العلاج" },
  in_progress: { to: "completed", label: "إكمال الخطة" },
};

export function TreatmentPlansManager({ plans, patients, doctors, services }: {
  plans: PlanRow[]; patients: Opt[]; doctors: Opt[]; services: SvcOpt[];
}) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(plans[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const ok = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2500); };
  const sel = plans.find((p) => p.id === selId) ?? null;

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string, after?: () => void) {
    setErr(null);
    start(async () => {
      try { const r = await fn(); if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; } after?.(); ok(msg); router.refresh(); }
      catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="grid lg:grid-cols-12 gap-4 items-start">
      {/* plans list */}
      <div className={`lg:col-span-5 panel ${sel ? "hidden lg:block" : ""}`} style={{ padding: "1.25rem" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="section-title"><ClipboardList className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} /><h2>الخطط</h2></div>
          <button className="btn-primary" onClick={() => { setErr(null); setCreating(true); }}><Plus className="w-4 h-4" /> خطة</button>
        </div>
        {flash && <div className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-xl mb-3" style={{ background: "rgba(45,212,191,0.1)", color: "#5dd9cb" }}><CheckCircle2 className="w-3.5 h-3.5" /> {flash}</div>}
        {plans.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>لا خطط بعد — أنشئ أول خطة علاج</p>
        ) : (
          <div className="space-y-1.5">
            {plans.map((p) => {
              const st = STATUS[p.status];
              const done = p.items.filter((i) => i.status === "done").length;
              return (
                <button key={p.id} onClick={() => setSelId(p.id)}
                  className="w-full text-start flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: selId === p.id ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${selId === p.id ? "rgba(45,212,191,0.3)" : "var(--hairline)"}` }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-[13px] truncate">{p.patient_name}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>{p.title} · {p.items.length ? `${done}/${p.items.length} منجز` : "لا بنود"}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${st.color}1a`, color: st.color }}>{st.label}</span>
                    <p className="text-[12px] font-bold ltr-nums text-white mt-1">{fmt(p.total_estimate)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* plan detail */}
      <div className="lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
        {!sel ? (
          <p className="text-sm text-center py-14" style={{ color: "var(--text-4)" }}>اختر خطة لعرض تفاصيلها</p>
        ) : (
          <PlanDetail plan={sel} services={services} pending={pending} err={err}
            onBack={() => setSelId(null)}
            onStatus={(to, msg) => run(() => updatePlanStatus(sel.id, to), msg)}
            onCancel={() => run(() => updatePlanStatus(sel.id, "cancelled"), "أُلغيت الخطة")}
            onDelete={() => run(() => deletePlan(sel.id), "حُذفت الخطة", () => setSelId(null))}
            onAddItem={(v, done) => run(() => addPlanItem({ plan_id: sel.id, ...v }), "أُضيف الإجراء", done)}
            onToggle={(id, done) => run(() => togglePlanItem(id, done), done ? "تم الإنجاز" : "أُعيد للانتظار")}
            onDelItem={(id) => run(() => deletePlanItem(id), "حُذف الإجراء")} />
        )}
      </div>

      {creating && (
        <CreatePlanModal patients={patients} doctors={doctors} pending={pending} err={err} onClose={() => setCreating(false)}
          onSave={(v) => run(() => createPlan(v), "أُنشئت الخطة", () => setCreating(false))} />
      )}
    </div>
  );
}

function PlanDetail({ plan, services, onStatus, onCancel, onDelete, onAddItem, onToggle, onDelItem, onBack, pending, err }: {
  plan: PlanRow; services: SvcOpt[]; pending: boolean; err: string | null;
  onBack: () => void;
  onStatus: (to: PlanStatus, msg: string) => void; onCancel: () => void; onDelete: () => void;
  onAddItem: (v: { service_id?: string | null; description: string; tooth_number?: string; quantity?: number; unit_price?: number }, done: () => void) => void;
  onToggle: (id: string, done: boolean) => void; onDelItem: (id: string) => void;
}) {
  const [it, setIt] = useState({ service_id: "", description: "", tooth_number: "", quantity: "1", unit_price: "" });
  const st = STATUS[plan.status];
  const next = NEXT[plan.status];
  const doneCount = plan.items.filter((i) => i.status === "done").length;
  const pct = plan.items.length ? Math.round((doneCount / plan.items.length) * 100) : 0;

  function pickService(id: string) {
    const s = services.find((x) => x.id === id);
    setIt((p) => ({ ...p, service_id: id, description: s ? s.label : p.description, unit_price: s ? String(s.price) : p.unit_price }));
  }
  function submitItem() {
    onAddItem(
      { service_id: it.service_id || null, description: it.description, tooth_number: it.tooth_number, quantity: Number(it.quantity), unit_price: Number(it.unit_price) },
      () => setIt({ service_id: "", description: "", tooth_number: "", quantity: "1", unit_price: "" })
    );
  }

  return (
    <div>
      <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-xs mb-2" style={{ color: "var(--text-3)" }}><ChevronLeft className="w-3.5 h-3.5" /> رجوع</button>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="font-bold text-white text-lg">{plan.patient_name}</h3>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{plan.title}{plan.doctor_name ? ` · ${plan.doctor_name}` : ""}</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}44` }}>{st.label}</span>
      </div>

      {/* status actions */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {next && <button className="btn-primary" disabled={pending} onClick={() => onStatus(next.to, "تم تحديث الحالة")}>{next.label}</button>}
        {!["cancelled", "completed"].includes(plan.status) && <button className="btn-ghost" disabled={pending} onClick={onCancel}>إلغاء الخطة</button>}
        <button className="btn-ghost" disabled={pending} onClick={onDelete} style={{ color: "#fda4b4" }}><Trash2 className="w-3.5 h-3.5" /> حذف</button>
      </div>

      {plan.items.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] mb-1" style={{ color: "var(--text-3)" }}>
            <span>التقدّم</span><span className="ltr-nums font-bold" style={{ color: "#5dd9cb" }}>{pct}% ({doneCount}/{plan.items.length})</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent-1)" }} />
          </div>
        </div>
      )}

      {/* items */}
      <div className="space-y-1.5 mb-4">
        {plan.items.map((i) => (
          <div key={i.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
            <button title={i.status === "done" ? "منجز" : "تعليم كمنجز"} onClick={() => onToggle(i.id, i.status !== "done")}
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={i.status === "done"
                ? { background: "rgba(45,212,191,0.15)", border: "1px solid rgba(45,212,191,0.4)", color: "#5dd9cb" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--hairline)", color: "var(--text-4)" }}>
              <Check className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: i.status === "done" ? "var(--text-3)" : "#fff", textDecoration: i.status === "done" ? "line-through" : "none" }}>
                {i.description}{i.tooth_number ? ` · سن ${i.tooth_number}` : ""}
              </p>
            </div>
            <span className="text-[12px] ltr-nums shrink-0" style={{ color: "var(--text-2)" }}>{i.quantity}×{fmt(i.unit_price)}</span>
            <span className="text-[13px] font-bold ltr-nums text-white shrink-0 w-20 text-end">{fmt(i.line_total)}</span>
            <button title="حذف" onClick={() => onDelItem(i.id)} className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ color: "#fda4b4" }}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {plan.items.length === 0 && <p className="text-[12px] text-center py-4" style={{ color: "var(--text-4)" }}>لا إجراءات — أضف أول إجراء للخطة</p>}
      </div>

      {/* add item */}
      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--hairline)" }}>
        <p className="text-[11px] font-bold mb-2" style={{ color: "var(--text-3)" }}>إضافة إجراء</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select className="field" value={it.service_id} onChange={(e) => pickService(e.target.value)}>
            <option value="">— خدمة (اختياري) —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input className="field" value={it.description} onChange={(e) => setIt((p) => ({ ...p, description: e.target.value }))} placeholder="وصف الإجراء" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input className="field" value={it.tooth_number} onChange={(e) => setIt((p) => ({ ...p, tooth_number: e.target.value }))} placeholder="رقم السن (اختياري)" />
          <input className="field ltr-nums" type="number" min={1} dir="ltr" value={it.quantity} onChange={(e) => setIt((p) => ({ ...p, quantity: e.target.value }))} placeholder="الكمية" />
          <input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={it.unit_price} onChange={(e) => setIt((p) => ({ ...p, unit_price: e.target.value }))} placeholder="السعر" />
        </div>
        {err && <p className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
        <button className="btn-primary" disabled={pending} onClick={submitItem}><Plus className="w-3.5 h-3.5" /> إضافة</button>
      </div>
    </div>
  );
}

function CreatePlanModal({ patients, doctors, onSave, onClose, pending, err }: {
  patients: Opt[]; doctors: Opt[]; pending: boolean; err: string | null;
  onSave: (v: { patient_id: string; doctor_id?: string | null; title?: string }) => void; onClose: () => void;
}) {
  const [f, setF] = useState({ patient_id: "", doctor_id: "", title: "خطة علاج" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block"><span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>{label}</span>{children}</label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-md panel-feature" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-start" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        <h3 className="font-bold text-white text-lg mb-3">خطة علاج جديدة</h3>
        <div className="space-y-3">
          <F label="المريض *"><select className="field" value={f.patient_id} onChange={(e) => set("patient_id", e.target.value)}><option value="">— اختر —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></F>
          <F label="الطبيب"><select className="field" value={f.doctor_id} onChange={(e) => set("doctor_id", e.target.value)}><option value="">— اختياري —</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></F>
          <F label="عنوان الخطة"><input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="خطة علاج" /></F>
          {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
          <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSave({ patient_id: f.patient_id, doctor_id: f.doctor_id || null, title: f.title })}>{pending ? "…" : "إنشاء الخطة"}</button>
        </div>
      </div>
    </div>
  );
}
