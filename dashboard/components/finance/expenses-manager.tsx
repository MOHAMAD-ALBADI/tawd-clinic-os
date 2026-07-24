"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, CheckCircle2, AlertTriangle, Receipt, Link2 } from "lucide-react";
import { addExpense, deleteExpense, type ExpenseInput } from "@/app/actions/expenses";

export type ExpenseRow = {
  id: string; category: string; amount: number; expense_date: string;
  payment_method: string; description: string; vendor: string; ref_type: string;
};

const CATEGORIES = ["إيجار", "فواتير", "رواتب", "مستلزمات", "تسويق", "صيانة", "أخرى"];
const METHOD_AR: Record<string, string> = { cash: "نقدي", bank_transfer: "تحويل", card: "بطاقة" };
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export function ExpensesManager({ expenses }: { expenses: ExpenseRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 2500); }

  function submit(v: ExpenseInput) {
    setErr(null);
    start(async () => {
      try {
        const r = await addExpense(v);
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        setOpen(false); ok("سُجّل المصروف"); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }
  function del(id: string) {
    start(async () => { try { const r = await deleteExpense(id); if (r.ok) { ok("حُذف المصروف"); router.refresh(); } } catch { /* ignore */ } });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="section-title"><Receipt className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} /><h2>مصروفات الشهر</h2></div>
        <button className="btn-primary" onClick={() => { setErr(null); setOpen(true); }}><Plus className="w-4 h-4" /> إضافة مصروف</button>
      </div>

      {flash && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}><CheckCircle2 className="w-4 h-4" /> {flash}</div>}

      {expenses.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>لا مصروفات هذا الشهر — أضف أول مصروف</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["التاريخ", "الفئة", "البيان", "الطريقة", "المبلغ", ""].map((h) => (
                  <th key={h} className="text-start px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td className="px-3 py-2.5 ltr-nums" style={{ color: "var(--text-3)" }}>{e.expense_date}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-white font-semibold">{e.category}</span>
                    {e.ref_type !== "manual" && <Link2 className="w-3 h-3 inline ms-1" style={{ color: "var(--accent-1)" }} />}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-3)" }}>{e.description || e.vendor || "—"}</td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-4)" }}>{METHOD_AR[e.payment_method] ?? e.payment_method}</td>
                  <td className="px-3 py-2.5 font-bold ltr-nums text-white">{fmt(e.amount)}</td>
                  <td className="px-3 py-2.5 text-end">
                    {e.ref_type === "manual" && (
                      <button title="حذف" disabled={pending} onClick={() => del(e.id)}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
                        style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] mt-2" style={{ color: "var(--text-4)" }}>
            <Link2 className="w-3 h-3 inline" /> = مسجَّل تلقائياً (رواتب/مخزون) — يُدار من وحدته
          </p>
        </div>
      )}

      {open && <AddModal pending={pending} err={err} onClose={() => setOpen(false)} onSubmit={submit} />}
    </div>
  );
}

function AddModal({ onSubmit, onClose, pending, err }: {
  pending: boolean; err: string | null; onSubmit: (v: ExpenseInput) => void; onClose: () => void;
}) {
  const [f, setF] = useState<ExpenseInput>({
    category: "إيجار", amount: 0, expense_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash", description: "", vendor: "",
  });
  const set = (k: keyof ExpenseInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block"><span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>{label}</span>{children}</label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-md panel-feature" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-start" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        <h3 className="font-bold text-white text-lg mb-3">مصروف جديد</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="الفئة">
              <select className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="المبلغ (ر.ع) *"><input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="التاريخ"><input className="field ltr-nums" type="date" dir="ltr" value={f.expense_date} onChange={(e) => set("expense_date", e.target.value)} /></F>
            <F label="طريقة الدفع">
              <select className="field" value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
                <option value="cash">نقدي</option><option value="bank_transfer">تحويل</option><option value="card">بطاقة</option>
              </select>
            </F>
          </div>
          <F label="البيان"><input className="field" value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="مثال: إيجار المحل - يوليو" /></F>
          <F label="المورد / الجهة"><input className="field" value={f.vendor ?? ""} onChange={(e) => set("vendor", e.target.value)} placeholder="اختياري" /></F>
          {err && <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
          <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSubmit(f)}>{pending ? "…" : "تسجيل المصروف"}</button>
        </div>
      </div>
    </div>
  );
}
