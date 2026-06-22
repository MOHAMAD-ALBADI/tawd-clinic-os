"use client";

import { useState, useTransition } from "react";
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

export function InvoiceRowActions({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function change(s: InvoiceStatus) {
    startTransition(async () => { try { await updateInvoiceStatus(id, s); } finally { setOpen(false); } });
  }
  function remove() {
    if (!confirm("سيتم إلغاء الفاتورة ونقلها للأرشيف (لا حذف نهائي). متابعة؟")) return;
    startTransition(async () => { try { await deleteInvoice(id); } finally { setOpen(false); } });
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={pending}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: "var(--text-3)" }} title="إجراءات">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-1 z-50 w-48 panel py-1.5 animate-scale-in" style={{ background: "rgba(10,16,26,0.99)" }}>
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
    </div>
  );
}
