"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Pencil, Trash2, CheckCircle2, AlertTriangle, MessageSquare, Power,
} from "lucide-react";
import {
  saveTemplate, toggleTemplate, deleteTemplate,
  TEMPLATE_TYPES, TEMPLATE_VARIABLES, type TemplateType, type TemplateInput,
} from "@/app/actions/templates";
import { F } from "@/components/ui/num-field";

export type TemplateRow = {
  id: string; name: string; template_type: string; channel: string;
  body_ar: string; body_en: string | null; is_active: boolean;
};

/* Arabic labels for the REAL notification_template_type enum values. The page
   previously mapped invented names (birthday/promotion/…) that don't exist in the
   database, so live templates rendered as raw enum strings. */
export const TYPE_AR: Record<string, string> = {
  appointment_reminder_24h: "تذكير موعد (24 ساعة)",
  appointment_reminder_2h: "تذكير موعد (ساعتين)",
  appointment_confirmation: "تأكيد موعد",
  appointment_cancellation: "إلغاء موعد",
  invoice_ready: "الفاتورة جاهزة",
  payment_received: "تأكيد استلام دفعة",
  no_show_followup: "متابعة عدم الحضور",
  sura_welcome: "ترحيب سُرى",
  custom: "مخصّص",
};

const CHANNELS = [
  { v: "whatsapp", l: "واتساب" },
  { v: "sms", l: "رسالة نصية" },
  { v: "email", l: "بريد إلكتروني" },
];

export function TemplatesManager({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<TemplateRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string, close?: boolean) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        if (close) setModal(null);
        setFlash(msg); setTimeout(() => setFlash(null), 2500);
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="section-title">
          <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>قوالب الرسائل</h2>
        </div>
        <button className="btn-primary" onClick={() => { setErr(null); setModal("new"); }}>
          <Plus className="w-4 h-4" /> قالب جديد
        </button>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        الرسائل التي تُرسل تلقائياً للمرضى (تذكير موعد، تأكيد، متابعة…) — اكتبها بنفسك وعدّلها وقتما تشاء
      </p>

      {flash && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}><CheckCircle2 className="w-4 h-4" /> {flash}</div>}
      {err && !modal && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {templates.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
          <p className="text-sm text-white font-semibold">لا قوالب بعد</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>أضف أول قالب — مثلاً تذكير موعد قبل 24 ساعة</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)", opacity: t.is_active ? 1 : 0.55 }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-white text-[13px]">{t.name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-3)" }}>
                    {TYPE_AR[t.template_type] ?? t.template_type}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(45,212,191,0.1)", color: "#5dd9cb" }}>
                    {CHANNELS.find((c) => c.v === t.channel)?.l ?? t.channel}
                  </span>
                  {!t.is_active && <span className="text-[10px]" style={{ color: "#fbbf24" }}>معطّل</span>}
                </div>
                <p className="text-[11.5px] mt-1 line-clamp-2" style={{ color: "var(--text-3)" }}>{t.body_ar}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <IconBtn title={t.is_active ? "تعطيل" : "تفعيل"} color={t.is_active ? "#fbbf24" : "#5dd9cb"}
                  onClick={() => run(() => toggleTemplate(t.id, !t.is_active), t.is_active ? "عُطّل القالب" : "فُعّل القالب")}>
                  <Power className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn title="تعديل" color="var(--text-2)" onClick={() => { setErr(null); setModal(t); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn title="حذف" color="#fda4b4" onClick={() => run(() => deleteTemplate(t.id), "حُذف القالب")}>
                  <Trash2 className="w-3.5 h-3.5" />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <TemplateModal row={modal === "new" ? null : modal} pending={pending} err={err}
          onClose={() => setModal(null)}
          onSave={(v) => run(() => saveTemplate(v), modal === "new" ? "أُضيف القالب" : "حُدّث القالب", true)} />
      )}
    </div>
  );
}

function IconBtn({ children, title, color, onClick }: {
  children: React.ReactNode; title: string; color: string; onClick: () => void;
}) {
  return (
    <button title={title} onClick={onClick} className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", color }}>
      {children}
    </button>
  );
}

function TemplateModal({ row, onSave, onClose, pending, err }: {
  row: TemplateRow | null; pending: boolean; err: string | null;
  onSave: (v: TemplateInput) => void; onClose: () => void;
}) {
  const [f, setF] = useState<TemplateInput>({
    id: row?.id,
    name: row?.name ?? "",
    template_type: (row?.template_type as TemplateType) ?? "appointment_reminder_24h",
    channel: row?.channel ?? "whatsapp",
    body_ar: row?.body_ar ?? "",
    body_en: row?.body_en ?? "",
    is_active: row?.is_active ?? true,
  });
  const set = (k: keyof TemplateInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  /** insert a placeholder at the end of the Arabic body — no need to type braces */
  const addVar = (v: string) => setF((p) => ({ ...p, body_ar: `${p.body_ar}${p.body_ar.endsWith(" ") || !p.body_ar ? "" : " "}${v}` }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg panel-feature max-h-[90vh] overflow-y-auto" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-start" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        <h3 className="font-bold text-white text-lg mb-3">{row ? "تعديل قالب" : "قالب جديد"}</h3>
        <div className="space-y-3">
          <F label="اسم القالب *">
            <input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: تذكير قبل يوم" />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="يُستخدم لـ">
              <select className="field" value={f.template_type} onChange={(e) => set("template_type", e.target.value)}>
                {TEMPLATE_TYPES.map((t) => <option key={t} value={t}>{TYPE_AR[t]}</option>)}
              </select>
            </F>
            <F label="القناة">
              <select className="field" value={f.channel} onChange={(e) => set("channel", e.target.value)}>
                {CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </F>
          </div>

          <F label="نص الرسالة (عربي) *">
            <textarea className="field" rows={4} style={{ resize: "vertical" }}
              value={f.body_ar} onChange={(e) => set("body_ar", e.target.value)}
              placeholder="مرحباً {{patient_name}}، نذكّرك بموعدك في {{clinic_name}} يوم {{date}} الساعة {{time}}." />
          </F>

          <div>
            <p className="text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>اضغط لإضافة بيانات تُستبدل تلقائياً:</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => addVar(v)}
                  className="text-[10.5px] px-2 py-1 rounded-lg ltr-nums" dir="ltr"
                  style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.2)", color: "#5dd9cb" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <F label="نص إنجليزي (اختياري)">
            <textarea className="field" rows={3} dir="ltr" style={{ resize: "vertical" }}
              value={f.body_en ?? ""} onChange={(e) => set("body_en", e.target.value)}
              placeholder="Hi {{patient_name}}, a reminder of your appointment…" />
          </F>

          <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-2)" }}>
            <input type="checkbox" checked={f.is_active ?? true} onChange={(e) => set("is_active", e.target.checked)} />
            القالب مُفعّل (يُستخدم في الإرسال التلقائي)
          </label>

          {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
          <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSave(f)}>
            {pending ? "…" : "حفظ القالب"}
          </button>
        </div>
      </div>
    </div>
  );
}
