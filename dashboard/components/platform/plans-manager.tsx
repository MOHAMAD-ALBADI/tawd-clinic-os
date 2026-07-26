"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Layers, Plus, Pencil, Power, X, CheckCircle2, AlertTriangle, Users, Infinity as Inf,
} from "lucide-react";
import { savePlan, setPlanActive, type PlanInput } from "@/app/actions/platform-plans";
import { NumField, F } from "@/components/ui/num-field";

export type PlanRow = PlanInput & { subscriberCount: number };

const MODULES: { key: keyof PlanInput; label: string }[] = [
  { key: "has_sura", label: "سُرى" },
  { key: "has_inventory", label: "المخزون" },
  { key: "has_payroll", label: "الرواتب" },
  { key: "has_insurance", label: "التأمين" },
];
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const limit = (v: number | null) => (v === null ? "بلا حد" : v.toLocaleString("en-US"));

export function PlansManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3000); }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="section-title">
          <Layers className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>الباقات وأسعارها</h2>
        </div>
        <button className="btn-primary" onClick={() => { setErr(null); setEditing("new"); }}>
          <Plus className="w-4 h-4" /> باقة جديدة
        </button>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        تعديل السعر هنا يغيّر ما تُعرض به العيادات الجديدة — العيادات القائمة تبقى على ما اتفقت عليه
      </p>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && !editing && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((p) => (
          <div key={p.code} className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${p.is_active ? "var(--hairline)" : "rgba(255,255,255,0.04)"}`,
              opacity: p.is_active ? 1 : 0.55,
            }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{p.name_ar}</p>
                <p className="text-[10.5px] font-mono ltr-nums" style={{ color: "var(--text-4)" }}>{p.code}</p>
              </div>
              {!p.is_active && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-3)" }}>متوقّفة</span>
              )}
            </div>

            <p className="font-black ltr-nums leading-none mb-3" style={{ fontSize: "1.5rem", color: "var(--accent-1)" }}>
              {fmt(p.price_omr)}
              <span className="text-[11px] font-bold" style={{ color: "var(--text-4)" }}> ر.ع/شهر</span>
            </p>

            <div className="space-y-1 text-[11.5px] mb-3" style={{ color: "var(--text-3)" }}>
              <p className="flex items-center gap-1.5">
                {p.max_staff === null ? <Inf className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                <span className="ltr-nums">{limit(p.max_staff)}</span> موظف
              </p>
              <p className="ltr-nums">{limit(p.max_patients)} مريض</p>
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {MODULES.filter((m) => p[m.key]).map((m) => (
                <span key={m.key} className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", color: "var(--accent-1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.22)" }}>
                  {m.label}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: "1px solid var(--hairline-2)" }}>
              <span className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>
                {p.subscriberCount} عيادة
              </span>
              <div className="flex items-center gap-1">
                <button className="btn-ghost" disabled={pending} title="تعديل"
                  onClick={() => { setErr(null); setEditing(p); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button className="btn-ghost" disabled={pending}
                  title={p.is_active ? "إيقاف عرضها للعيادات الجديدة" : "إعادة عرضها"}
                  onClick={() => start(async () => {
                    const r = await setPlanActive(p.code, !p.is_active);
                    if (!r.ok) { setErr(r.reason); return; }
                    ok(p.is_active ? `أُوقف عرض ${p.name_ar}` : `عادت ${p.name_ar} للعرض`);
                    router.refresh();
                  })}>
                  <Power className="w-3.5 h-3.5" style={{ color: p.is_active ? "#fbbf24" : "#34d399" }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <PlanDialog
          plan={editing === "new" ? null : editing}
          pending={pending} err={err}
          onClose={() => setEditing(null)}
          onSave={(v) => start(async () => {
            setErr(null);
            const r = await savePlan(v);
            if (!r.ok) { setErr(r.reason); return; }
            setEditing(null); ok("حُفظت الباقة"); router.refresh();
          })}
        />
      )}
    </div>
  );
}

function PlanDialog({
  plan, pending, err, onClose, onSave,
}: {
  plan: PlanRow | null; pending: boolean; err: string | null;
  onClose: () => void; onSave: (v: PlanInput) => void;
}) {
  const [v, setV] = useState({
    code: plan?.code ?? "",
    name_ar: plan?.name_ar ?? "",
    price: String(plan?.price_omr ?? ""),
    staff: plan?.max_staff === null || plan === null ? "" : String(plan.max_staff),
    patients: plan?.max_patients === null || plan === null ? "" : String(plan.max_patients),
    has_sura: plan?.has_sura ?? true,
    has_inventory: plan?.has_inventory ?? false,
    has_payroll: plan?.has_payroll ?? false,
    has_insurance: plan?.has_insurance ?? false,
    is_active: plan?.is_active ?? true,
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 520, borderRadius: "1.25rem", padding: "1.5rem", maxHeight: "88vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-black text-white">{plan ? `تعديل ${plan.name_ar}` : "باقة جديدة"}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="الاسم بالعربية">
              <input className="field" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} placeholder="الاحترافية" />
            </F>
            <F label="الرمز (إنجليزي، لا يتغيّر بعد الحفظ)">
              <input className="field ltr-nums" dir="ltr" value={v.code} disabled={!!plan}
                onChange={(e) => set("code", e.target.value)} placeholder="pro"
                style={plan ? { opacity: 0.55 } : undefined} />
            </F>
          </div>

          <F label="السعر الشهري (ر.ع)">
            <NumField value={v.price} onChange={(x) => set("price", x)} placeholder="0.000" />
          </F>

          <div className="grid sm:grid-cols-2 gap-3">
            <F label="حد الموظفين — اتركه فارغاً لبلا حد">
              <NumField value={v.staff} allowDecimal={false} onChange={(x) => set("staff", x)} placeholder="بلا حد" />
            </F>
            <F label="حد المرضى — اتركه فارغاً لبلا حد">
              <NumField value={v.patients} allowDecimal={false} onChange={(x) => set("patients", x)} placeholder="بلا حد" />
            </F>
          </div>

          <F label="الوحدات المشمولة">
            <div className="flex flex-wrap gap-1.5">
              {MODULES.map((m) => {
                const on = v[m.key as keyof typeof v] as boolean;
                return (
                  <button key={m.key} type="button"
                    onClick={() => set(m.key as keyof typeof v, !on as never)}
                    className="text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
                    style={{
                      background: on ? "rgb(var(--accent-1-rgb) / 0.14)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.35)" : "var(--hairline)"}`,
                      color: on ? "var(--accent-1)" : "var(--text-3)",
                    }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </F>

          {err && (
            <div className="flex items-center gap-2 text-[12.5px] px-3.5 py-2.5 rounded-xl"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
              <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>إلغاء</button>
            <button className="btn-primary" disabled={pending}
              onClick={() => onSave({
                code: v.code, name_ar: v.name_ar,
                price_omr: Number(v.price) || 0,
                max_staff: v.staff.trim() === "" ? null : Number(v.staff),
                max_patients: v.patients.trim() === "" ? null : Number(v.patients),
                has_sura: v.has_sura, has_inventory: v.has_inventory,
                has_payroll: v.has_payroll, has_insurance: v.has_insurance,
                is_active: v.is_active,
              })}>
              حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
