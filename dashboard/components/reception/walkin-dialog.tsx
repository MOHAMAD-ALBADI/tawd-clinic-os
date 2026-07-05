"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, CheckCircle2, AlertCircle } from "lucide-react";
import { walkIn } from "@/app/actions/reception";

type Opt = { id: string; label: string };

/** Walk-in: patient with no booking → straight into the waiting room. */
export function WalkinDialog({ services, doctors }: { services: Opt[]; doctors: Opt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; position: number } | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    serviceId: services[0]?.id ?? "",
    doctorId: doctors[0]?.id ?? "",
  });

  function submit() {
    if (!form.name.trim()) { setErr("اسم المريض مطلوب"); return; }
    if (!form.serviceId || !form.doctorId) { setErr("اختر الخدمة والطبيب"); return; }
    setErr(null);
    start(async () => {
      try {
        const r = await walkIn(form);
        if (!r.ok) { setErr(r.reason); return; }
        setDone({ name: form.name, position: r.position });
        setForm((p) => ({ ...p, name: "", phone: "" }));
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  function closeAll() {
    setOpen(false); setDone(null); setErr(null);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost">
        <UserPlus className="w-4 h-4" />
        مريض بدون موعد
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={closeAll}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5"
            style={{ background: "#131315", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--accent-1)" }} />
                <p className="text-lg font-bold text-white mb-1">تم تسجيل {done.name}</p>
                <p className="text-sm" style={{ color: "var(--text-2)" }}>
                  دوره في غرفة الانتظار: <span className="font-bold ltr-nums text-white text-lg">{done.position}</span>
                </p>
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button onClick={() => setDone(null)} className="btn-primary">
                    <UserPlus className="w-4 h-4" /> مريض آخر
                  </button>
                  <button onClick={closeAll} className="btn-ghost">إغلاق</button>
                </div>
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <UserPlus className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
                مريض بدون موعد (Walk-in)
              </h3>
              <button onClick={closeAll} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--text-3)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>اسم المريض *</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="field" placeholder="الاسم الكامل" />
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الجوال (لو موجود بالنظام يُربط تلقائياً)</label>
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="field ltr-nums" dir="ltr" placeholder="+9689xxxxxxx" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الخدمة</label>
                  <select value={form.serviceId} onChange={(e) => setForm((p) => ({ ...p, serviceId: e.target.value }))} className="field">
                    {services.map((s) => <option key={s.id} value={s.id} style={{ background: "#131315" }}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الطبيب</label>
                  <select value={form.doctorId} onChange={(e) => setForm((p) => ({ ...p, doctorId: e.target.value }))} className="field">
                    {doctors.map((d) => <option key={d.id} value={d.id} style={{ background: "#131315" }}>{d.label}</option>)}
                  </select>
                </div>
              </div>
              {err && (
                <p className="text-[12px] font-semibold flex items-center gap-1.5 rounded-lg px-3 py-2"
                  style={{ background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
                </p>
              )}
              <button onClick={submit} disabled={pending} className="btn-primary w-full">
                {pending ? "جارٍ التسجيل…" : "تسجيل ودخول غرفة الانتظار"}
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
