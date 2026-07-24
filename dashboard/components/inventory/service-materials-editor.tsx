"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, CheckCircle2, AlertTriangle, Workflow } from "lucide-react";
import { setServiceMaterials } from "@/app/actions/inventory";
import type { InvItem } from "@/components/inventory/inventory-board";

export type SvcOption = { id: string; label: string };
export type BomRow = { service_id: string; item_id: string; qty_per_use: number };

/** Define, per service, which stock items it consumes — powers the auto-deduct at billing. */
export function ServiceMaterialsEditor({
  services, items, materials,
}: { services: SvcOption[]; items: InvItem[]; materials: BomRow[] }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [rows, setRows] = useState<{ item_id: string; qty_per_use: string }[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // hydrate rows from saved BOM whenever the selected service changes
  const savedForService = useMemo(
    () => materials.filter((m) => m.service_id === serviceId),
    [materials, serviceId]
  );
  if (serviceId && loadedFor !== serviceId) {
    setLoadedFor(serviceId);
    setRows(savedForService.map((m) => ({ item_id: m.item_id, qty_per_use: String(m.qty_per_use) })));
    setMsg(null);
  }

  const setRow = (i: number, patch: Partial<{ item_id: string; qty_per_use: string }>) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function save() {
    setMsg(null);
    start(async () => {
      try {
        const r = await setServiceMaterials(
          serviceId,
          rows.map((x) => ({ item_id: x.item_id, qty_per_use: Number(x.qty_per_use) }))
        );
        if (!r.ok) { setMsg({ ok: false, text: r.reason ?? "تعذّر الحفظ" }); return; }
        setMsg({ ok: true, text: `حُفظت ${r.count} مادة لهذه الخدمة` });
        router.refresh();
      } catch { setMsg({ ok: false, text: "تعذّر الاتصال" }); }
    });
  }

  if (services.length === 0 || items.length === 0) return null;

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="section-title mb-1">
        <Workflow className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>مواد الخدمات — الخصم التلقائي</h2>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        حدّد ما تستهلكه كل خدمة من المخزون — يُخصم تلقائياً عند فوترة الخدمة
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الخدمة</span>
          <select className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select className="field flex-1" value={r.item_id} onChange={(e) => setRow(i, { item_id: e.target.value })}>
              <option value="">— اختر مادة —</option>
              {items.map((it) => <option key={it.id} value={it.id}>{(it.name_ar ?? it.name) + " (" + it.unit + ")"}</option>)}
            </select>
            <input className="field ltr-nums w-28" type="number" min={0} step="0.001" dir="ltr"
              value={r.qty_per_use} onChange={(e) => setRow(i, { qty_per_use: e.target.value })} placeholder="الكمية" />
            <button title="حذف" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-[12px] text-center py-3" style={{ color: "var(--text-4)" }}>لا مواد لهذه الخدمة — أضف صفاً</p>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button className="btn-ghost" onClick={() => setRows((p) => [...p, { item_id: "", qty_per_use: "1" }])}>
          <Plus className="w-3.5 h-3.5" /> إضافة مادة
        </button>
        <button className="btn-primary" disabled={pending || !serviceId} onClick={save}>
          <Save className="w-3.5 h-3.5" /> {pending ? "…" : "حفظ مواد الخدمة"}
        </button>
        {msg && (
          <span className="text-[12px] flex items-center gap-1.5" style={{ color: msg.ok ? "#5dd9cb" : "#fda4b4" }}>
            {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
