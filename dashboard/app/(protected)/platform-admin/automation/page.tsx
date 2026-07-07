import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { Workflow } from "lucide-react";

export const metadata = { title: "الأتمتة — طود" };
export const dynamic = "force-dynamic";

async function getWorkflows() {
  const key = process.env.N8N_API_KEY;
  const base = process.env.N8N_BASE_URL ?? "https://n8n.srv1239666.hstgr.cloud/api/v1";
  if (!key) return null;
  try {
    const H = { "X-N8N-API-KEY": key };
    const [wfRes, exRes] = await Promise.all([
      fetch(`${base}/workflows?limit=100`, { headers: H, signal: AbortSignal.timeout(5000), cache: "no-store" }),
      fetch(`${base}/executions?limit=100`, { headers: H, signal: AbortSignal.timeout(5000), cache: "no-store" }),
    ]);
    const wfs = (await wfRes.json()).data as { id: string; active: boolean; name: string }[];
    const exs = (await exRes.json()).data as { status: string; startedAt: string; workflowId: string }[];
    const dayAgo = Date.now() - 86_400_000;
    const errBy: Record<string, number> = {};
    const runBy: Record<string, number> = {};
    for (const e of exs) {
      if (new Date(e.startedAt).getTime() < dayAgo) continue;
      runBy[e.workflowId] = (runBy[e.workflowId] ?? 0) + 1;
      if (e.status === "error") errBy[e.workflowId] = (errBy[e.workflowId] ?? 0) + 1;
    }
    return wfs
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
      .map((w) => ({ ...w, runs: runBy[w.id] ?? 0, errors: errBy[w.id] ?? 0 }));
  } catch {
    return null;
  }
}

export default async function AutomationPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [wfs, { data: errs }] = await Promise.all([
    getWorkflows(),
    sb.from("sura_errors").select("workflow_name, node_name, error_message, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const ago = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 1 ? "الآن" : h < 24 ? `منذ ${h} س` : `منذ ${Math.floor(h / 24)} يوم`;
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <h2 className="text-xl font-bold text-white">الأتمتة — محرك سُرى</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
          حالة كل ووركفلو حياً + تشغيلاته وأخطاؤه آخر 24 ساعة
        </p>
      </div>

      <div className="panel" style={{ padding: "1.25rem" }}>
        {!wfs ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--text-4)" }}>
            تعذّر الاتصال بـ n8n من الخادم — تأكد من N8N_API_KEY على Vercel
          </p>
        ) : (
          <div className="space-y-1">
            {wfs.map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg flex-wrap"
                style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.045)" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: w.active ? "#2dd4bf" : "rgba(255,255,255,0.15)" }} />
                <span className="text-[12px] flex-1 truncate" style={{ color: w.active ? "var(--text-1)" : "var(--text-4)" }}>
                  {w.name.replace("TAWD - ", "").replace("TAWD — ", "")}
                </span>
                <span className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>{w.runs} تشغيلة</span>
                <span className="text-[11px] font-bold ltr-nums w-14 text-end"
                  style={{ color: w.errors > 0 ? "#fda4b4" : "var(--text-4)" }}>
                  {w.errors > 0 ? `${w.errors} خطأ` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: "1.25rem" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
          <Workflow className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          آخر الأخطاء المسجّلة
        </h3>
        {(errs ?? []).length === 0 ? (
          <p className="text-[12px]" style={{ color: "#5dd9cb" }}>لا أخطاء ✓</p>
        ) : (
          <div className="space-y-1.5">
            {(errs ?? []).map((e, i) => (
              <div key={i} className="px-3 py-2 rounded-lg" style={{ background: "rgba(244,63,94,0.04)", border: "1px solid rgba(244,63,94,0.12)" }}>
                <p className="text-[12px] font-semibold text-white">{e.workflow_name} <span style={{ color: "var(--text-4)" }}>· {e.node_name} · {ago(e.created_at)}</span></p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{e.error_message?.slice(0, 120)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
