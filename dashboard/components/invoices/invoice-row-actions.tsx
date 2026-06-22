"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Check, Trash2, FileText } from "lucide-react";
import { updateInvoiceStatus, deleteInvoice, type InvoiceStatus } from "@/app/actions/invoices";

const STATUS_OPTS: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "مسودة" },
  { value: "sent", label: "مُرسلة" },
  { value: "paid", label: "مدفوعة" },
  { value: "partially_paid", label: "مدفوعة جزئياً" },
  { value: "overdue", label: "متأخرة" },
  { value: "refunded", label: "مستردة" },
];

type Pos = { right: number; top?: number; bottom?: number };

export function InvoiceRowActions({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [pending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const openUp = window.innerHeight - r.bottom < 320;
      setPos({
        right: Math.round(window.innerWidth - r.right),
        top: openUp ? undefined : Math.round(r.bottom + 6),
        bottom: openUp ? Math.round(window.innerHeight - r.top + 6) : undefined,
      });
    }
    setOpen(true);
  }

  function change(s: InvoiceStatus) {
    startTransition(async () => { try { await updateInvoiceStatus(id, s); } finally { setOpen(false); } });
  }
  function remove() {
    if (!confirm("سيتم إلغاء الفاتورة ونقلها للأرشيف (لا حذف نهائي). متابعة؟")) return;
    startTransition(async () => { try { await deleteInvoice(id); } finally { setOpen(false); } });
  }

  return (
    <>
      <button ref={btnRef} onClick={toggle} disabled={pending}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }} title="إجراءات">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div
            className="panel py-1.5 animate-scale-in"
            style={{ position: "fixed", right: pos.right, top: pos.top, bottom: pos.bottom, width: 208, maxHeight: "70vh", overflowY: "auto", zIndex: 60, background: "rgba(12,18,28,0.99)" }}
          >
            <Link href={`/clinic-admin/invoices/${id}`}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "var(--text-1)" }}>
              <FileText className="w-3.5 h-3.5" style={{ color: "var(--color-info)" }} /> عرض / طباعة PDF
            </Link>
            <div className="my-1" style={{ borderTop: "1px solid var(--hairline)" }} />
            <p className="eyebrow px-3 py-1.5">تغيير الحالة</p>
            {STATUS_OPTS.filter((o) => o.value !== status).map((o) => (
              <button key={o.value} onClick={() => change(o.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "var(--text-1)" }}>
                <Check className="w-3.5 h-3.5" style={{ color: "var(--color-brand-400)" }} /> {o.label}
              </button>
            ))}
            <div className="my-1" style={{ borderTop: "1px solid var(--hairline)" }} />
            <button onClick={remove} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right transition-colors hover:bg-white/[0.04]" style={{ color: "#fda4b4" }}>
              <Trash2 className="w-3.5 h-3.5" /> إلغاء الفاتورة
            </button>
          </div>
        </>
      )}
    </>
  );
}
