import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { AppErrorsPanel, type AppErrorRow } from "@/components/platform/app-errors-panel";
import { SuraErrorsPanel, type SuraErrorRow } from "@/components/platform/sura-errors-panel";
import { n8nGet, n8nErrorMessage } from "@/lib/n8n";
import { WorkflowBoard, type WorkflowRow } from "@/components/platform/workflow-board";
import { Workflow, AlertTriangle } from "lucide-react";

export const metadata = { title: "الأتمتة — طود" };
export const dynamic = "force-dynamic";

async function getWorkflows() {
  const [wf, ex] = await Promise.all([
    n8nGet<{ data: { id: string; active: boolean; name: string }[] }>("workflows?limit=100"),
    n8nGet<{ data: { status: string; startedAt: string; workflowId: string }[] }>("executions?limit=100"),
  ]);
  if (!wf.ok) return { error: n8nErrorMessage(wf.reason) };
  if (!ex.ok) return { error: n8nErrorMessage(ex.reason) };

  const wfs = wf.data.data ?? [];
  const exs = ex.data.data ?? [];
  const dayAgo = Date.now() - 86_400_000;
  const errBy: Record<string, number> = {};
  const runBy: Record<string, number> = {};
  for (const e of exs) {
    if (new Date(e.startedAt).getTime() < dayAgo) continue;
    runBy[e.workflowId] = (runBy[e.workflowId] ?? 0) + 1;
    if (e.status === "error") errBy[e.workflowId] = (errBy[e.workflowId] ?? 0) + 1;
  }
  return {
    rows: wfs
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
      .map((w) => ({ ...w, runs: runBy[w.id] ?? 0, errors: errBy[w.id] ?? 0 })),
  };
}

export default async function AutomationPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [wfs, { data: errs }, { data: appErrs }] = await Promise.all([
    getWorkflows(),
    /* Open only. The panel used to list the newest ten whatever their status, so a
       fault fixed weeks ago kept occupying the screen and the count that drives the
       health signal never fell. */
    sb.from("sura_errors").select("id, workflow_name, node_name, error_message, created_at")
      .eq("status", "open").order("created_at", { ascending: false }).limit(10),
    sb.from("tawd_error_logs").select("id, error_message, severity, context, created_at")
      .eq("workflow_id", "dashboard-app").eq("resolved", false)
      .order("created_at", { ascending: false }).limit(15),
  ]);

  const ago = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 1 ? "الآن" : h < 24 ? `منذ ${h} س` : `منذ ${Math.floor(h / 24)} يوم`;
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">AUTOMATION</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">الأتمتة — محرك سُرى</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          كل ووركفلو وتشغيلاته وأخطاؤه آخر ٢٤ ساعة — وتشغيله وإيقافه من هنا مباشرة
        </p>
      </div>

      {"error" in wfs ? (
        <div className="panel flex items-start gap-3" style={{ padding: "1.1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{wfs.error}</p>
        </div>
      ) : (
        <WorkflowBoard
          workflows={wfs.rows.map((w): WorkflowRow => ({
            id: w.id,
            name: w.name.replace("TAWD - ", "").replace("TAWD — ", ""),
            active: w.active,
            runs: w.runs,
            errors: w.errors,
          }))}
        />
      )}

      <div className="panel" style={{ padding: "1.25rem" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
          <Workflow className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          آخر الأخطاء المسجّلة
        </h3>
        <SuraErrorsPanel errors={(errs ?? []).map((e) => ({
          id: e.id as string,
          workflowName: e.workflow_name as string,
          nodeName: e.node_name as string,
          message: (e.error_message as string) ?? "",
          at: e.created_at as string,
        })) as SuraErrorRow[]} />
      </div>

      <AppErrorsPanel errors={(appErrs ?? []) as unknown as AppErrorRow[]} />
    </div>
  );
}
