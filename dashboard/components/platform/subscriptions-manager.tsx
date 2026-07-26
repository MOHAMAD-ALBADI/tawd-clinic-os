"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil, RefreshCw, CalendarPlus, X, CheckCircle2, AlertTriangle, ChevronLeft,
} from "lucide-react";
import { updateSubscription, renewSubscriptionMonth, extendTrial } from "@/app/actions/platform";
import { NumField, F } from "@/components/ui/num-field";

export type SubRow = {
  clinicId: string; clinicName: string;
  plan: string; status: string; priceOmr: number;
  periodEnd: string | null; daysLeft: number | null;
};

/* Plan codes come from the catalogue, not from a union in this file. They used
   to be hardcoded to the four original tiers, so a template the founder created
   after the fact could never be selected here. */
export type PlanOption = { code: string; name_ar: string; price_omr: number };

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  trial:     { label: "تجريبي",  color: "#fbbf24" },
  active:    { label: "نشط",     color: "#34d399" },
  past_due:  { label: "متأخر",   color: "#fda4b4" },
  paused:    { label: "موقوف",   color: "#a1a1aa" },
  cancelled: { label: "ملغى",    color: "#71717a" },
};
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function SubscriptionsManager({ rows, plans }: { rows: SubRow[]; plans: PlanOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<SubRow | null>(null);
  const [extending, setExtending] = useState<SubRow | null>(null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3500); }
  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string, after?: () => void) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        after?.(); ok(msg); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="space-y-4">
      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && !editing && !extending && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel text-center py-16">
          <p className="text-sm" style={{ color: "var(--text-3)" }}>لا اشتراكات بعد</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["العيادة", "الباقة", "السعر/شهر", "الحالة", "ينتهي", ""].map((h) => (
                    <th key={h} className="text-start px-3 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = SUB_STATUS[r.status] ?? SUB_STATUS.trial;
                  const d = r.daysLeft;
                  const expired = d !== null && d <= 0;
                  const soon = d !== null && d > 0 && d <= 7;

                  return (
                    <tr key={r.clinicId} style={{ borderTop: "1px solid var(--hairline-2)" }}>
                      <td className="px-3 py-3">
                        <Link href={`/platform-admin/clinics/${r.clinicId}`}
                          className="font-bold text-white hover:underline">{r.clinicName}</Link>
                      </td>
                      <td className="px-3 py-3" style={{ color: "var(--text-2)" }}>{r.plan}</td>
                      <td className="px-3 py-3 ltr-nums font-bold"
                        style={{ color: r.priceOmr > 0 ? "var(--accent-1)" : "var(--text-4)" }}>
                        {fmt(r.priceOmr)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40` }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {d === null ? (
                          <span style={{ color: "var(--text-4)" }}>—</span>
                        ) : (
                          <span className="text-[12px] ltr-nums font-bold"
                            style={{ color: expired ? "#fda4b4" : soon ? "#fbbf24" : "var(--text-3)" }}>
                            {expired ? `منتهٍ منذ ${Math.abs(d)} يوم` : `${d} يوم`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-ghost" disabled={pending} title="تغيير الباقة والسعر"
                            onClick={() => { setErr(null); setEditing(r); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {r.status === "trial" && (
                            <button className="btn-ghost" disabled={pending} title="تمديد التجربة"
                              onClick={() => { setErr(null); setExtending(r); }}>
                              <CalendarPlus className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
                            </button>
                          )}
                          <button className="btn-ghost" disabled={pending} title="تجديد شهر وتفعيل"
                            onClick={() => run(() => renewSubscriptionMonth(r.clinicId), `جُدّد اشتراك ${r.clinicName} شهراً`)}>
                            <RefreshCw className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                          </button>
                          <Link href={`/platform-admin/clinics/${r.clinicId}`} className="btn-ghost" title="ملف العيادة">
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <PlanDialog
          row={editing} plans={plans} pending={pending} err={err}
          onClose={() => setEditing(null)}
          onSave={(plan, price, status) =>
            run(() => updateSubscription(editing.clinicId, { plan, price_omr: price, status }),
                `حُدّث اشتراك ${editing.clinicName}`, () => setEditing(null))}
        />
      )}

      {extending && (
        <ExtendDialog
          row={extending} pending={pending} err={err}
          onClose={() => setExtending(null)}
          onSave={(days) =>
            run(() => extendTrial(extending.clinicId, days),
                `مُدّدت تجربة ${extending.clinicName} ${days} يوم`, () => setExtending(null))}
        />
      )}
    </div>
  );
}

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 460, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-black text-white">{title}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrLine({ err }: { err: string | null }) {
  if (!err) return null;
  return (
    <div className="flex items-center gap-2 text-[12.5px] px-3.5 py-2.5 rounded-xl mt-3"
      style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
      <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
    </div>
  );
}

function PlanDialog({
  row, plans, pending, err, onClose, onSave,
}: {
  row: SubRow; plans: PlanOption[]; pending: boolean; err: string | null; onClose: () => void;
  onSave: (plan: string, price: number, status: "trial" | "active" | "suspended") => void;
}) {
  /* Keep the clinic's current code even if that template was retired — showing
     a different plan than the one they are on would misreport the contract. */
  const options = plans.some((p) => p.code === row.plan)
    ? plans
    : [{ code: row.plan, name_ar: `${row.plan} (متوقّف)`, price_omr: row.priceOmr }, ...plans];
  const [plan, setPlan] = useState<string>(row.plan);
  const [price, setPrice] = useState(String(row.priceOmr));
  /* "paused" and "past_due" are states the system arrives at, not ones an
     operator sets by hand — the three here are the real decisions. */
  const [status, setStatus] = useState<"trial" | "active" | "suspended">(
    row.status === "active" ? "active" : row.status === "trial" ? "trial" : "suspended"
  );

  return (
    <Shell title={`اشتراك ${row.clinicName}`} onClose={onClose}>
      <div className="space-y-4">
        <F label="الباقة">
          <select className="field" value={plan} style={{ cursor: "pointer" }}
            onChange={(e) => {
              const next = e.target.value;
              setPlan(next);
              /* Switching template offers its price rather than silently keeping
                 the old one — the operator can still overwrite it below. */
              const t = options.find((o) => o.code === next);
              if (t) setPrice(String(t.price_omr));
            }}>
            {options.map((p) => (
              <option key={p.code} value={p.code}>{p.name_ar} — {p.price_omr.toFixed(3)} ر.ع</option>
            ))}
          </select>
          <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
            للتفصيل الكامل (الخدمات والحدود وسعر الطبيب) افتح «الاتفاق والصلاحيات» في ملف العيادة
          </span>
        </F>
        <F label="السعر الشهري (ر.ع)">
          <NumField value={price} onChange={setPrice} placeholder="0.000" />
        </F>
        <F label="الحالة">
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={{ cursor: "pointer" }}>
            <option value="trial">تجريبي</option>
            <option value="active">نشط</option>
            <option value="suspended">موقوف</option>
          </select>
          <span className="text-[10.5px] block mt-1" style={{ color: "var(--text-4)" }}>
            الإيقاف يمنع دخول موظفي العيادة ويُخرج اشتراكها من الدخل الشهري
          </span>
        </F>
        <ErrLine err={err} />
        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending}
            onClick={() => onSave(plan, Number(price) || 0, status)}>حفظ</button>
        </div>
      </div>
    </Shell>
  );
}

function ExtendDialog({
  row, pending, err, onClose, onSave,
}: { row: SubRow; pending: boolean; err: string | null; onClose: () => void; onSave: (days: number) => void }) {
  const [days, setDays] = useState("14");
  return (
    <Shell title={`تمديد تجربة ${row.clinicName}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
          يُحسب التمديد من تاريخ الانتهاء الحالي أو من اليوم — أيّهما أبعد، فالتمديد مرتين لا يقصّر المدة.
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["7", "14", "30"].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className="text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
              style={{
                background: days === d ? "rgb(var(--accent-1-rgb) / 0.14)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${days === d ? "rgb(var(--accent-1-rgb) / 0.35)" : "var(--hairline)"}`,
                color: days === d ? "var(--accent-1)" : "var(--text-3)",
              }}>
              {d} يوم
            </button>
          ))}
        </div>
        <F label="أو عدد أيام مخصّص">
          <NumField value={days} onChange={setDays} allowDecimal={false} max={90} />
        </F>
        <ErrLine err={err} />
        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending || !(Number(days) > 0)}
            onClick={() => onSave(Number(days))}>تمديد</button>
        </div>
      </div>
    </Shell>
  );
}
