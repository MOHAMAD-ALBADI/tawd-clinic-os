import { redirect } from "next/navigation";
import { Bot, CalendarX2, ClipboardList, AlertTriangle } from "lucide-react";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/auth/role-redirect";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { WhyCard } from "@/components/sura/why-card";
import { RunTick } from "@/components/sura/run-tick";
import { SuraConsole, ReportLink } from "@/components/sura/console";

export const metadata = { title: "سُرى الوكيل — طود" };
export const dynamic = "force-dynamic";

/* What Sura did when nobody asked.
 *
 * The page a clinic owner opens to answer one question: is this thing
 * earning its keep. So it leads with riyals, not activity — an agent that
 * reports "47 actions taken" is reporting effort, and nobody buys effort.
 *
 * Every action carries its reasoning. That is not a debugging affordance
 * bolted on; in healthcare it is the feature. An owner who can read why a
 * message went to Fatima and not to Salim will let the software keep
 * doing it. One who cannot will switch it off within a week.
 */

type GoalRow = {
  id: string;
  kind: string;
  state: string;
  value_omr: number;
  context: Record<string, unknown>;
  closed_reason: string | null;
  created_at: string;
  patients: { name: string; name_ar: string | null } | null;
};

type ActionRow = {
  id: string;
  at: string;
  chose: string;
  reason: string;
  considered: string[];
  observed: Record<string, unknown>;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  ok: boolean;
  sura_goals: { kind: string; value_omr: number } | null;
};

const KIND_AR: Record<string, string> = {
  gap_fill: "كرسي فارغ",
  plan_recovery: "خطة متوقّفة",
  visit_prep: "تحضير زيارة",
  balance_recovery: "رصيد متأخّر",
  booking_followup: "متابعة حجز",
};

const CHOSE_AR: Record<string, string> = {
  message_patient: "راسلت المريض",
  wait: "أجّلت القرار",
  drop: "أغلقت الهدف",
  escalate: "حوّلت لفريق العيادة",
  hold: "أمسكت عن الإرسال",
};

export default async function SuraAgentPage() {
  const claims = await getUserClaims();
  const roles = claims ? rolesOf(claims) : [];
  if (!claims || !roles.includes("clinic_admin")) redirect("/login");
  /* The manual trigger is the platform owner's, not the clinic's. */
  const isOwner = roles.includes("platform_admin");

  const sb = await createServerSupabaseClient();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: goalsRaw }, { data: actionsRaw }] = await Promise.all([
    sb
      .from("sura_goals")
      .select("id, kind, state, value_omr, context, closed_reason, created_at, patients(name, name_ar)")
      .gte("created_at", monthAgo)
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("sura_actions")
      .select("id, at, chose, reason, considered, observed, args, result, ok, sura_goals(kind, value_omr)")
      .gte("at", monthAgo)
      .order("at", { ascending: false })
      .limit(40),
  ]);

  const goals = (goalsRaw ?? []) as unknown as GoalRow[];
  const actions = (actionsRaw ?? []) as unknown as ActionRow[];

  /* Money earned is only what actually closed. A goal still in flight is
     a hope, and hopes do not go on the headline number. */
  const earned = goals
    .filter((g) => g.state === "done")
    .reduce((s, g) => s + Number(g.value_omr || 0), 0);

  const live = goals.filter((g) => g.state === "open" || g.state === "waiting");
  const atRisk = live.reduce((s, g) => s + Number(g.value_omr || 0), 0);
  const messaged = actions.filter((a) => a.chose === "message_patient" && a.ok).length;

  const fmt = (n: number) =>
    n.toLocaleString("ar-OM", { maximumFractionDigits: 1 });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bot className="size-6" style={{ color: "var(--accent-1)" }} />
            سُرى الوكيل
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-2)]">
            ما فعلته سُرى من تلقاء نفسها خلال آخر ٣٠ يوماً — بلا أن يراسلها أحد.
            كل قرار هنا قابل للفتح لتقرأ سببه.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportLink />
          {isOwner && <RunTick />}
        </div>
      </header>

      {/* The conversation first.

          This page opened with four KPI tiles, which made it a report
          about Sura rather than a place to work with her. The tiles still
          matter — they are the answer to "is this earning its keep" — but
          they belong under the thing you came here to use. */}
      <SuraConsole />

      <KpiGrid
        items={[
          {
            label: "دخل استُرجع", value: `${fmt(earned)} ر.ع`,
            sub: "من أهداف أُغلقت بنجاح",
            color: "#22c55e", glow: "", border: "", spark: [], iconName: "Banknote",
          },
          {
            label: "قيمة قيد المتابعة", value: `${fmt(atRisk)} ر.ع`,
            sub: `${fmt(live.length)} هدفاً مفتوحاً`,
            color: "#5b93ff", glow: "", border: "", spark: [], iconName: "Clock",
          },
          {
            label: "رسائل بمبادرة منها", value: fmt(messaged),
            sub: "لم يبدأها المريض",
            color: "#5b93ff", glow: "", border: "", spark: [], iconName: "Bot",
          },
          {
            label: "أهداف رصدتها", value: fmt(goals.length),
            sub: "خلال ٣٠ يوماً",
            color: "#a78bfa", glow: "", border: "", spark: [], iconName: "Activity",
          },
        ]}
      />

      {/* ── what it is working on now ── */}
      <section className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-3">
          <ClipboardList className="size-4" style={{ color: "var(--accent-1)" }} />
          <h2 className="text-sm font-bold">تعمل عليه الآن</h2>
        </div>

        {live.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--text-3)]">
            لا يوجد شيء مفتوح. لا كرسي فارغ ولا خطة متوقّفة تحتاج تدخّلاً.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--hairline)]">
            {live.slice(0, 8).map((g) => {
              const c = g.context as Record<string, string>;
              const who = g.patients?.name_ar || g.patients?.name;
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2 py-0.5 text-[11px] text-[var(--text-3)]">
                    {g.kind === "gap_fill" ? <CalendarX2 className="size-3" /> : <ClipboardList className="size-3" />}
                    {KIND_AR[g.kind] ?? g.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-2)]">
                    {g.kind === "gap_fill"
                      ? `${c.service_name ?? "خدمة"}${c.doctor_name ? ` · ${c.doctor_name}` : ""}`
                      : `${c.plan_title ?? "خطة"}${who ? ` · ${who}` : ""}`}
                  </span>
                  <span className="font-bold" style={{ color: "var(--accent-1)" }}>
                    {fmt(Number(g.value_omr))} ر.ع
                  </span>
                  <span className="text-[11px] text-[var(--text-3)]">
                    {g.state === "waiting" ? "بانتظار ردّ" : "قيد التقييم"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── the reasoning log ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold">سجلّ القرارات</h2>

        {actions.length === 0 ? (
          <p className="panel px-4 py-10 text-center text-sm text-[var(--text-3)]">
            لم تتّخذ سُرى قراراً بعد. تعمل كل عشر دقائق وتتصرّف حين تجد ما يستحقّ.
          </p>
        ) : (
          actions.map((a) => (
            <WhyCard
              key={a.id}
              at={a.at}
              kindLabel={KIND_AR[a.sura_goals?.kind ?? ""] ?? "هدف"}
              choseLabel={CHOSE_AR[a.chose] ?? a.chose}
              chose={a.chose}
              ok={a.ok}
              valueOmr={Number(a.sura_goals?.value_omr ?? 0)}
              reason={a.reason}
              considered={a.considered ?? []}
              observed={a.observed ?? {}}
              args={a.args ?? {}}
              result={a.result ?? {}}
            />
          ))
        )}
      </section>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--text-3)]">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        سُرى لا تراسل أحداً بين ٢١:٠٠ و٠٨:٠٠، ولا ترسل أكثر من رسالة واحدة
        للمريض نفسه في اليوم، وتتوقّف بعد محاولتين. هذه حدود مكتوبة في كود
        النظام لا في تعليمات النموذج.
      </p>
    </div>
  );
}
