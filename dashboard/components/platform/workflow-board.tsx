"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, Workflow, AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { setWorkflowActive } from "@/app/actions/automation";

export type WorkflowRow = {
  id: string; name: string; active: boolean;
  runs: number; errors: number;
};

/* Sura's WhatsApp pipeline. Switching this off stops the receptionist replying
   for every clinic at once, so it gets a confirmation the others do not. */
const CRITICAL = /WF-05|sura/i;

export function WorkflowBoard({ workflows }: { workflows: WorkflowRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<WorkflowRow | null>(null);

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 3500); }

  function toggle(w: WorkflowRow) {
    setErr(null);
    start(async () => {
      try {
        const r = await setWorkflowActive(w.id, !w.active);
        if (!r.ok) { setErr(r.reason); return; }
        setConfirm(null);
        ok(`${w.active ? "أُوقف" : "شُغّل"} ${w.name}`);
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const active = workflows.filter((w) => w.active).length;
  const failing = workflows.filter((w) => w.errors > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="pill">
          <span className="pill-dot" style={{ background: "#34d399" }} />
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>شغّالة</span>
          <span className="text-[13px] font-black ltr-nums" style={{ color: "#34d399" }}>{active}</span>
        </div>
        <div className="pill">
          <span className="pill-dot" style={{ background: "var(--text-4)" }} />
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>موقوفة</span>
          <span className="text-[13px] font-black ltr-nums text-white">{workflows.length - active}</span>
        </div>
        {failing.length > 0 && (
          <div className="pill" style={{ borderColor: "rgba(248,113,113,0.35)" }}>
            <span className="pill-dot" style={{ background: "#fda4b4" }} />
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>فيها أخطاء اليوم</span>
            <span className="text-[13px] font-black ltr-nums" style={{ color: "#fda4b4" }}>{failing.length}</span>
          </div>
        )}
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["الووركفلو", "تشغيلات ٢٤ ساعة", "أخطاء", "الحالة", ""].map((h) => (
                  <th key={h} className="text-start px-3 py-3 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => {
                const critical = CRITICAL.test(w.name);
                return (
                  <tr key={w.id} style={{ borderTop: "1px solid var(--hairline-2)", opacity: w.active ? 1 : 0.6 }}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Workflow className="w-3.5 h-3.5 shrink-0"
                          style={{ color: w.active ? "var(--accent-1)" : "var(--text-4)" }} />
                        <span className="font-bold text-white">{w.name}</span>
                        {critical && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                            حرِج
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 ltr-nums" style={{ color: w.runs > 0 ? "#ffffff" : "var(--text-4)" }}>
                      {w.runs}
                    </td>
                    <td className="px-3 py-3 ltr-nums font-bold"
                      style={{ color: w.errors > 0 ? "#fda4b4" : "var(--text-4)" }}>
                      {w.errors}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={w.active
                          ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.35)" }
                          : { background: "rgba(255,255,255,0.05)", color: "var(--text-3)", border: "1px solid var(--hairline)" }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: w.active ? "#34d399" : "var(--text-4)" }} />
                        {w.active ? "شغّال" : "موقوف"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <button className="btn-ghost" disabled={pending}
                          title={w.active ? "إيقاف" : "تشغيل"}
                          onClick={() => (w.active && critical ? setConfirm(w) : toggle(w))}>
                          <Power className="w-3.5 h-3.5" style={{ color: w.active ? "#fbbf24" : "#34d399" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full glass" style={{ maxWidth: 460, borderRadius: "1.25rem", padding: "1.5rem" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-black text-white">إيقاف ووركفلو حرِج</h3>
              <button className="btn-ghost" onClick={() => setConfirm(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-start gap-3 mb-4">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#fda4b4" }} />
              <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
                <span className="font-bold text-white">{confirm.name}</span> يشغّل ردود سُرى على واتساب.
                إيقافه يعني أن مرضى <span className="font-bold text-white">كل العيادات</span> لن يتلقّوا رداً —
                والرسائل الواردة تُفقد ولا تُطابر لاحقاً.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirm(null)}>إلغاء</button>
              <button className="btn-danger" disabled={pending} onClick={() => toggle(confirm)}>تأكيد الإيقاف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
