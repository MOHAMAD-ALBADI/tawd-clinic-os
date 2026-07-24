"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, PackagePlus, ClipboardCheck, Pencil, Archive,
  X, AlertTriangle, CheckCircle2, Boxes,
} from "lucide-react";
import {
  createItem, updateItem, archiveItem, receiveStock, adjustStock,
  type ItemInput,
} from "@/app/actions/inventory";

export type InvItem = {
  id: string;
  name: string;
  name_ar: string | null;
  category: string | null;
  unit: string;
  current_stock: number;
  reorder_level: number;
  cost_price: number;
  tracks_expiry: boolean;
};
export type InvSupplier = { id: string; name: string };

type Modal =
  | { kind: "add" }
  | { kind: "edit"; item: InvItem }
  | { kind: "receive"; item: InvItem }
  | { kind: "adjust"; item: InvItem }
  | null;

const num = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(n);

export function InventoryBoard({ items, suppliers }: { items: InvItem[]; suppliers: InvSupplier[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, okMsg: string) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.reason ?? "تعذّر تنفيذ العملية"); return; }
        setModal(null);
        setFlash(okMsg);
        setTimeout(() => setFlash(null), 3000);
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  const low = (i: InvItem) => i.reorder_level > 0 && i.current_stock <= i.reorder_level;

  return (
    <div className="space-y-4">
      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="section-title">
          <Boxes className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>الأصناف</h2>
          <span className="text-[11px] font-bold ltr-nums px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-3)" }}>{items.length}</span>
        </div>
        <button className="btn-primary" onClick={() => { setErr(null); setModal({ kind: "add" }); }}>
          <Plus className="w-4 h-4" /> إضافة صنف
        </button>
      </div>

      {items.length === 0 ? (
        <div className="panel text-center py-16" style={{ padding: "1.25rem" }}>
          <Boxes className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>لا أصناف بعد — أضف أول صنف وابدأ استلام المخزون</p>
        </div>
      ) : (
        <div className="panel overflow-hidden" style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["الصنف", "الفئة", "الرصيد", "حد الطلب", "التكلفة", ""].map((h) => (
                    <th key={h} className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{i.name_ar ?? i.name}</p>
                      {i.name_ar && <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{i.name}</p>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-3)" }}>{i.category ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold ltr-nums text-white">{num(i.current_stock)}</span>
                      <span className="text-[11px] mx-1" style={{ color: "var(--text-4)" }}>{i.unit}</span>
                      {low(i) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ms-1"
                          style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
                          <AlertTriangle className="w-2.5 h-2.5" /> منخفض
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 ltr-nums" style={{ color: "var(--text-3)" }}>{num(i.reorder_level)}</td>
                    <td className="px-4 py-3 ltr-nums" style={{ color: "var(--text-3)" }}>{num(i.cost_price)} ر.ع</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <IconBtn title="استلام مخزون" onClick={() => { setErr(null); setModal({ kind: "receive", item: i }); }}><PackagePlus className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title="جرد / تعديل الكمية" onClick={() => { setErr(null); setModal({ kind: "adjust", item: i }); }}><ClipboardCheck className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title="تعديل الصنف" onClick={() => { setErr(null); setModal({ kind: "edit", item: i }); }}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title="أرشفة" onClick={() => run(() => archiveItem(i.id), "تمت الأرشفة")}><Archive className="w-3.5 h-3.5" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Overlay onClose={() => setModal(null)}>
          {(modal.kind === "add" || modal.kind === "edit") && (
            <ItemForm
              initial={modal.kind === "edit" ? modal.item : undefined}
              pending={pending} err={err}
              onSubmit={(v) =>
                run(() => (modal.kind === "edit" ? updateItem(modal.item.id, v) : createItem(v)),
                  modal.kind === "edit" ? "تم تحديث الصنف" : "تمت إضافة الصنف")}
            />
          )}
          {modal.kind === "receive" && (
            <ReceiveForm item={modal.item} suppliers={suppliers} pending={pending} err={err}
              onSubmit={(v) => run(() => receiveStock({ item_id: modal.item.id, ...v }), "تم تسجيل الاستلام")} />
          )}
          {modal.kind === "adjust" && (
            <AdjustForm item={modal.item} pending={pending} err={err}
              onSubmit={(v) => run(() => adjustStock({ item_id: modal.item.id, ...v }), "تم تعديل الكمية")} />
          )}
        </Overlay>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", color: "var(--text-2)" }}>
      {children}
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-md panel-feature" style={{ padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-start mb-1" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>{label}</span>
      {children}
    </label>
  );
}

function ErrLine({ err }: { err: string | null }) {
  if (!err) return null;
  return <p className="text-[12px] flex items-center gap-1.5" style={{ color: "#fda4b4" }}><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>;
}

function ItemForm({ initial, onSubmit, pending, err }: {
  initial?: InvItem; pending: boolean; err: string | null; onSubmit: (v: ItemInput) => void;
}) {
  const [f, setF] = useState<ItemInput>({
    name: initial?.name ?? "", name_ar: initial?.name_ar ?? "",
    category: initial?.category ?? "", unit: initial?.unit ?? "piece",
    reorder_level: initial?.reorder_level ?? 0, cost_price: initial?.cost_price ?? 0,
    tracks_expiry: initial?.tracks_expiry ?? true,
  });
  const set = (k: keyof ItemInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-white text-lg mb-1">{initial ? "تعديل صنف" : "صنف جديد"}</h3>
      <Field label="الاسم (عربي)"><input className="field" value={f.name_ar ?? ""} onChange={(e) => set("name_ar", e.target.value)} placeholder="مثال: مخدر ليدوكايين" /></Field>
      <Field label="الاسم (إنجليزي) *"><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Lidocaine" dir="ltr" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الفئة"><input className="field" value={f.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="مخدر، حشوات…" /></Field>
        <Field label="الوحدة"><input className="field" value={f.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="علبة، مل، حبة" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="حد الطلب (تنبيه)"><input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={f.reorder_level ?? 0} onChange={(e) => set("reorder_level", e.target.value)} /></Field>
        <Field label="سعر التكلفة (ر.ع)"><input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={f.cost_price ?? 0} onChange={(e) => set("cost_price", e.target.value)} /></Field>
      </div>
      <ErrLine err={err} />
      <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSubmit(f)}>
        {pending ? "…" : initial ? "حفظ التغييرات" : "إضافة الصنف"}
      </button>
    </div>
  );
}

function ReceiveForm({ item, suppliers, onSubmit, pending, err }: {
  item: InvItem; suppliers: InvSupplier[]; pending: boolean; err: string | null;
  onSubmit: (v: { qty: number; cost_price?: number; expiry_date?: string | null; supplier_id?: string | null; batch_number?: string }) => void;
}) {
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(item.cost_price || ""));
  const [expiry, setExpiry] = useState("");
  const [supplier, setSupplier] = useState("");
  const [batch, setBatch] = useState("");
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-white text-lg mb-1">استلام مخزون</h3>
      <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{item.name_ar ?? item.name} — الرصيد الحالي <span className="ltr-nums font-bold text-white">{num(item.current_stock)}</span> {item.unit}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الكمية المستلمة *"><input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></Field>
        <Field label="سعر التكلفة (ر.ع)"><input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاريخ الانتهاء"><input className="field ltr-nums" type="date" dir="ltr" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        <Field label="رقم الدفعة"><input className="field" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="اختياري" /></Field>
      </div>
      {suppliers.length > 0 && (
        <Field label="المورد">
          <select className="field" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">— بدون —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      <ErrLine err={err} />
      <button className="btn-primary w-full justify-center" disabled={pending}
        onClick={() => onSubmit({ qty: Number(qty), cost_price: Number(cost) || 0, expiry_date: expiry || null, supplier_id: supplier || null, batch_number: batch })}>
        {pending ? "…" : "تسجيل الاستلام"}
      </button>
    </div>
  );
}

function AdjustForm({ item, onSubmit, pending, err }: {
  item: InvItem; pending: boolean; err: string | null;
  onSubmit: (v: { new_qty: number; reason?: string }) => void;
}) {
  const [qty, setQty] = useState(String(item.current_stock));
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-white text-lg mb-1">جرد / تعديل الكمية</h3>
      <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{item.name_ar ?? item.name} — النظام يسجّل <span className="ltr-nums font-bold text-white">{num(item.current_stock)}</span> {item.unit}</p>
      <Field label="الكمية الفعلية بعد الجرد *"><input className="field ltr-nums" type="number" min={0} step="0.001" dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      <Field label="السبب"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="تالف، فرق جرد…" /></Field>
      <ErrLine err={err} />
      <button className="btn-primary w-full justify-center" disabled={pending} onClick={() => onSubmit({ new_qty: Number(qty), reason })}>
        {pending ? "…" : "حفظ الكمية"}
      </button>
    </div>
  );
}
