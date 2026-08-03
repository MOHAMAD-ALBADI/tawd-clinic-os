/* Sura the agent — shared types.
 *
 * A goal is the unit of work. It is opened by a scanner, it outlives the
 * conversation that may or may not follow, and it closes with an outcome
 * and a reason. Everything else in this folder serves that lifecycle.
 */

export type GoalKind =
  | "gap_fill"
  | "plan_recovery"
  | "visit_prep"
  | "balance_recovery"
  | "booking_followup";

export type GoalState = "open" | "waiting" | "done" | "dropped" | "escalated";

export type Goal = {
  id: string;
  clinic_id: string;
  kind: GoalKind;
  state: GoalState;
  subject_id: string | null;
  patient_id: string | null;
  value_omr: number;
  context: Record<string, unknown>;
  attempts: number;
  next_action_at: string;
};

/** A patient the agent could offer a freed slot to, with the facts that decide it. */
export type GapCandidate = {
  patient_id: string;
  name: string;
  phone: string;
  /** A treatment they have already accepted and not yet had. The strongest signal. */
  open_plan_item: string | null;
  open_plan_omr: number | null;
  visits: number;
  no_shows: number;
  /** The hour they usually come, in clinic time. */
  pref_hour: number | null;
  on_waitlist: boolean;
  /** 999 means never contacted by the agent. */
  days_since_contact: number;
};

/* The four things the agent is allowed to do at a wake-up.
 *
 * Deliberately small. An agent that can do anything cannot be reasoned
 * about, and in a clinic it cannot be sold. Widening this list is a
 * decision someone makes on purpose, not something a prompt can do. */
export type Decision =
  | {
      action: "message_patient";
      patient_id: string;
      message_ar: string;
      reason: string;
      considered: string[];
    }
  | {
      action: "wait";
      wake_in_minutes: number;
      reason: string;
      considered: string[];
    }
  | { action: "drop"; reason: string; considered: string[] }
  | { action: "escalate"; reason: string; considered: string[] };

export type ActionLog = {
  clinic_id: string;
  goal_id: string;
  observed: Record<string, unknown>;
  considered: string[];
  chose: string;
  args: Record<string, unknown>;
  reason: string;
  result: Record<string, unknown>;
  ok: boolean;
};

/* A file the user dropped into the conversation.

   Gemini reads images and PDFs natively, so a scan of an insurance card,
   a lab report or a supplier's quotation can be handed straight to the
   model rather than described to it. The bytes never land in our storage:
   they travel with the question and are gone when the request ends, which
   is the right default for a photograph of somebody's medical document. */
export type Attachment = { mime: string; data: string; name?: string };
