"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pill, PackageCheck, AlertTriangle, CheckCircle2, Link2, ChevronDown } from "lucide-react";
import { dispensePrescription, linkPrescriptionItem } from "@/app/actions/pharmacy";
import { NumField } from "@/components/ui/num-field";
import type { InvItem } from "@/components/inventory/inventory-board";

export type RxLine = {
  id: string; drug_name: string; dosage: string; frequency: string; duration: string;
  item_id: string | null; item_name: string; quantity: number; dispensed_qty: number;
  in_stock: number | null;
};
export type Rx = {
  id: string; patient_name: string; doctor_name: string; status: string;
  created_at: string; lines: RxLine[];
};

const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

export function PharmacyCounter({ prescriptions, items }: { prescriptions: Rx[]; items: InvItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(prescriptions[0]?.id ?? null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3500); }

  function dispense(rx: Rx) {
    setErr(null);
    start(async () => {
      try {
        const r = await dispensePrescription(rx.id);
        if (!r.ok) { setErr(r.reason); return; }
        ok(r.itemsDeducted > 0
          ? `صُرفت الوصفة وخُصمت ${r.itemsDeducted} أصناف من المخزون`
          : "صُرفت الوصفة — لا أصناف مرتبطة بالمخزون");
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  function link(line: RxLine, itemId: string, qty: number) {
    setErr(null);
    start(async () => {
      try {
        const r = await linkPrescriptionItem({ item_row_id: line.id, inventory_item_id: itemId || null, quantity: qty });
        if (!r.ok) { setErr(r.reason); return; }
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="section-title">
          <Pill className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>الصيدلية — وصفات بانتظار الصرف</h2>
        </div>
        <span className="badge badge-brand ltr-nums">{prescriptions.length}</span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        اربط كل دواء بصنف في المخزون وحدّد الكمية — عند الصرف تُخصم الكميات دفعة واحدة، الأقرب انتهاءً أولاً
      </p>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
        </div>
      )}

      {prescriptions.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--text-4)" }}>
          لا وصفات بانتظار الصرف — تظهر هنا فور أن يوقّعها الطبيب
        </p>
      ) : (
        <div className="space-y-2">
          {prescriptions.map((rx) => {
            const open = expanded === rx.id;
            /* A line the pharmacist cannot fulfil from the shelf: linked, but the
               shelf is short. Shown before they try, not as an error after. */
            const short = rx.lines.filter(
              (l) => l.item_id && l.in_stock !== null && l.in_stock < l.quantity - l.dispensed_qty
            );
            const unlinked = rx.lines.filter((l) => !l.item_id).length;

            return (
              <div key={rx.id} className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                <button onClick={() => setExpanded(open ? null : rx.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-[13.5px] truncate">{rx.patient_name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>
                      {rx.doctor_name} · <span className="ltr-nums">{new Date(rx.created_at).toLocaleDateString("en-GB")}</span>
                      {" · "}<span className="ltr-nums">{rx.lines.length}</span> دواء
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {short.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(248,113,113,0.12)", color: "#fda4b4", border: "1px solid rgba(248,113,113,0.3)" }}>
                        نقص مخزون
                      </span>
                    )}
                    {unlinked > 0 && short.length === 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                        <span className="ltr-nums">{unlinked}</span> غير مربوط
                      </span>
                    )}
                    <ChevronDown className="w-4 h-4 transition-transform"
                      style={{ color: "var(--text-4)", transform: open ? "rotate(180deg)" : undefined }} />
                  </div>
                </button>

                {open && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: "1px solid var(--hairline-2)" }}>
                    {rx.lines.map((l) => (
                      <LineRow key={l.id} line={l} items={items} pending={pending} onLink={link} />
                    ))}

                    <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                        {short.length > 0
                          ? "لا يمكن الصرف: أعد الطلب أو عدّل الكمية"
                          : "الأدوية غير المربوطة تُسلَّم ورقياً دون خصم"}
                      </p>
                      <button className="btn-primary" disabled={pending || short.length > 0}
                        onClick={() => dispense(rx)}>
                        <PackageCheck className="w-4 h-4" /> صرف الوصفة
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LineRow({
  line, items, pending, onLink,
}: { line: RxLine; items: InvItem[]; pending: boolean; onLink: (l: RxLine, itemId: string, qty: number) => void }) {
  const [itemId, setItemId] = useState(line.item_id ?? "");
  const [qty, setQty] = useState(String(line.quantity));

  const dirty = itemId !== (line.item_id ?? "") || Number(qty) !== line.quantity;
  const short = line.item_id && line.in_stock !== null && line.in_stock < line.quantity - line.dispensed_qty;

  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline-2)" }}>
      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <span className="font-bold text-white text-[13px]">{line.drug_name}</span>
        <span className="text-[11px]" style={{ color: "var(--text-4)" }}>
          {[line.dosage, line.frequency, line.duration].filter(Boolean).join(" · ") || "—"}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-2 items-center">
        <select className="field col-span-6" value={itemId} onChange={(e) => setItemId(e.target.value)}
          style={{ cursor: "pointer" }} disabled={pending}>
          <option value="">غير مربوط بالمخزون</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name_ar || i.name} ({fmt(i.current_stock)})
            </option>
          ))}
        </select>
        <NumField className="field ltr-nums col-span-3" allowDecimal={false} value={qty}
          onChange={setQty} placeholder="الكمية" disabled={pending} />
        <button className="btn-ghost col-span-3 h-9" disabled={pending || !dirty || !(Number(qty) > 0)}
          onClick={() => onLink(line, itemId, Number(qty))}>
          <Link2 className="w-3.5 h-3.5" /> حفظ
        </button>
      </div>

      {short && (
        <p className="text-[11px] mt-1.5" style={{ color: "#fda4b4" }}>
          المتوفر <span className="ltr-nums">{fmt(line.in_stock ?? 0)}</span> والمطلوب{" "}
          <span className="ltr-nums">{fmt(line.quantity - line.dispensed_qty)}</span>
        </p>
      )}
    </div>
  );
}
