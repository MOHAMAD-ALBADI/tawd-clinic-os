"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, User, FileText, CheckCircle2 } from "lucide-react";
import { createInvoice } from "@/app/actions/invoices";
import { OMAN_VAT_RATE, fmt3, type InvoiceStatus } from "@/lib/invoice-meta";
import { NumField } from "@/components/ui/num-field";

type PatientOpt = { id: string; name: string; phone?: string | null };
type ServiceOpt = { id: string; name: string; price: number };

/* Quantities and prices are strings while being typed: an Arabic keyboard
   produces ٠١٢٣ and a half-typed "1." is not yet a number. They are parsed once,
   at the edge, when totals are computed and when the invoice is submitted. */
type Line = { description: string; service_id: string; quantity: string; unit_price: string; vat: boolean };

const num = (s: string) => Number(s) || 0;
const emptyLine = (): Line => ({ description: "", service_id: "", quantity: "1", unit_price: "", vat: false });

function InvoiceModal({ patients, services, onClose }: { patients: PatientOpt[]; services: ServiceOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("sent");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + num(l.quantity) * num(l.unit_price), 0);
    const vat = lines.reduce((s, l) => s + (l.vat ? num(l.quantity) * num(l.unit_price) * OMAN_VAT_RATE : 0), 0);
    const disc = Math.min(num(discount), subtotal);
    return { subtotal, vat, disc, total: subtotal + vat - disc };
  }, [lines, discount]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function onPickService(i: number, serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    setLines((prev) => prev.map((l, idx) => idx !== i ? l : {
      ...l,
      service_id: serviceId,
      description: svc?.name ?? l.description,
      unit_price: svc ? String(svc.price) : l.unit_price,
    }));
  }
  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (i: number) => setLines((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));

  function handleSubmit() {
    if (!patientId) { setError("اختر المريض"); return; }
    const valid = lines.filter((l) => l.description.trim() && num(l.unit_price) > 0);
    if (!valid.length) { setError("أضف بنداً واحداً على الأقل بسعر صحيح"); return; }
    if (num(discount) > totals.subtotal) { setError("الخصم أكبر من قيمة البنود"); return; }
    setError(null);
    startTransition(async () => {
      try {
        await createInvoice({
          patient_id: patientId,
          status,
          due_date: dueDate || null,
          discount_amount: num(discount),
          notes,
          items: valid.map((l) => ({
            description: l.description.trim(),
            service_id: l.service_id || null,
            quantity: Math.max(1, num(l.quantity) || 1),
            unit_price: num(l.unit_price),
            vat_rate: l.vat ? OMAN_VAT_RATE : 0,
          })),
        });
        setDone(true);
        router.refresh();
        setTimeout(onClose, 1100);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ في إنشاء الفاتورة");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(2,8,18,0.82)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl panel animate-scale-in" style={{ background: "rgba(8,14,24,0.98)", padding: "1.5rem", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="eyebrow mb-1">NEW INVOICE</p>
            <h2 className="text-white font-bold text-lg">إنشاء فاتورة جديدة</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(52,211,153,0.14)" }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: "var(--color-ok)" }} />
            </div>
            <p className="text-white font-bold">تم إنشاء الفاتورة بنجاح</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Patient + meta */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: "var(--text-2)" }}>
                  <User className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} /> المريض *
                </label>
                <select className="field" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="">اختر المريض</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` — ${p.phone}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-2)" }}>الحالة</label>
                {/* No "paid" here — an invoice becomes paid by recording a payment */}
                <select className="field" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)} style={{ cursor: "pointer" }}>
                  <option value="draft">مسودة</option>
                  <option value="sent">مُرسلة</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-2)" }}>تاريخ الاستحقاق</label>
                <input className="field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="eyebrow">البنود</p>
                <p className="text-[10.5px]" style={{ color: "var(--text-4)" }}>
                  ض.ق.م ٥٪ — أكثر الخدمات الطبية معفاة، فعّلها للبند الخاضع فقط
                </p>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <select className="field col-span-3" value={l.service_id} onChange={(e) => onPickService(i, e.target.value)} style={{ cursor: "pointer" }}>
                      <option value="">خدمة...</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input className="field col-span-3" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="الوصف" />
                    <NumField className="field ltr-nums col-span-2" allowDecimal={false} value={l.quantity}
                      onChange={(v) => setLine(i, { quantity: v })} placeholder="الكمية" />
                    <NumField className="field ltr-nums col-span-2" value={l.unit_price}
                      onChange={(v) => setLine(i, { unit_price: v })} placeholder="السعر" />
                    <button type="button" onClick={() => setLine(i, { vat: !l.vat })}
                      className="col-span-1 h-9 rounded-lg text-[11px] font-bold transition-colors"
                      title={l.vat ? "خاضع لـ ٥٪ ضريبة" : "معفى من الضريبة"}
                      style={{
                        background: l.vat ? "rgba(45,212,191,0.14)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${l.vat ? "rgba(45,212,191,0.4)" : "var(--hairline)"}`,
                        color: l.vat ? "var(--accent-1)" : "var(--text-4)",
                      }}>
                      ٪٥
                    </button>
                    <button onClick={() => removeLine(i)} className="col-span-1 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }} title="حذف البند">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addLine} className="btn-ghost mt-2"><Plus className="w-3.5 h-3.5" /> إضافة بند</button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-2)" }}>خصم (ر.ع)</label>
                <NumField value={discount} onChange={setDiscount} placeholder="0.000" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-2)" }}>ملاحظات</label>
                <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تظهر أسفل الفاتورة المطبوعة" />
              </div>
            </div>

            {/* Totals — the full breakdown, not just the line sum */}
            <div className="rounded-2xl p-4 space-y-1.5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
              {[
                { label: "المجموع قبل الضريبة", value: totals.subtotal },
                ...(totals.disc > 0 ? [{ label: "الخصم", value: -totals.disc }] : []),
                ...(totals.vat > 0 ? [{ label: "ضريبة القيمة المضافة ٥٪", value: totals.vat }] : []),
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-[12.5px]">
                  <span style={{ color: "var(--text-3)" }}>{r.label}</span>
                  <span className="ltr-nums" style={{ color: r.value < 0 ? "#fbbf24" : "var(--text-2)" }}>{fmt3(r.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--hairline)" }}>
                <span className="text-sm font-bold text-white">الإجمالي المستحق</span>
                <span className="text-xl font-black ltr-nums text-gradient-brand">{fmt3(totals.total)} <span className="text-sm">ر.ع</span></span>
              </div>
            </div>

            {error && (
              <div className="text-sm py-2.5 px-3.5 rounded-xl" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="btn-ghost flex-1 h-11">إلغاء</button>
              <button onClick={handleSubmit} disabled={pending} className="btn-primary flex-1 h-11">
                {pending ? "جارٍ الإنشاء..." : "إنشاء الفاتورة"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AddInvoiceTrigger({ patients, services }: { patients: PatientOpt[]; services: ServiceOpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <FileText className="w-4 h-4" />
        إنشاء فاتورة
      </button>
      {open && <InvoiceModal patients={patients} services={services} onClose={() => setOpen(false)} />}
    </>
  );
}
