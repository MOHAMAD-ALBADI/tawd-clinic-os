import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";
import { decide } from "./decide";
import { LIMITS, agentEnabled, gateOutbound, minutesUntilOpen, e164 } from "./policy";
import type { ActionLog, Decision, GapCandidate, Goal } from "./types";

/* One beat of the agent.
 *
 *   sense → prioritise → decide → act → schedule
 *
 * Sense and prioritise are SQL and cost nothing, so they run over every
 * clinic every time. Decide costs money, so it runs on at most
 * MAX_DECISIONS_PER_TICK goals, highest value first. That ordering is the
 * whole cost model: the agent spends its budget where the riyals are.
 *
 * Every branch writes to sura_actions, including the ones where it chose
 * to do nothing. A silent no-op is indistinguishable from a broken cron,
 * and the difference matters at 3am when the clinic asks why nothing
 * happened.
 */

export type TickReport = {
  scanned: { gaps: number; plans: number };
  considered: number;
  messaged: number;
  dropped: number;
  waited: number;
  skipped: { goal: string; why: string }[];
  errors: string[];
};

export async function runTick(): Promise<TickReport> {
  const svc = await createServiceRoleClient();
  const report: TickReport = {
    scanned: { gaps: 0, plans: 0 },
    considered: 0,
    messaged: 0,
    dropped: 0,
    waited: 0,
    skipped: [],
    errors: [],
  };

  /* A showcase clinic has nobody to mark arrivals, so its days would
     otherwise close at 100% no-show — the automated marker is correct
     and there is simply no human on the other side of it. Resolving the
     day here keeps the dataset honest without a cron of its own, and it
     is idempotent: outcomes come from a hash of the appointment id, so
     running it every ten minutes changes nothing after the first. */
  const closed = await svc.rpc("tawd_close_demo_day");
  if (closed.error) report.errors.push(`close_day: ${closed.error.message}`);

  /* ── sense ─────────────────────────────────────────────────────── */
  const [gaps, plans] = await Promise.all([
    svc.rpc("sura_scan_gap_fill"),
    svc.rpc("sura_scan_plan_recovery"),
  ]);
  if (gaps.error) report.errors.push(`scan_gap: ${gaps.error.message}`);
  if (plans.error) report.errors.push(`scan_plan: ${plans.error.message}`);
  report.scanned.gaps = (gaps.data as number) ?? 0;
  report.scanned.plans = (plans.data as number) ?? 0;

  /* ── prioritise ────────────────────────────────────────────────── */
  /* The value floor is applied here rather than in the query, because it
     must not apply to work a person explicitly handed over.

     A lapsed patient with no open treatment plan is worth zero on paper,
     so the floor silently dropped every one of fifteen the owner had
     just asked Sura to chase — the tick reported "considered: 0" and
     looked like it was working. An instruction outranks a heuristic. */
  const { data: pool, error: dueErr } = await svc
    .from("sura_goals")
    .select("id, clinic_id, kind, state, subject_id, patient_id, value_omr, context, attempts, next_action_at")
    .in("state", ["open", "waiting"])
    .lte("next_action_at", new Date().toISOString())
    .order("value_omr", { ascending: false })
    .limit(LIMITS.MAX_DECISIONS_PER_TICK * 6);

  if (dueErr) {
    report.errors.push(`due: ${dueErr.message}`);
    return report;
  }

  const due = ((pool ?? []) as Goal[])
    .filter((g) => {
      const asked = (g.context as Record<string, unknown>)?.queued_by === "sura_conversation";
      return asked || Number(g.value_omr) >= LIMITS.MIN_VALUE_OMR;
    })
    .slice(0, LIMITS.MAX_DECISIONS_PER_TICK);

  const secrets = await platformSecrets();
  if (!secrets.geminiKey) {
    report.errors.push("no gemini key in platform_secrets — agent cannot decide");
    return report;
  }

  for (const row of due) {
    try {
      await handle(svc, row, secrets.geminiKey, report);
    } catch (e) {
      report.errors.push(`${row.id}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return report;
}

/* ─────────────────────────────────────────────────────────────────── */

type Svc = Awaited<ReturnType<typeof createServiceRoleClient>>;

async function handle(svc: Svc, goal: Goal, key: string, report: TickReport) {
  /* A goal that has had its two attempts closes here rather than in the
     model. Whether to keep trying is a policy question, and policy
     questions are not sent to a language model. */
  if (goal.attempts >= LIMITS.MAX_ATTEMPTS_PER_GOAL) {
    await close(svc, goal, "dropped", "لم يردّ بعد محاولتين", "no_response");
    report.dropped++;
    return;
  }

  const enabled = await agentEnabled(svc, goal.clinic_id);
  if (enabled.blocked) {
    await sleep(svc, goal, 12 * 60);
    report.skipped.push({ goal: goal.id, why: enabled.why });
    return;
  }

  /* Gather the facts. The model gets exactly this and nothing else — no
     database handle, no ability to look further. */
  let candidates: GapCandidate[] = [];
  let patient: { id: string; name: string; phone: string } | null = null;

  if (goal.kind === "gap_fill") {
    /* The gap may have closed itself: reception re-sold the hour, or the
       slot is now in the past. Checking before spending a model call is
       both cheaper and the difference between an agent and a mailer. */
    const stillOpen = await gapStillOpen(svc, goal);
    if (!stillOpen) {
      await close(svc, goal, "dropped", "الموعد لم يعد شاغراً", "slot_taken");
      report.dropped++;
      return;
    }
    const { data } = await svc.rpc("sura_gap_candidates", { p_goal: goal.id });
    candidates = ((data as GapCandidate[]) ?? []).filter((c) => c.days_since_contact >= 1);
    if (candidates.length === 0) {
      await close(svc, goal, "dropped", "لا يوجد مرشّح مناسب لهذه الساعة", "no_candidate");
      report.dropped++;
      return;
    }
  } else {
    if (!goal.patient_id) {
      await close(svc, goal, "dropped", "الهدف بلا مريض", "no_patient");
      report.dropped++;
      return;
    }
    const { data } = await svc
      .from("patients")
      .select("id, name, name_ar, phone")
      .eq("id", goal.patient_id)
      .maybeSingle();
    if (!data?.phone) {
      await close(svc, goal, "dropped", "لا يوجد رقم تواصل للمريض", "no_phone");
      report.dropped++;
      return;
    }
    patient = { id: data.id, name: data.name_ar || data.name, phone: data.phone };
  }

  /* ── decide ──────────────────────────────────────────────────── */
  report.considered++;
  const observed = {
    kind: goal.kind,
    value_omr: goal.value_omr,
    ...goal.context,
    ...(candidates.length ? { candidate_count: candidates.length } : {}),
  };

  const d = await decide(key, goal, {
    candidates,
    patient: patient ? { name: patient.name } : undefined,
  });

  if (!d) {
    /* The model failed or returned something unusable. Back off rather
       than retry immediately — a provider outage would otherwise burn
       every attempt on every goal within one tick. */
    await sleep(svc, goal, 45);
    report.skipped.push({ goal: goal.id, why: "تعذّر الحصول على قرار من النموذج" });
    return;
  }

  /* ── act ─────────────────────────────────────────────────────── */
  await execute(svc, goal, d, observed, candidates, patient, report);
}

async function execute(
  svc: Svc,
  goal: Goal,
  d: Decision,
  observed: Record<string, unknown>,
  candidates: GapCandidate[],
  patient: { id: string; name: string; phone: string } | null,
  report: TickReport,
) {
  const base: Omit<ActionLog, "chose" | "args" | "result" | "ok"> = {
    clinic_id: goal.clinic_id,
    goal_id: goal.id,
    observed,
    considered: d.considered,
    reason: d.reason,
  };

  if (d.action === "wait") {
    await log(svc, { ...base, chose: "wait", args: { minutes: d.wake_in_minutes }, result: {}, ok: true });
    await sleep(svc, goal, d.wake_in_minutes);
    report.waited++;
    return;
  }

  if (d.action === "drop" || d.action === "escalate") {
    await log(svc, { ...base, chose: d.action, args: {}, result: {}, ok: true });
    await close(svc, goal, d.action === "drop" ? "dropped" : "escalated", d.reason, d.action);
    report.dropped++;
    return;
  }

  /* message_patient — the only branch that reaches a human. */
  const target =
    goal.kind === "gap_fill"
      ? candidates.find((c) => c.patient_id === d.patient_id)
      : patient
        ? { patient_id: patient.id, name: patient.name, phone: patient.phone }
        : undefined;

  if (!target) {
    await log(svc, { ...base, chose: "message_patient", args: { patient_id: d.patient_id }, result: { error: "unknown patient" }, ok: false });
    await sleep(svc, goal, 60);
    return;
  }

  /* The last gate. Everything above this line was a plan; this is where
     it becomes a message on someone's phone. */
  const gate = await gateOutbound(svc, target.patient_id);
  if (gate.blocked) {
    await log(svc, { ...base, chose: "hold", args: { patient_id: target.patient_id }, result: { blocked: gate.why }, ok: true });
    await sleep(svc, goal, minutesUntilOpen());
    report.skipped.push({ goal: goal.id, why: gate.why });
    return;
  }

  const sent = await sendWhatsApp(svc, goal.clinic_id, target.phone, d.message_ar);

  /* The same log the console writes to, so "what did you send my
     patient?" has one answer and not two half-answers in two tables. */
  await svc.from("sura_outbound").insert({
    clinic_id: goal.clinic_id,
    patient_id: target.patient_id,
    channel: "whatsapp",
    body: d.message_ar,
    source: "agent",
    goal_id: goal.id,
    ok: sent.ok,
    error: sent.error ?? null,
  });

  await log(svc, {
    ...base,
    chose: "message_patient",
    args: { patient_id: target.patient_id, name: target.name, message_ar: d.message_ar },
    result: sent,
    ok: sent.ok,
  });

  if (sent.ok) {
    /* A gap has no owner until now. Recording it here is what makes the
       one-message-per-patient rule work across goal kinds. */
    await svc
      .from("sura_goals")
      .update({
        patient_id: target.patient_id,
        state: "waiting",
        attempts: goal.attempts + 1,
        next_action_at: new Date(Date.now() + 20 * 3600_000).toISOString(),
      })
      .eq("id", goal.id);
    report.messaged++;
    return;
  }

  /* A failed send counts as an attempt.
   *
   * It did not before, and that was an infinite loop waiting to happen: a
   * permanently failing send — a number Meta will not deliver to, a
   * revoked token, a patient who blocked the clinic — would be retried
   * every ninety minutes for the life of the goal, burning a model call
   * each time and never reaching the attempt ceiling that exists
   * precisely to stop this.
   *
   * The attempt ceiling now covers "we could not reach them" as well as
   * "they did not reply", which is the honest reading of both. */
  await svc
    .from("sura_goals")
    .update({
      patient_id: target.patient_id,
      state: "waiting",
      attempts: goal.attempts + 1,
      next_action_at: new Date(Date.now() + 90 * 60_000).toISOString(),
    })
    .eq("id", goal.id);
}

/* ── the small pieces ─────────────────────────────────────────────── */

async function gapStillOpen(svc: Svc, goal: Goal): Promise<boolean> {
  const c = goal.context as Record<string, string>;
  if (!c.slot_time || new Date(c.slot_time).getTime() < Date.now() + 3600_000) return false;

  const { count } = await svc
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", goal.clinic_id)
    .eq("doctor_id", c.doctor_id)
    .eq("slot_time", c.slot_time)
    .is("deleted_at", null)
    .not("status", "in", "(cancelled,no_show)");

  return (count ?? 0) === 0;
}

async function sleep(svc: Svc, goal: Goal, minutes: number) {
  await svc
    .from("sura_goals")
    .update({ state: "waiting", next_action_at: new Date(Date.now() + minutes * 60_000).toISOString() })
    .eq("id", goal.id);
}

async function close(
  svc: Svc,
  goal: Goal,
  state: "done" | "dropped" | "escalated",
  reason: string,
  outcome: string,
) {
  await svc
    .from("sura_goals")
    .update({ state, closed_reason: reason, outcome, closed_at: new Date().toISOString() })
    .eq("id", goal.id);
}

async function log(svc: Svc, a: ActionLog) {
  await svc.from("sura_actions").insert(a);
}

/* Sends from the clinic's own WhatsApp number, never the platform's.
 *
 * This is the rule the platform got wrong five times before: a message
 * to a clinic's patient must leave from that clinic's number, or the
 * patient sees a stranger. */
async function sendWhatsApp(
  svc: Svc,
  clinicId: string,
  phone: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: cfg } = await svc
    .from("channel_configs")
    .select("config")
    .eq("clinic_id", clinicId)
    .eq("channel", "whatsapp")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const conf = cfg?.config as Record<string, string> | null;
  const to = e164(phone);
  if (!conf?.access_token || !conf?.phone_number_id || !to) {
    return { ok: false, error: "واتساب غير مربوط لهذه العيادة" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${conf.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
        }),
      },
    );
    if (!res.ok) return { ok: false, error: (await res.text()).slice(0, 300) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}
