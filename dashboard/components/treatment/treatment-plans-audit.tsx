import { ClipboardList, Eye } from "lucide-react";
import type { PlanRow } from "@/components/treatment/treatment-plans-manager";

/* The MANAGER's view of treatment plans: read-only.

   Authoring care is a clinical act that belongs to the treating doctor, so the
   manager oversees rather than edits — they see every plan in the clinic, its
   value and its progress, with no create/edit/delete affordances. The server
   enforces the same rule (app/actions/treatment-plans.ts requires the doctor
   role), so this is presentation matching policy, not the policy itself. */

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودّة", color: "#a1a1aa" },
  proposed: { label: "معروضة", color: "#fbbf24" },
  accepted: { label: "مقبولة", color: "#5dd9cb" },
  in_progress: { label: "جارية", color: "#2dd4bf" },
  completed: { label: "مكتملة", color: "#5dd9cb" },
  cancelled: { label: "ملغاة", color: "#71717a" },
};
const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export function TreatmentPlansAudit({ plans }: { plans: PlanRow[] }) {
  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="section-title">
          <ClipboardList className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>خطط العلاج في العيادة</h2>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", color: "var(--text-3)" }}>
          <Eye className="w-3 h-3" /> عرض فقط
        </span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        الأطباء هم من ينشئون خطط مرضاهم ويعدّلونها — هذه شاشة متابعة للإدارة
      </p>

      {plans.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--text-4)" }}>
          لا خطط علاج بعد — تظهر هنا فور أن ينشئها الأطباء
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["المريض", "الخطة", "الطبيب", "التقدّم", "القيمة", "الحالة"].map((h) => (
                  <th key={h} className="text-start px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const st = STATUS[p.status] ?? STATUS.draft;
                const done = p.items.filter((i) => i.status === "done").length;
                const pct = p.items.length ? Math.round((done / p.items.length) * 100) : 0;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td className="px-3 py-3 font-bold text-white">{p.patient_name}</td>
                    <td className="px-3 py-3" style={{ color: "var(--text-3)" }}>{p.title}</td>
                    <td className="px-3 py-3" style={{ color: "var(--text-3)" }}>{p.doctor_name || "—"}</td>
                    <td className="px-3 py-3" style={{ minWidth: 120 }}>
                      {p.items.length === 0 ? (
                        <span className="text-[11px]" style={{ color: "var(--text-4)" }}>لا بنود</span>
                      ) : (
                        <>
                          <div className="flex justify-between text-[10.5px] mb-1">
                            <span style={{ color: "var(--text-4)" }} className="ltr-nums">{done}/{p.items.length}</span>
                            <span className="ltr-nums" style={{ color: "var(--text-3)" }}>{pct}%</span>
                          </div>
                          <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.05)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent-1)", opacity: 0.75 }} />
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 font-bold ltr-nums text-white">{fmt(p.total_estimate)}</td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}44` }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
