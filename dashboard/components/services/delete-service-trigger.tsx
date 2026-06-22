"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { deleteService } from "@/app/actions/services";

export function DeleteServiceTrigger({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteService(id);
        router.refresh();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  const modal = open ? (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(2,8,20,0.85)", backdropFilter: "blur(8px)", zIndex: 9999 }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "rgba(6,14,30,0.97)", border: "1px solid rgba(239,68,68,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertTriangle className="w-5 h-5" style={{ color: "#F87171" }} />
            </div>
            <div>
              <h2 className="text-white font-bold">حذف الخدمة</h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>هذا الإجراء لا يمكن التراجع عنه</p>
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); setError(null); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: "rgba(148,163,184,0.4)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
          <p className="text-sm text-white">
            هل تريد حذف خدمة <span className="font-bold" style={{ color: "#F87171" }}>"{name}"</span> نهائياً؟
          </p>
          <p className="text-xs mt-1" style={{ color: "rgba(148,163,184,0.5)" }}>
            إذا كانت مرتبطة بمواعيد سيُعرض عليك تعطيلها بدلاً من الحذف.
          </p>
        </div>

        {error && (
          <div
            className="text-sm py-2.5 px-3.5 rounded-xl mb-4"
            style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "#2dd4bf" }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => { setOpen(false); setError(null); }}
            className="flex-1 h-11 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.8)" }}
          >
            إلغاء
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="flex-1 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}
          >
            {pending ? "جارٍ الحذف..." : "نعم، احذف"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#F87171" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
      >
        <Trash2 className="w-3 h-3" />
        حذف
      </button>

      {typeof window !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
