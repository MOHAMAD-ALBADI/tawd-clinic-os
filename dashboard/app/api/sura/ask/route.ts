import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";
import { hasRole } from "@/lib/auth/role-redirect";
import { runAction, type Action } from "@/lib/sura/actions";
import { deferring, refusing } from "@/lib/sura/doc-guard";
import { notificationsFor } from "@/lib/notifications";
import { toolsFor } from "@/lib/sura/tools";
import type { Attachment } from "@/lib/sura/types";
import { ensureConversation, saveTurn, type StoredFile } from "@/lib/sura/conversations";

export const dynamic = "force-dynamic";
/* Five model turns at up to twenty-eight seconds each cannot fit in
   sixty. Fluid Compute allows three hundred, and a request that ends
   because the platform killed it is indistinguishable from a bug. */
export const maxDuration = 300;

/* ═══════════════════════════════════════════════════════════════
   Ask-Sura v2 — an agent over the clinic's LIVE database.
   The model plans structured queries (JSON, never raw SQL); the
   server validates each against a strict whitelist, force-scopes
   clinic_id (and doctor_id for doctors), executes via supabase,
   computes aggregates, then the model writes the Arabic answer.
   Up to 2 query rounds. Gemini key comes from channel_configs.
   ═══════════════════════════════════════════════════════════════ */

type Role = "clinic_admin" | "doctor" | "receptionist" | "accountant" | "platform_admin";

const TABLES: Record<string, { cols: string[]; clinicCol: boolean; desc: string }> = {
  patients: {
    cols: ["id", "name", "name_ar", "phone", "email", "gender", "loyalty_points", "source_channel", "created_at", "last_recalled_at", "last_winback_at", "is_archived"],
    clinicCol: true,
    desc: "المرضى (loyalty_points=نقاط الولاء، created_at=تاريخ التسجيل)",
  },
  appointments: {
    cols: ["id", "patient_id", "doctor_id", "service_id", "slot_time", "duration_minutes", "status", "type", "source_channel", "notes", "cancellation_reason", "created_at", "followup_sent_at"],
    clinicCol: true,
    desc: "المواعيد (slot_time=وقت الموعد UTC، status: scheduled|confirmed|checked_in|in_progress|completed|cancelled|no_show)",
  },
  services: {
    cols: ["id", "name", "name_ar", "price", "duration_minutes", "is_active"],
    clinicCol: true,
    desc: "الخدمات والأسعار (بالريال العماني)",
  },
  invoices: {
    cols: ["id", "patient_id", "appt_id", "total", "status", "created_at"],
    clinicCol: true,
    desc: "الفواتير (status: draft|sent|paid|partially_paid|overdue|cancelled)",
  },
  invoice_items: {
    cols: ["id", "invoice_id", "service_id", "description_ar", "quantity", "unit_price_snapshot", "vat_amount", "total"],
    clinicCol: true,
    desc: "بنود الفواتير",
  },
  tawd_staff_users: {
    cols: ["id", "name", "name_ar", "role", "is_active"],
    clinicCol: true,
    desc: "الكادر (role: doctor|receptionist|accountant|clinic_admin)",
  },
  appointment_waitlist: {
    cols: ["id", "patient_id", "service_id", "status", "priority", "created_at"],
    clinicCol: true,
    desc: "قائمة انتظار الحجز (status=waiting يعني ينتظر)",
  },
  sura_alerts: {
    cols: ["id", "kind", "severity", "status", "patient_name", "phone", "message", "created_at"],
    clinicCol: true,
    desc: "تنبيهات سُرى (kind: emergency|complaint، status: open|acknowledged)",
  },
  chat_sessions: {
    cols: ["id", "patient_id", "channel_type", "created_at"],
    clinicCol: true,
    desc: "محادثات واتساب مع سُرى",
  },
  chat_messages: {
    cols: ["id", "session_id", "sender_type", "content", "created_at"],
    clinicCol: true,
    desc: "رسائل المحادثات (sender_type: user|ai|staff)",
  },
  automation_recovery_ledger: {
    cols: ["id", "event_type", "amount", "source", "occurred_at"],
    clinicCol: true,
    desc: "سجل المبالغ التي استردّتها سُرى (amount بالريال)",
  },
  no_show_log: {
    cols: ["id", "appt_id", "patient_id", "marked_at"],
    clinicCol: true,
    desc: "سجل الغياب عن المواعيد",
  },

  /* ── the half of the clinic she could not see ──────────────────────
   *
   * Asked how many treatment plans were open, she called query_clinic on
   * treatment_plans and was refused: the table was not on the list. She
   * fell back to the summary and answered from that — right by luck, and
   * the same shape of failure as every "she cannot see X" before it.
   *
   * A clinic OS grew modules for a year — plans, payments, expenses,
   * insurance, stock, the waiting room — and this list was never widened
   * to match. Adding them is not a feature; it is the reach the product
   * already sells. */
  treatment_plans: {
    cols: ["id", "patient_id", "doctor_id", "title", "status", "total_estimate", "created_at", "updated_at"],
    clinicCol: true,
    desc: "خطط العلاج (status: draft|proposed|accepted|in_progress|completed|cancelled — total_estimate بالريال)",
  },
  treatment_plan_items: {
    cols: ["id", "plan_id", "service_id", "description", "tooth_number", "quantity", "unit_price", "line_total", "status", "done_at"],
    clinicCol: true,
    desc: "بنود خطط العلاج (status: pending|done — done_at وقت الإنجاز)",
  },
  payments: {
    cols: ["id", "invoice_id", "gateway", "amount", "status", "paid_at", "received_by", "voided_at", "void_reason"],
    clinicCol: true,
    desc: "الدفعات المستلمة (gateway: cash|card|transfer|thawani، status: completed|pending|refunded|voided)",
  },
  expenses: {
    cols: ["id", "category", "amount", "expense_date", "payment_method", "description", "vendor", "created_at"],
    clinicCol: true,
    desc: "مصروفات العيادة (amount بالريال) — الربح = الإيراد ناقص هذه",
  },
  insurance_claims: {
    cols: ["id", "patient_id", "provider_id", "invoice_id", "status", "claim_ref", "submitted_amount", "approved_amount", "submitted_at", "resolved_at", "rejection_reason"],
    clinicCol: true,
    desc: "مطالبات التأمين (status: draft|submitted|approved|rejected|paid)",
  },
  patient_insurance: {
    cols: ["id", "patient_id", "provider_id", "policy_number", "coverage_percent", "valid_until", "is_active"],
    clinicCol: true,
    desc: "تغطية المرضى التأمينية (coverage_percent نسبة التغطية)",
  },
  inventory_items: {
    cols: ["id", "name", "name_ar", "sku", "category", "unit", "current_stock", "reorder_level", "cost_price", "is_active"],
    clinicCol: true,
    desc: "المخزون (current_stock أقل من reorder_level يعني يحتاج طلب)",
  },
  waiting_queue: {
    cols: ["id", "appt_id", "patient_id", "queue_position", "status", "check_in_at", "called_at", "estimated_wait_minutes"],
    clinicCol: true,
    desc: "غرفة الانتظار الآن (status: waiting|called|in_room|done)",
  },
  doctor_schedules: {
    cols: ["id", "doctor_id", "day_of_week", "start_time", "end_time", "slot_duration_minutes", "is_active"],
    clinicCol: true,
    desc: "دوام الأطباء (day_of_week: 0=الأحد … 6=السبت — قد يكون للطبيب أكثر من فترة في اليوم)",
  },
  prescriptions: {
    cols: ["id", "patient_id", "doctor_id", "appt_id", "status", "diagnosis", "signed_at", "created_at"],
    clinicCol: true,
    desc: "الوصفات الطبية",
  },
  patient_notes: {
    cols: ["id", "patient_id", "doctor_id", "note_text", "is_private", "created_at"],
    clinicCol: true,
    desc: "الملاحظات السريرية على ملفات المرضى",
  },
  sura_goals: {
    cols: ["id", "kind", "state", "patient_id", "value_omr", "attempts", "next_action_at", "outcome", "closed_reason", "created_at"],
    clinicCol: true,
    desc: "أهداف سُرى الذاتية (kind: gap_fill|plan_recovery، state: open|waiting|done|dropped) — ما تعمل عليه بنفسها",
  },
  sura_outbound: {
    cols: ["id", "patient_id", "channel", "body", "source", "ok", "error", "created_at"],
    clinicCol: true,
    desc: "سجل الرسائل المُرسَلة للمرضى (source: conversation=بطلب موظف، agent=بمبادرة سُرى)",
  },
};

/* embedded relations allowed per table (names resolved server-side) */
const EMBEDS: Record<string, string> = {
  appointments: "patients!patient_id(name,phone), services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar,name)",
  invoices: "patients!patient_id(name,phone)",
  invoice_items: "services!service_id(name_ar)",
  appointment_waitlist: "patients!patient_id(name,phone), services!service_id(name_ar)",
  chat_sessions: "patients!patient_id(name,phone)",
  no_show_log: "patients!patient_id(name,phone)",
  treatment_plans: "patients!patient_id(name,name_ar), tawd_staff_users!doctor_id(name_ar,name)",
  treatment_plan_items: "services!service_id(name_ar,name)",
  payments: "invoices!invoice_id(invoice_number,total,patient_id)",
  insurance_claims: "patients!patient_id(name,name_ar), insurance_providers!provider_id(name_ar,name)",
  patient_insurance: "patients!patient_id(name,name_ar), insurance_providers!provider_id(name_ar,name)",
  waiting_queue: "patients!patient_id(name,name_ar)",
  prescriptions: "patients!patient_id(name,name_ar)",
  patient_notes: "patients!patient_id(name,name_ar)",
  sura_goals: "patients!patient_id(name,name_ar)",
  sura_outbound: "patients!patient_id(name,name_ar)",
  doctor_schedules: "tawd_staff_users!doctor_id(name_ar,name)",
};

/* ── the platform owner's own catalogue ──────────────────────────────────────

   The platform owner used to get every clinic table with clinic scoping turned
   OFF. That is two separate problems.

   It answered the wrong questions: his are about clinics, subscriptions, debt
   and cost, and none of those tables were reachable — so Sura offered to count
   patients and could not tell him who had not paid.

   And it read other people's patients. Names, phones, emails and the actual
   text of WhatsApp conversations between a patient and their clinic, across
   every tenant, through a chat box with no purpose and no audit trail. Entering
   a clinic's dashboard already requires that clinic's explicit approval and is
   logged; this walked straight past that.

   So: platform mode gets the platform's own tables in full, and clinic tables
   only as counts. aggregateOnly refuses to return rows, and the column list has
   no identifying field in it, so "how many patients across all clinics" works
   and "show me their names" cannot. */
const PLATFORM_TABLES: Record<string, { cols: string[]; clinicCol: boolean; desc: string; aggregateOnly?: boolean }> = {
  tawd_clinics: {
    cols: ["id", "name", "name_ar", "clinic_type", "status", "plan", "phone", "created_at"],
    clinicCol: false,
    desc: "العيادات المشتركة (status: trial|active|suspended|cancelled)",
  },
  tawd_subscriptions: {
    cols: ["clinic_id", "plan", "status", "price_omr", "billing_cycle", "trial_ends_at", "current_period_end", "created_at"],
    clinicCol: false,
    desc: "اشتراكات العيادات — price_omr هو المتفق عليه شهرياً (status: trial|active|past_due|paused|cancelled)",
  },
  clinic_entitlements: {
    cols: ["clinic_id", "source_plan", "modules", "max_doctors", "max_staff", "max_patients", "base_price_omr", "per_doctor_omr", "contracted_doctors", "discount_pct"],
    clinicCol: false,
    desc: "اتفاق كل عيادة: الخدمات المشمولة (modules) وحدودها وسعرها",
  },
  platform_invoices: {
    cols: ["id", "number", "clinic_id", "period_start", "period_end", "total_omr", "status", "issued_at", "due_at"],
    clinicCol: false,
    desc: "فواتير المنصة على العيادات (status: open|paid|void) — open يعني لم تُسدَّد",
  },
  platform_payments: {
    cols: ["id", "invoice_id", "clinic_id", "amount_omr", "method", "paid_at"],
    clinicCol: false,
    desc: "الدفعات التي وصلت فعلاً من العيادات (بالريال العماني)",
  },
  platform_plans: {
    cols: ["code", "name_ar", "price_omr", "per_doctor_omr", "modules", "max_doctors", "max_staff", "max_patients", "is_active"],
    clinicCol: false,
    desc: "قوالب الباقات",
  },
  platform_costs: {
    cols: ["id", "name", "monthly_omr"],
    clinicCol: false,
    desc: "تكاليف المنصة الشهرية الثابتة",
  },
  tawd_staff_users: {
    cols: ["id", "clinic_id", "name", "name_ar", "role", "is_active", "created_at"],
    clinicCol: false,
    desc: "حسابات موظفي العيادات (role: doctor|receptionist|accountant|admin)",
  },
  sura_errors: {
    cols: ["id", "clinic_id", "workflow_name", "node_name", "error_message", "created_at"],
    clinicCol: false,
    desc: "أخطاء محرك سُرى في العيادات",
  },
  ai_usage_metrics: {
    cols: ["id", "clinic_id", "workflow_id", "model", "tokens_total", "created_at"],
    clinicCol: false,
    desc: "استهلاك التوكنز لكل عيادة",
  },
  /* counts only — no name, no phone, no message text */
  patients: {
    cols: ["id", "clinic_id", "created_at", "source_channel"],
    clinicCol: false, aggregateOnly: true,
    desc: "أعداد المرضى فقط (لا أسماء ولا أرقام — بيانات مرضى العيادات ليست بيانات المنصة)",
  },
  appointments: {
    cols: ["id", "clinic_id", "status", "source_channel", "created_at", "slot_time"],
    clinicCol: false, aggregateOnly: true,
    desc: "أعداد المواعيد فقط (للاستخدام والنشاط، لا تفاصيل مرضى)",
  },
  chat_messages: {
    cols: ["id", "clinic_id", "sender_type", "created_at"],
    clinicCol: false, aggregateOnly: true,
    desc: "أعداد رسائل سُرى فقط (المحتوى خاص بالعيادة ومرضاها)",
  },
};

const ROLE_TABLES: Record<Role, string[]> = {
  clinic_admin: Object.keys(TABLES),
  accountant: Object.keys(TABLES),
  platform_admin: Object.keys(PLATFORM_TABLES),
  doctor: ["appointments", "patients", "services", "tawd_staff_users", "appointment_waitlist", "no_show_log"],
  receptionist: ["appointments", "patients", "services", "tawd_staff_users", "appointment_waitlist", "sura_alerts", "no_show_log", "chat_sessions"],
};

/** The catalogue this role reads from. The platform owner's is a different set
    of tables entirely, not a wider slice of the same one. */
const tablesFor = (role: Role) => (role === "platform_admin" ? PLATFORM_TABLES : TABLES);

/* The conversation runs on the strongest model the account opens.
 *
 * Probed against the live key before switching: given a bare persona,
 * 2.5-flash, 3.6-flash and 3.1-pro all answered "لا أستطيع إنشاء
 * مستندات PDF". Given one line naming her tools, all three answered
 * yes. The refusals were never a shortage of intelligence — but the
 * stronger model holds a long Arabic instruction far better, and this
 * one is asked to hold about a hundred lines of them.
 *
 * The autonomous loop stays on flash: it wakes every ten minutes and
 * makes one narrow choice, which is not what Pro money is for. */
/* Two brains, because one of them does not fit in the clock.
 *
 * Pro on every turn was measured and it does not work: a request that
 * gathers, generates a cover and writes a body ran past the platform's
 * 300-second ceiling and the whole thing was lost — worse than a weaker
 * answer, because nothing came back at all.
 *
 * The turns are not equal. Planning is mechanical: pick a table, pick a
 * filter, decide whether to act. Flash does it in about three seconds
 * where Pro takes forty. Writing the document is the one turn where the
 * quality of the mind is visible on the page, and it happens once.
 *
 * So the planner is flash and the writer is Pro. And the refusals that
 * started this were never about which model: probed against this key,
 * flash and Pro both refused a bare persona and both agreed once told
 * what they had. */
const MODEL = "gemini-3.6-flash";
const WRITER = "gemini-3.1-pro-preview";

/* Because the strong one is a preview.
 *
 * It answered a heavy request with a 500 and the clinic was shown
 * "خدمة الذكاء الاصطناعي متوقّفة مؤقتاً" — acceptable on a Tuesday,
 * unacceptable with someone watching. gemini-2.5-pro is not the escape
 * hatch it looked like either: it is listed on this key and returns 404
 * when called, which is why this is measured rather than assumed.
 *
 * So a provider fault falls through to the stable flash instead of
 * reaching the user. A slightly weaker answer beats no answer. */
const FALLBACK = "gemini-3.6-flash";

/** Pro is patient enough to be worth waiting for, once. */
const DEADLINE_MS = (model: string) => (model === WRITER ? 90_000 : 30_000);

/* A ceiling on what one clinic can spend in a day.
 *
 * An agent that calls a paid model in a loop has no natural stopping
 * point: a runaway conversation, a stuck retry, or somebody curious with
 * a login can all run a bill up quietly. Spending caps are named in the
 * programme's scope of work as a requirement, and they are simply right.
 *
 * Two million tokens is far above a working clinic's day — the heaviest
 * request measured here, a full analytical document with a generated
 * cover, cost about forty thousand. It is a runaway guard, not a
 * rationing scheme, and it is counted per clinic so one tenant cannot
 * spend another's allowance. */
const DAILY_TOKEN_CEILING = 2_000_000;

const OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Arabic names do not match as substrings ──────────────────────────
 *
 * Observed: asked to book «أحمد الريامي», Sura answered that no such
 * patient exists and offered to register one. He was already there, as
 * «أحمد بن سيف الريامي». A single ilike is a contiguous match, and the
 * patronymic is precisely the part nobody says aloud — so the lookup
 * failed and the offered remedy was a duplicate record for a patient the
 * clinic already had.
 *
 * Two more faults sit on the same lookup. Ten of this clinic's patients
 * carry their Arabic in `name` and twenty-two in `name_ar`, so searching
 * one column is a coin flip. And the hamza is optional in ordinary
 * typing: أحمد and احمد are one name to every human being and two
 * strings to LIKE.
 *
 * So a name search means: every token present, in either column, in any
 * order, under any spelling of the letters that carry ambiguity. */
const NAME_COLS = ["name", "name_ar"] as const;

/** The connectives in an Omani name. Present in the record, absent from
    what anyone types, and never the distinguishing part either way. */
const NAME_NOISE = new Set(["بن", "بنت", "ابن", "ابنة", "ال", "bin", "bint", "al"]);

/** Spellings of one token that a reader would consider the same word.
 *  Bounded at eight: hamza carriers on the first letter, where the
 *  ambiguity actually lives, and the ة/ه and ى/ي endings. Expanding
 *  every letter would multiply into hundreds of patterns for no gain. */
function spellings(token: string): string[] {
  let out = [token];
  if ("اأإآ".includes(token[0])) out = [..."اأإآ"].map((a) => a + token.slice(1));
  const last = token[token.length - 1];
  if ("ةه".includes(last)) out = out.flatMap((t) => [..."ةه"].map((h) => t.slice(0, -1) + h));
  else if ("ىي".includes(last)) out = out.flatMap((t) => [..."ىي"].map((y) => t.slice(0, -1) + y));
  return out;
}

/** Chained .or() calls are ANDed by PostgREST, which is exactly the
 *  shape wanted: one or-group per token, each satisfied by any spelling
 *  in any name column. */
function byName<Q extends { or(f: string): Q; ilike(c: string, v: string): Q }>(
  q: Q, value: string, cols: readonly string[],
): Q {
  const search = NAME_COLS.filter((c) => cols.includes(c));
  const tokens = value
    .replace(/[%_,.()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NAME_NOISE.has(t.toLowerCase()))
    .slice(0, 4);

  if (search.length === 0 || tokens.length === 0) {
    return q.ilike(search[0] ?? "name", `%${value}%`);
  }
  for (const tok of tokens) {
    q = q.or(spellings(tok).flatMap((s) => search.map((c) => `${c}.ilike.%${s}%`)).join(","));
  }
  return q;
}

/* What may be attached. An allowlist rather than a blocklist: the model
   will attempt whatever it is handed, and a clinic uploading a
   spreadsheet of patients to "have a look at" is a data path nobody
   designed. Images and PDFs cover the real cases — a card, a scan, a
   report, a quotation. */
/* Failure kinds the interface can act on.
 *
 * Every one of these used to collapse into "تعذّر التحليل الآن" with no
 * way to tell a rate limit from a bad key from a stalled provider — so
 * nobody could act on any of them, least of all the person watching a
 * demo fail. */
type SuraFailure =
  | "timeout" | "network" | "rate_limited" | "bad_key"
  | "provider_down" | "refused" | "too_long" | "empty" | "bad_json" | "unknown";

class SuraError extends Error {
  /* detail carries what the provider actually said. A rejection used to
     reach the clinic as «تعذّر التحليل الآن» and reach nobody else at
     all, so the same three-second failure had to be re-guessed each
     time. */
  constructor(public kind: SuraFailure, public detail?: string) { super(detail ? kind + ": " + detail : kind); }
}

const FAILURE_AR: Record<SuraFailure, string> = {
  timeout:       "استغرق الردّ وقتاً أطول من المسموح. جرّب سؤالاً أضيق أو أعد المحاولة.",
  network:       "تعذّر الوصول لخدمة الذكاء الاصطناعي. تحقّق من الاتصال وأعد المحاولة.",
  rate_limited:  "الطلبات كثيرة على الخدمة الآن. انتظر دقيقة وأعد المحاولة.",
  bad_key:       "مفتاح الذكاء الاصطناعي غير صالح أو منتهٍ — يحتاج تحديثاً من إعدادات المنصّة.",
  provider_down: "خدمة الذكاء الاصطناعي متوقّفة مؤقتاً. أعد المحاولة بعد قليل.",
  refused:       "لم أستطع الإجابة على هذه الصيغة. جرّب صياغة أخرى.",
  too_long:      "الجواب أطول من المساحة المتاحة. قسّم السؤال إلى جزأين.",
  empty:         "لم يصل ردّ من النموذج. أعد المحاولة.",
  bad_json:      "وصل ردّ غير مكتمل من النموذج. أعد المحاولة.",
  unknown:       "تعذّر التحليل الآن — أعد المحاولة بعد لحظات.",
};

const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif",
  "application/pdf",
]);

/* The action set lives in lib/sura/actions.ts.

   It was two appointment mutations inlined here, which meant the only
   things Sura could DO were cancel and confirm. Everything else she could
   describe and not perform — a search box with opinions. The shared module
   also lets the autonomous loop and this endpoint execute through one
   implementation, so a permission fixed in one place is fixed in both. */

type Filter = { col: string; op: string; value: unknown };
type Plan = {
  table: string;
  select?: string[];
  embed?: boolean;
  filters?: Filter[];
  order?: { col: string; desc?: boolean };
  limit?: number;
  aggregate?: { op: "sum" | "count" | "avg"; col?: string; group_by?: string };
};

function catalogFor(role: Role): string {
  const map = tablesFor(role);
  return ROLE_TABLES[role]
    .map((t) => {
      const def = map[t];
      const only = "aggregateOnly" in def && def.aggregateOnly ? " ⚠ للعدّ والتجميع فقط (aggregate إلزامي)" : "";
      const embed = role !== "platform_admin" && EMBEDS[t] ? " (يدعم embed=true لجلب أسماء المريض/الخدمة/الطبيب)" : "";
      return `- ${t}: [${def.cols.join(", ")}] — ${def.desc}${only}${embed}`;
    })
    .join("\n");
}

async function runPlan(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, plan: Plan, cid: string, role: Role, sub: string) {
  const map = tablesFor(role);
  const t = map[plan.table];
  if (!t || !ROLE_TABLES[role].includes(plan.table)) throw new Error(`جدول غير مسموح: ${plan.table}`);

  const agg = plan.aggregate;

  /* Enforced here rather than trusted to the prompt. A model that decides to
     "just look at a few rows" of another clinic's patients must be refused by
     the server, not asked nicely. */
  if ("aggregateOnly" in t && t.aggregateOnly && !agg) {
    throw new Error(
      `جدول ${plan.table} متاح للعدّ والتجميع فقط على مستوى المنصة — استخدمي aggregate (مثل {"op":"count","group_by":"clinic_id"}). بيانات المرضى وتفاصيل المحادثات ملك العيادة ولا تُقرأ من هنا.`
    );
  }
  const wantCols = (plan.select ?? []).filter((c) => t.cols.includes(c));
  const baseCols = wantCols.length ? wantCols : t.cols.slice(0, 8);
  const selectStr =
    (agg ? Array.from(new Set([...(agg.col ? [agg.col] : []), ...(agg.group_by ? [agg.group_by] : []), ...baseCols])) : baseCols).join(",") +
    /* Embeds pull patient and staff names onto a row. They belong to a clinic
       reading its own data; at platform level they would reintroduce exactly
       the identifiers the column lists above leave out. */
    (plan.embed && role !== "platform_admin" && EMBEDS[plan.table] ? `, ${EMBEDS[plan.table]}` : "");

  let q = sb.from(plan.table).select(selectStr);
  if (t.clinicCol && cid) q = q.eq("clinic_id", cid); // platform owner (cid='') = cross-clinic
  if (role === "doctor" && plan.table === "appointments") q = q.eq("doctor_id", sub);
  if ("deleted_at" in Object.fromEntries(t.cols.map((c) => [c, 1])) ) { /* noop */ }
  if (["patients", "appointments", "invoices"].includes(plan.table)) q = q.is("deleted_at", null);

  for (const f of plan.filters ?? []) {
    if (!f || typeof f.col !== "string" || !OPS.has(f.op)) continue;
    if (!t.cols.includes(f.col)) continue;
    /* reserved scoping columns are set by the server — silently ignore model attempts */
    if (["clinic_id", "doctor_id", "deleted_at"].includes(f.col) && !(f.col === "doctor_id" && role !== "doctor")) {
      if (f.col !== "doctor_id") continue;
    }
    /* *_id columns must carry real UUIDs — otherwise teach the model to search by name */
    if (f.col.endsWith("_id") && ["eq", "neq"].includes(f.op) && !UUID_RE.test(String(f.value ?? ""))) {
      throw new Error(`قيمة ${f.col} ليست UUID صالحاً — للبحث بالاسم استعلمي أولاً عن patients بـ ilike على name (النظام يبحث في name وname_ar بكل كلمة على حدة) ثم استخدمي الـ id الناتج، أو استخدمي embed=true`);
    }
    if (f.col.endsWith("_id") && f.op === "in" && Array.isArray(f.value) && !f.value.every((x) => UUID_RE.test(String(x)))) {
      throw new Error(`قيم ${f.col} يجب أن تكون UUIDs صالحة`);
    }
    const v = f.value;
    if (f.op === "eq") q = q.eq(f.col, v as never);
    else if (f.op === "neq") q = q.neq(f.col, v as never);
    else if (f.op === "gt") q = q.gt(f.col, v as never);
    else if (f.op === "gte") q = q.gte(f.col, v as never);
    else if (f.op === "lt") q = q.lt(f.col, v as never);
    else if (f.op === "lte") q = q.lte(f.col, v as never);
    else if (f.op === "in" && Array.isArray(v)) q = q.in(f.col, v as never[]);
    else if (f.op === "is") q = q.is(f.col, v as never);
    else if (f.op === "ilike") {
      const s = String(v ?? "");
      /* A search on a name column is a name search, whichever of the two
         the model happened to pick — it cannot know which one holds this
         patient's Arabic, and it should not have to. */
      if (NAME_COLS.includes(f.col as (typeof NAME_COLS)[number]) && !s.includes("%")) {
        q = byName(q, s, t.cols);
      } else {
        q = q.ilike(f.col, s.includes("%") ? s : `%${s}%`);
      }
    }
  }

  if (plan.order && t.cols.includes(plan.order.col)) {
    q = q.order(plan.order.col, { ascending: !plan.order.desc });
  }
  q = q.limit(agg ? 1000 : Math.min(Math.max(plan.limit ?? 25, 1), 100));

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  /* Names are the clinic's work. Contact lists are an export.
   *
   * "اعطيني أرقام هواتف كل المرضى" returned all of them, which is
   * defensible — the owner sees those on the patients page and RLS keeps
   * them inside their own clinic — but an agent that hands over a whole
   * contact list on a vague request is a different thing from a page
   * that shows them one screen at a time behind an audit trail.
   *
   * So the distinction is drawn where it belongs: a list of patients
   * with what they owe or what treatment stalled stays whole, because
   * that is the job. Phone numbers and emails past the first ten are
   * withheld, with the count kept so nothing is silently lost. */
  const CONTACT = ["phone", "email"];
  const contactCols = CONTACT.filter((c) => (plan.select ?? []).includes(c) || plan.embed);
  if (contactCols.length && rows.length > 10) {
    for (let i = 10; i < rows.length; i++) {
      for (const c of contactCols) if (rows[i][c]) rows[i][c] = "—";
    }
  }

  if (agg) {
    const num = (r: Record<string, unknown>) => Number(r[agg.col ?? ""] ?? 0);
    if (agg.group_by) {
      const groups: Record<string, { count: number; sum: number }> = {};
      for (const r of rows) {
        /* A null foreign key is not a category. Labelling it «غير محدد»
           put a phantom service in the revenue table at 976 ر.ع, ranked
           above four real ones. It is named for what it is. */
        const cell: unknown = r[agg.group_by];
        const k = cell === null || cell === undefined || cell === ""
          ? (agg.group_by.endsWith("_id") ? "__unlinked__" : "غير محدد")
          : String(cell);
        groups[k] = groups[k] ?? { count: 0, sum: 0 };
        groups[k].count++;
        groups[k].sum += agg.col ? num(r) : 0;
      }
      /* Group keys become names.
       *
       * Grouping by service_id returned the uuid as the label, so the
       * answer read "a1000000-0000-0000-0000-000000000005: 803.250 ر.ع"
       * — arithmetic that is correct and useless. The model cannot fix
       * it either, because it never sees the services table in the same
       * turn. One lookup here turns every group into something a person
       * can read. */
      const labels = await resolveIds(sb, agg.group_by, Object.keys(groups), cid);

      const list = Object.entries(groups)
        .map(([key, g]) => ({
          [agg.group_by as string]:
            key === "__unlinked__" ? "(سجلات غير مرتبطة بهذا الحقل)" : labels.get(key) ?? key,
          count: g.count,
          ...(agg.col ? { sum: +g.sum.toFixed(3), avg: +(g.sum / g.count).toFixed(3) } : {}),
        }))
        .sort((a, b) => (agg.col ? Number(b.sum) - Number(a.sum) : Number(b.count) - Number(a.count)))
        .slice(0, 20);
      return { table: plan.table, aggregate: agg.op, groups: list, scanned_rows: rows.length };
    }
    const total = rows.reduce((s, r) => s + (agg.col ? num(r) : 0), 0);
    return {
      table: plan.table,
      aggregate: agg.op,
      count: rows.length,
      ...(agg.col ? { sum: +total.toFixed(3), avg: rows.length ? +(total / rows.length).toFixed(3) : 0 } : {}),
    };
  }

  return {
    table: plan.table,
    rows: rows.slice(0, 30),
    row_count: rows.length,
    ...(contactCols.length && rows.length > 10
      ? {
          contact_withheld:
            "أرقام التواصل معروضة لأول عشرة فقط. القائمة الكاملة في صفحة المرضى، وهي مسجَّلة في سجلّ الاطّلاع — " +
            "قل ذلك للمستخدم بدل أن تسرد الباقي.",
        }
      : {}),
  };
}

/* uuid → the name a person would use for it.
 *
 * Only the four foreign keys anyone groups by. Anything else is returned
 * unchanged, so an unknown column costs nothing rather than erroring. */
const ID_SOURCES: Record<string, { table: string; cols: string }> = {
  service_id: { table: "services", cols: "id, name, name_ar" },
  doctor_id: { table: "tawd_staff_users", cols: "id, name, name_ar" },
  patient_id: { table: "patients", cols: "id, name, name_ar" },
  provider_id: { table: "insurance_providers", cols: "id, name, name_ar" },
};

async function resolveIds(
  sb: Awaited<ReturnType<typeof createServiceRoleClient>>,
  column: string,
  keys: string[],
  cid: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const src = ID_SOURCES[column];
  if (!src) return out;

  const ids = keys.filter((k) => UUID_RE.test(k));
  if (ids.length === 0) return out;

  try {
    let q = sb.from(src.table).select(src.cols).in("id", ids);
    if (cid) q = q.eq("clinic_id", cid);
    const { data } = await q;
    for (const r of (data ?? []) as unknown as { id: string; name?: string; name_ar?: string }[]) {
      out.set(r.id, r.name_ar || r.name || r.id);
    }
  } catch {
    /* A label is a nicety; failing to find one must not fail the answer. */
  }
  return out;
}

/* running token counters for platform usage monitoring */
type Usage = { input: number; output: number };

/* An attachment the user dropped into the conversation.

   Gemini reads images and PDFs natively, so a scan of an insurance card,
   a lab report or a competitor's price list can be handed straight to the
   model rather than described. The file never lands in our storage: it
   goes up with the question and is gone when the request ends, which is
   the right default for a photograph of somebody's medical document. */


async function gemini(
  key: string,
  prompt: string,
  json: boolean,
  usage?: Usage,
  files: Attachment[] = [],
  model: string = MODEL,
) {
  const parts: Record<string, unknown>[] = [
    ...files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })),
    { text: prompt },
  ];

  /* A deadline, because a stalled provider is the most likely failure
     and the least visible. */
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEADLINE_MS(model));

  const call = (model: string) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        signal: ac.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: json ? 0.25 : 0.45,
            /* Arabic costs far more tokens than the same text in English,
               and a structured answer costs more again. 1200 truncated
               mid-sentence on anything with sections in it. */
            /* Gemini 2.5 Flash allows far more than this, and the cost
               is per token produced rather than per token allowed — so a
               ceiling this high costs nothing on a short answer and is
               the difference between a document arriving and arriving
               truncated. */
            /* Measured: a long Arabic document completes cleanly at
               16k in text mode and degenerates in JSON mode at any
               budget. Planning turns are short and never approach this. */
            /* Thinking counts against this ceiling, so the JSON budget
               rose with the model. At 4096 a planning turn came back
               empty: the reasoning had spent the allowance and there was
               nothing left to answer with. */
            maxOutputTokens: json ? 8192 : 24576,
            /* Gemini 3 refuses thinkingBudget: 0 outright — "This model
               only works in thinking mode" — so the lever is the level,
               not the switch. Low keeps the reasoning that stopped her
               refusing without paying for an essay nobody reads. */
            thinkingConfig: { thinkingLevel: "low" },
            ...(json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
    );

  let res: Response;
  try {
    res = await call(model);
    /* A provider fault on the preview model is not the clinic's problem
       to see. Retried once on the stable one, with the same body — the
       only thing that changes is which brain answers. */
    if (model !== FALLBACK && (res.status === 429 || res.status >= 500)) {
      console.warn(`[sura/ask] ${model} returned ${res.status} — falling back to ${FALLBACK}`);
      res = await call(FALLBACK);
    }
  } catch (e) {
    throw new SuraError(
      (e as Error)?.name === "AbortError" ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new SuraError("rate_limited");
  if (res.status === 401 || res.status === 403) throw new SuraError("bad_key");
  if (res.status >= 500) throw new SuraError("provider_down");

  const j = await res.json();
  if (usage && j?.usageMetadata) {
    usage.input += Number(j.usageMetadata.promptTokenCount ?? 0);
    usage.output += Number(j.usageMetadata.candidatesTokenCount ?? 0);
  }
  const why = j?.candidates?.[0]?.finishReason;

  /* Every part, not the first.
   *
   * Gemini splits a long response across several parts, and reading
   * parts[0] returned the opening fragment of a JSON object — valid
   * text, invalid JSON, and a "وصل ردّ غير مكتمل" that had nothing to do
   * with the model. Short answers have one part, which is why this
   * survived until she started writing documents. */
  /* Thought parts are not the answer.
     A thinking model can return its reasoning as a part of its own, and
     concatenating that with the reply produces prose wrapped around a
     JSON object — which is precisely the "وصل ردّ غير مكتمل" a clinic
     sees when nothing was actually wrong with the model. */
  const back = j?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(back)
    ? back
        .filter((p: { thought?: boolean }) => p?.thought !== true)
        .map((p: { text?: string }) => p?.text ?? "")
        .join("")
        .trim()
    : undefined;

  /* MAX_TOKENS is fatal even when text came back, and that was the bug
     behind "تعذّر التحليل الآن".

     A truncated response is still a response: the old check only fired
     on an EMPTY candidate, so a half-written JSON object was returned,
     JSON.parse threw a SyntaxError, and the catch at the bottom reported
     it as "unknown" — the one failure kind that tells nobody anything.
     Writing a document made it certain, because a document body inside a
     JSON string is thousands of tokens on its own. */
  if (why === "MAX_TOKENS") throw new SuraError("too_long");
  if (!text) throw new SuraError(why === "SAFETY" ? "refused" : "empty");
  return text;
}

/* ── one turn of a real tool-calling conversation ──────────────────
 *
 * The difference from gemini() above is the whole point of this rewrite.
 * There, the model wrote JSON as prose and the route parsed it; here the
 * API returns functionCall parts that are structured before they leave
 * Google. «وصل ردّ غير مكتمل من النموذج» was JSON.parse failing on text
 * that was very nearly JSON — a failure that has no way to occur now.
 *
 * The persona goes in systemInstruction rather than at the top of the
 * first user message, so it stays out of the transcript the model is
 * reasoning over and does not have to survive being re-sent every round.
 */
export type FnCall = { name: string; args: Record<string, unknown> };

async function geminiTurn(
  key: string,
  system: string,
  contents: unknown[],
  tools: unknown[],
  usage: Usage,
  model: string = MODEL,
): Promise<{ calls: FnCall[]; text: string; parts: unknown[] }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEADLINE_MS(model));

  const call = (m: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
      signal: ac.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools,
        generationConfig: {
          temperature: 0.3,
          /* Thinking is charged against this ceiling, and a long Arabic
             answer costs more than the same text in English. Raised
             because an exhausted budget surfaces as «الجواب أطول من
             المساحة المتاحة» on a question that was not long — and
             tokens are billed as produced, so a high ceiling costs
             nothing on a short reply. */
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    });

  let res: Response;
  try {
    res = await call(model);

    if (model !== FALLBACK && (res.status === 429 || res.status >= 500)) {
      console.warn(`[sura/ask] ${model} returned ${res.status} — falling back to ${FALLBACK}`);
      res = await call(FALLBACK);
    }

    /* One retry on a 400, which is not what a 400 usually deserves.
     *
     * A malformed request stays malformed, so retrying should be
     * pointless — except this one is intermittent. The same question, on
     * the same transcript, failed twice at 17:43 with "Request contains
     * an invalid argument" and then succeeded unchanged minutes later.
     * Whatever the cause, it is not the shape of what we send, and the
     * alternative is showing an error to someone trying the product.
     *
     * The retry is the mitigation; the logging below is still the
     * investigation, and it fires either way. */
    if (res.status === 400) {
      console.warn(`[sura/ask] ${model} returned 400 — retrying once`);
      await new Promise((r) => setTimeout(r, 400));
      res = await call(model);
    }
  } catch (e) {
    throw new SuraError((e as Error)?.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new SuraError("rate_limited");
  if (res.status === 401 || res.status === 403) throw new SuraError("bad_key");
  if (res.status >= 500) throw new SuraError("provider_down");

  const j = await res.json();

  /* Say what the provider said.
   *
   * A 400 fell straight through here into "no candidates", which the
   * clinic saw as «لم يصل ردّ من النموذج» — the one message that tells
   * nobody anything. It cost an hour to find that the request was
   * malformed and Google had said so plainly in the body. */
  if (j?.error) {
    /* The message alone said "Request contains an invalid argument" and
       nothing else, which cost another round of guessing. details names
       the field. */
    const detail = j.error.details ? ` | ${JSON.stringify(j.error.details).slice(0, 400)}` : "";
    /* The transcript's shape, because "invalid argument" is about a
       field and the field is in here somewhere. Roles and part kinds
       only — no patient data goes into an error log. */
    const shape = (contents as { role?: string; parts?: Record<string, unknown>[] }[])
      .map((c) => {
        const kinds = (c.parts ?? []).map((p) =>
          p.functionCall ? "call" : p.functionResponse ? "resp" : p.inlineData ? "file" : p.text ? "text" : "?",
        );
        return `${c.role}:${kinds.join("+") || "EMPTY"}`;
      })
      .join(" | ");
    console.error(`[sura/ask] ${model} rejected:`, j.error.status, j.error.message, detail, shape);
    throw new SuraError(
      res.status === 400 ? "unknown" : "provider_down",
      `${model}: ${j.error.message}${detail} (${shape})`,
    );
  }

  if (j?.usageMetadata) {
    usage.input += Number(j.usageMetadata.promptTokenCount ?? 0);
    usage.output += Number(j.usageMetadata.candidatesTokenCount ?? 0);
  }

  const parts = (j?.candidates?.[0]?.content?.parts ?? []) as {
    text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown> };
  }[];

  const calls: FnCall[] = parts
    .filter((p) => p.functionCall?.name)
    .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));

  /* Thought parts are the model reasoning aloud, not its reply. */
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();

  const finish = j?.candidates?.[0]?.finishReason;
  if (finish === "SAFETY") throw new SuraError("refused");
  if (finish === "MAX_TOKENS") throw new SuraError("too_long");

  /* A turn with neither a call nor an answer is not fatal here.
   *
   * A thinking model can spend a turn thinking and return only that —
   * measured on a two-word follow-up («نقدا كلهم»), where it came back
   * with a thought part and nothing else. Throwing made that the end of
   * the request; the caller can simply ask again without tools, which
   * is what a person would do. The detail rides along so the next case
   * is readable rather than re-derived. */
  if (calls.length === 0 && !text) {
    const kinds = parts.map((p) => (p.functionCall ? "call" : p.thought ? "thought" : p.text ? "text" : "other"));
    console.warn(`[sura/ask] ${model} returned nothing usable — finish=${finish} parts=[${kinds.join(",")}]`);
  }

  /* The parts go back exactly as they arrived.
   *
   * Gemini 3 attaches a thoughtSignature to each functionCall, and the
   * next request must carry it verbatim — «Function call is missing a
   * thought_signature in functionCall parts» was the 400 that made this
   * page fail on «هلا» while the widget, which finishes in one turn and
   * never echoes a model turn back, worked fine.
   *
   * Rebuilding the turn from name and args looked equivalent and threw
   * the signature away. Returning the raw parts keeps whatever the
   * provider put there, including fields not invented yet. */
  return { calls, text, parts };
}

/* parseTurn lived here: a hand-rolled JSON reader with fence recovery,
   preamble stripping and a balanced-brace scanner, all of it built to
   survive a model writing JSON as prose. Declared functions come back
   structured, so there is nothing left to parse and nothing left to
   fail — «وصل ردّ غير مكتمل من النموذج» cannot be produced any more. */

/** Best-effort token accounting into ai_usage_metrics (never blocks the reply). */
async function logUsage(
  sb: Awaited<ReturnType<typeof createServiceRoleClient>>,
  clinicId: string,
  usage: Usage
) {
  if (usage.input + usage.output <= 0) return;
  try {
    await sb.from("ai_usage_metrics").insert({
      clinic_id: clinicId,
      workflow_id: "dashboard-ask",
      /* Was hardcoded, and stayed hardcoded through a model change —
         so the spend report would have attributed Pro tokens to flash
         and quietly understated the bill. */
      model: `${MODEL}+${WRITER}`,
      channel: "web_chat",
      tokens_input: usage.input,
      tokens_output: usage.output,
      tokens_total: usage.input + usage.output,
    });
  } catch { /* observability must never break the product */ }
}

export async function POST(req: Request) {
  const claims = await getUserClaims();
  /* The platform owner has NO clinic_id by design (they're untied from any clinic
     so their dashboard stays isolated) and runs Sura in unscoped cross-clinic
     mode below. Requiring clinic_id here locked them out entirely. */
  const isPlatform = claims ? hasRole(claims, "platform_admin") : false;
  if (!claims || (!claims.clinic_id && !isPlatform)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = (claims.role ?? "clinic_admin") as Role;

  let question = "";
  let history: { role: string; text: string }[] = [];
  let files: Attachment[] = [];
  let convId: string | null = null;
  try {
    const body = await req.json();
    question = String(body?.question ?? "").slice(0, 500).trim();
    convId = typeof body?.conv_id === "string" ? body.conv_id : null;
    /* Two files, four megabytes each. Beyond that the base64 payload
       costs more to move than the answer is worth, and Gemini's inline
       limit is around twenty megabytes for the whole request. */
    if (Array.isArray(body?.files)) {
      files = body.files
        .slice(0, 2)
        .filter((f: { mime?: string; data?: string }) =>
          typeof f?.data === "string" &&
          f.data.length < 5_600_000 &&
          ALLOWED_MIME.has(String(f?.mime)))
        .map((f: { mime: string; data: string; name?: string }) => ({
          mime: f.mime,
          data: f.data,
          name: typeof f.name === "string" ? f.name.slice(0, 120) : undefined,
        }));
    }
    if (Array.isArray(body?.history)) {
      /* Real roles, not display labels.
       *
       * These used to be "المدير" and "سُرى" because history was pasted
       * into a prompt as text. It is a transcript now, and the API reads
       * `role` — so the labels made every prior turn a model turn, the
       * conversation opened with several of those in a row, and Gemini
       * rejected the request. The route reported "لم يصل ردّ من النموذج"
       * because it never looked at the 400 it was handed.
       *
       * Empty turns go too: the console appends a blank assistant
       * message as a placeholder while a reply streams, and a part with
       * an empty string is itself a 400. */
      /* Twenty turns, not six. A working conversation is a long one —
         the owner asks, reads, corrects, asks again — and six meant she
         forgot the beginning of her own thread by the fourth question. */
      history = body.history
        .slice(-20)
        .map((m: { role?: string; text?: string; content?: string }) => ({
          role: m.role === "user" ? "user" : "model",
          text: String(m.text ?? m.content ?? "").trim().slice(0, 600),
        }))
        .filter((m: { text: string }) => m.text.length > 0);

      /* A conversation has to open with the user.
       *
       * The stored thread is replayed on reload, and after a failed turn
       * it can begin with Sura's own message — so the transcript opened
       * on a model turn and Gemini refused the whole request. Same class
       * as the role labels: correct as prose, invalid as a transcript. */
      while (history.length && history[0].role !== "user") history.shift();
    }
  } catch { /* fallthrough */ }
  if (!question) return NextResponse.json({ error: "empty question" }, { status: 400 });

  const sb = await createServiceRoleClient();
  const cid = isPlatform ? "" : claims.clinic_id; // '' = unscoped platform mode

  /* The platform owner's questions are about the platform and are not
     kept as a clinic's conversation. */
  const conv = isPlatform ? null : await ensureConversation(sb, convId, claims.sub, cid, question);
  const fileMeta: StoredFile[] = files.map((f) => ({ name: f.name ?? "ملف", mime: f.mime }));
  if (conv) await saveTurn(sb, conv, cid, { role: "user", content: question, files: fileMeta });

  const reply = async (answer: string, extra: Record<string, unknown> = {}, error?: string) => {
    if (conv) {
      await saveTurn(sb, conv, cid, {
        role: "assistant",
        content: answer,
        doc: (extra.doc as { url: string; label: string } | undefined) ?? null,
        error: error ?? null,
      });
    }
    return NextResponse.json({ answer, ...(conv ? { conv_id: conv } : {}), ...extra });
  };

  const [cfgRes, clinicRes, meRes] = await Promise.all([
    /* The platform key, from the platform table — this used to read whichever
       clinic channel row came back first. */
    platformSecrets(),
    // platform mode has no clinic_id — an empty value against a uuid column errors
    isPlatform
      ? Promise.resolve({ data: null })
      : sb.from("tawd_clinics").select("name, name_ar, clinic_type").eq("id", claims.clinic_id).maybeSingle(),
    sb.from("tawd_staff_users").select("name, name_ar").eq("id", claims.sub).maybeSingle(),
  ]);
  const geminiKey = cfgRes.geminiKey;
  if (!geminiKey) {
    return NextResponse.json({ answer: "إعداد الذكاء الاصطناعي غير مكتمل لهذه العيادة — تواصل مع دعم طود." });
  }
  const clinicName = isPlatform
    ? "منصة طود (كل العيادات)"
    : (clinicRes.data?.name_ar ?? clinicRes.data?.name ?? "العيادة");
  const userName = meRes.data?.name_ar ?? meRes.data?.name ?? "";

  const now = new Date();
  const muscat = new Date(now.getTime() + 4 * 3600_000);
  const muscatDate = muscat.toISOString().split("T")[0];
  const muscatDay = new Intl.DateTimeFormat("ar", { weekday: "long" }).format(now);
  const roleLabel = isPlatform ? `مالك منصة طود ${userName}` :
    role === "doctor" ? `الطبيب ${userName}` :
    role === "receptionist" ? "موظف الاستقبال" :
    role === "accountant" ? "المحاسب" : `مدير العيادة ${userName}`;
  const header =
    (isPlatform
      ? `أنتِ "سُرى"، العقل الذكي لمنصة طود كشركة. تتحدثين مع ${roleLabel}.\n` +
        `مجال عملك هنا هو المنصة نفسها: العيادات المشتركة، اشتراكاتها وأسعارها، فواتير المنصة عليها وما سُدِّد منها، الباقات والصلاحيات، التكاليف، وأخطاء المحرك.\n` +
        `أضيفي clinic_id في select للتمييز بين العيادات، واربطي الاسم من tawd_clinics.\n` +
        `[حدّ لا يُتجاوز] بيانات مرضى العيادات ومحادثاتهم ليست بيانات المنصة. جداول patients و appointments و chat_messages متاحة لك بالعدّ والتجميع فقط — للإجابة عن حجم الاستخدام، لا لعرض اسم مريض أو رقمه أو نص رسالة. إن طُلب منك ذلك فاعتذري بوضوح واشرحي أن الدخول لبيانات عيادة يتم بإذنها من ملف العيادة، وهو مسجَّل.\n`
      : `أنتِ "سُرى"، العقل الذكي لعيادة ${clinicName}. تتحدثين مع ${roleLabel}.\n`) +
    `هوية المتحدث معروفة ومؤكدة تلقائياً من تسجيل دخوله — لا تسأليه أبداً عن اسمه أو معرفه أو هويته.\n` +
    (role === "doctor"
      ? `كل استعلامات جدول appointments تُفلتر تلقائياً على مواعيد هذا الطبيب فقط — "مواعيدي/مرضاي" تعني نتائج الاستعلام مباشرة.\n`
      : "") +
    `تاريخ اليوم في مسقط: ${muscatDate} (${muscatDay}). "غداً" = اليوم التالي لهذا التاريخ. الأوقات في قاعدة البيانات UTC (مسقط = UTC+4).\n` +
    `نتيجة استعلام فارغة [] تعني ببساطة: لا بيانات مطابقة — أجيبي بذلك بثقة (مثال: "لا مواعيد غداً"). لا تفترضي أبداً وجود مشكلة في الهوية أو خطأ تقني.\n` +
    `العملة: ريال عُماني بثلاث منازل عشرية.\n\n` +
    (isPlatform ? "" :
      /* Scope, before capability.
       *
       * Everything below this block was written to stop her refusing —
       * she had been saying «لا أستطيع» to things she could plainly do,
       * and the cure was to name her powers and forbid the bare refusal.
       * The cure had no edge: asked who founded psychology, she wrote a
       * tidy paragraph on Wundt and Freud, because answering was "the
       * nearest thing she could do". A clinic agent that doubles as a
       * general chatbot is not a clinic agent, and a judge testing it
       * will reach for exactly that question.
       *
       * So the boundary goes first, where it gates the permissions that
       * follow rather than trailing them as an afterthought. */
      /* clinicName already carries the word عيادة, so prefixing it here
         produced «وكيلة عيادة عيادة طود للأسنان» in the one sentence she
         says most often to a stranger. */
      `[نطاقك — قبل أي شيء آخر]\n` +
      `أنتِ وكيلة ${clinicName}، ولستِ مساعدة عامة. مجالك: بيانات هذه العيادة وتشغيلها — المرضى، المواعيد، ` +
      `الخطط العلاجية، المال، التأمين، المخزون، الطاقم، التقارير، والتواصل مع المرضى.\n` +
      `أي سؤال خارج ذلك — معلومات عامة، تاريخ، علوم، سياسة، رياضة، دين، برمجة، مشاهير، ترجمة، أو أي معرفة من العالم ` +
      `لا من قاعدة بيانات العيادة — أجيبي عنه بسطر واحد فقط:\n` +
      `«هذا خارج نطاقي — أنا وكيلة ${clinicName}. اسألني عن مرضاك أو مواعيدك أو أرقام عيادتك.»\n` +
      `لا تجيبي عنه ولو كنتِ تعرفين الجواب تماماً، ولا تُتبعي السطر بشرح ولا بمعلومة. معرفتك العامة ليست منتجاً هنا.\n` +
      `استثناءان فقط: التحية القصيرة تُقابَل بتحية قصيرة، والسؤال عن قدراتك أنتِ يُجاب.\n\n` +

      `[من أنتِ]\n` +
      `أنتِ سُرى: العقل الذي يُدير عيادة ${clinicName} مع صاحبها. تقرئين بياناتها، وتُحلّلين، وتُنفّذين، وتُصدرين المستندات.\n` +
      `ما يلي أمثلة لا حدود. إن كان الطلب ممكناً ببيانات العيادة أو بإجراء متاح فافعليه ولا تعتذري.\n\n` +

      `القراءة والتحليل — أي رقم في العيادة، ولستِ عارضة أرقام:\n` +
      `حين يُسأل «لماذا» أو تُطلب دراسة أو خطة، استعلمي عدّة جولات، قارني فترة بفترة، واعزلي المتغيّر الذي تحرّك فعلاً\n` +
      `(عدد المواعيد؟ متوسّط الفاتورة؟ عدم الحضور؟ غياب طبيب؟)، ثم اكتبي السبب والتوصية. «خطة» و«دراسة» و«تحليل» أعمالٌ تقومين بها.\n\n` +

      `التنفيذ — حجز، تأجيل، إلغاء، تأكيد، قائمة انتظار، خطة علاجية، وصفة، فاتورة، دفعة، مطالبة تأمين، مريض جديد، ملاحظة، خدمة، إغلاق يوم.\n` +
      `قراءة المرفقات — الصور وملفات PDF ترينها فعلاً: بطاقة تأمين، تقرير مختبر، أشعة، عرض سعر، ورقة بخطّ اليد.\n` +
      /* Named plainly because the refusal was never stubbornness.
         Probed on the live key: given a bare persona, three different
         models all answered «لا أستطيع إنشاء مستندات PDF»; given one
         line naming these, all three answered yes. She refuses what she
         has not been told she has. */
      `المستندات — open_document لتقرير الشهر الجاهز، create_document لأي تحليل أو خطة تكتبينها أنتِ.\n` +
      `  المستند يخرج صفحةً مصمَّمة جاهزة للطباعة و PDF — نعم تستطيعين إنشاء PDF، ولا تقولي غير ذلك.\n` +
      `الرسوم والصور — ترسمين مخطّطات من أرقام العيادة داخل المستند (كتلة chart)، وتولّدين صوراً فعلية بـ generate_image.\n` +
      `  فلا تقولي «لا أستطيع إنشاء صور أو رسوم» — تستطيعين، وهذا جزء من عملك.\n` +
      `العمل وحدك — كل عشر دقائق تبحثين عن كرسي فرغ وخطة توقّفت، وتتصرّفين. كل قرار مسجَّل بسببه.\n\n` +

      `[ثلاث قواعد لا تُكسَر]\n` +
      `١. كل رقم من استعلام. لا تقديرات ولا نِسَب مفترضة. ما لا يحتفظ به النظام (مثل سبب عدم الحضور) قوليه صراحةً ولا تخمّنيه.\n` +
      `٢. لا وعود. لا «سأقوم» ولا «سيتم» ولا «سنحلّل». نفّذي الآن واذكري النتيجة، أو اكتبي «جاهز — قل نعم وأنفّذه». ولا تدّعي تنفيذ ما لم يُنفَّذ.\n` +
      `٣. لا تسألي عمّا تستطيعين استعلامه. اسألي فقط عن قرار أو تفضيل أو ميزانية.\n\n` +

      `ممنوعان: التشخيص ووصف الدواء والرأي الطبي؛ واختراع رقم أو سعر.\n` +
      `وفي غيرهما — وضمن نطاق العيادة وحده — لا ترفضي رفضاً مجرّداً ولا تبدئي بـ«لا أستطيع»، ` +
      `بل سلّمي أقرب شيء تستطيعينه في نفس الردّ. أمّا خارج النطاق فالسطر الواحد أعلاه، ولا شيء بعده.\n\n`) +
    /* The tables she may read. The query-plan format and the action
       catalogue that used to follow this were a hundred lines telling
       the model how to hand-write JSON — replaced by the declarations
       in lib/sura/tools, which Google enforces instead of asking. */
    `الجداول المتاحة لك عبر query_clinic:
${catalogFor(role)}

` +
    `- ضمّني id دائماً في select. لا تضيفي فلاتر clinic_id أو deleted_at — تُضاف تلقائياً.
` +
    `- أعمدة *_id تقبل UUID من نتيجة استعلام سابق فقط.
` +
    `- التواريخ بصيغة ISO مثل "2026-08-04".

` +
    `نفّذي بالأدوات مباشرة. لا تصفي ما ستفعلينه ولا تستأذني فيما طُلب منك صراحةً.`;

  /* Everything from here is one attempt. The catch at the bottom names
     the failure so the interface can offer the right recovery. */
  /* Checked before the first model call, not after — a cap that only
     notices once the money is gone is a report, not a cap. */
  if (cid) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: spend } = await sb
      .from("ai_usage_metrics")
      .select("tokens_total")
      .eq("clinic_id", cid)
      .gte("recorded_at", since);

    const used = (spend ?? []).reduce((s, r) => s + Number(r.tokens_total || 0), 0);
    if (used >= DAILY_TOKEN_CEILING) {
      console.warn(`[sura/ask] clinic ${cid} hit the daily ceiling: ${used}`);
      return NextResponse.json({
        answer:
          "بلغت العيادة سقف الاستخدام اليومي للذكاء الاصطناعي. يُعاد ضبط السقف تلقائياً خلال ٢٤ ساعة، " +
          "أو تواصل مع دعم طَود لرفعه.",
        failure: "rate_limited",
        retryable: false,
      });
    }
  }

  try {
    const modelKey: string = geminiKey;
    const actorId: string = claims.sub;

    /* Everything read or written this request. The model sees its own
       tool results through the transcript; this is the copy the document
       writer reads, since that call cannot use tools. */
    const context: unknown[] = [];

    /* She sees the screen.
     *
     * The bell said «١٦ فاتورة متأخرة تحتاج متابعة». Asked to deal with
     * it, she queried sura_alerts — emergencies and complaints, and
     * genuinely empty — and answered that there were no alerts at all.
     * The number on the screen was computed in a route she had no way to
     * reach. Now every turn starts with exactly what the bell shows. */
    let bellNote = "";
    try {
      const bell = await notificationsFor(claims);
      if (bell.length) {
        context.push({ screen_notifications: bell });
        /* Into the system instruction, not into context.
         *
         * context is what the document writer reads; the model reads the
         * transcript. Pushing the bell into context meant she still
         * answered «لا توجد أي تنبيهات» to a screen showing sixteen —
         * the same bug as before, moved one layer down. */
        bellNote =
          `\n\n[التنبيهات المعروضة للمستخدم على شاشته الآن]\n` +
          bell.map((n) => `- ${n.title}${n.sub ? ` (${n.sub})` : ""}`).join("\n") +
          `\nإن سأل عن التنبيهات أو الإشعارات فهذه هي — لا تقولي إنها فارغة ولا تبحثي في sura_alerts وحده، ` +
          `فأكثرها محسوب من الفواتير والمواعيد لا من جدول تنبيهات.`;
      }
    } catch (e) {
      console.error("[sura/ask] notifications failed:", e instanceof Error ? e.message : e);
    }

    /* The attachment is in this message, not described by it.
     *
     * The earlier wording named the file and told her to read it, which
     * is exactly what a model does when the bytes are missing: it reads
     * the name. Handed «بطاقة-تأمين.png» and nothing else, she reported
     * an insurer, a policy number, a tier and a ceiling — all invented,
     * and a different set on each round. */
    const fileNote = files.length
      ? `\n[مرفقات]\nمرفق مع هذه الرسالة ${files.length} ملفاً (${files.map((f) => f.name ?? f.mime).join("، ")}) — الملف نفسه أمامك في هذه الرسالة.\n` +
        `اقرئي منه ما تبصرينه فعلاً. لا تذكري اسم شركة ولا رقماً ولا تاريخاً إلا إن قرأتِه في الصورة حرفاً حرفاً؛ ` +
        `وما لم يتّضح قولي إنه غير مقروء واطلبي صورة أوضح. اسم الملف ليس مصدراً.\n` +
        `إن كانت وثيقة مريض فلخّصي المهمّ منها ولا تنسخيها كاملة.\n`
      : "";
    const persona = header + fileNote + bellNote;
    let pushedBack = false;
    let offTopicChecked = false;

    /* One request, one write of any given thing.
     *
     * Asked once to file an insurance card, she wrote two clinical notes
     * two seconds apart — the loop ran a second round and she repeated
     * herself, so the patient's file carried the same event twice. The
     * round budget is there to let her gather more, not to let her act
     * again, and no clinic wants a duplicate on a medical record. */
    const written = new Set<string>();

    /* Asked for a document, she wrote the analysis into the chat and
       closed with «المستند جاهز للإصدار، هل ترغب في أن أقوم بإنشائه
       الآن؟» — permission to do the thing she had just been told to do,
       in a phrasing no blacklist held. So it stops being a phrasing
       problem: if the request names a document, an answer without one
       is not an acceptable end to the turn. */
    const wantsDoc = /مستند|تقرير|وثيقة|دراسة|ملف\s|PDF|pdf/.test(question);
    const wantsPicture = /صورة|صور\b|غلاف|شعار|ملصق|تصميم/.test(question);
    let docForced = false;
    const madePicture = () =>
      context.some((c) => {
        const r = (c as { action_result?: { action?: string; done?: boolean } })?.action_result;
        return r?.action === "generate_image" && r?.done === true;
      });

    /* Pro thinks, and thinking is wall-clock. A request that gathers,
       writes a body and renders can approach the platform's ceiling, and
       hitting it loses everything already paid for. */
    const started = Date.now();
    /* Starting a document costs a cover and a Pro write — measured near
       two minutes together — so the point of no return is earlier than
       the point at which an answer must be forced. */
    const nearLimit = () => Date.now() - started > 150_000;
    /* Anything the answer should render as more than text. Kept as a
       field rather than a URL inside the prose, so the interface can
       show a button and she never has to describe one. */
    let doc: { url: string; label: string } | null = null;
    const usage: Usage = { input: 0, output: 0 };

    /* ── the conversation, as the API models it ───────────────────
     *
     * Not a prompt that grows a "results so far" blob each round. A real
     * transcript: what the user asked, what the model called, what those
     * calls returned. The model sees its own history the way it was
     * trained to, and nothing has to be re-serialised into a string. */
    const contents: Record<string, unknown>[] = [];

    for (const h of history.slice(-20)) {
      contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
    }
    contents.push({
      role: "user",
      parts: [
        ...files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })),
        { text: question },
      ],
    });

    const tools = [{ functionDeclarations: toolsFor(role) }];

    /* Executes one call through exactly the audited paths the old
       protocol used — runPlan for reading, runAction for writing. The
       transport changed; the guardrails did not. */
    /* Every call written down, argument and result, whether it worked or
       not. The autonomous loop has logged its decisions since it was
       built; the conversation had no equivalent, so "she said she queued
       fourteen patients and no goal exists" was unanswerable. */
    const audit = async (tool: string, args: unknown, result: Record<string, unknown>, ms: number) => {
      try {
        await sb.from("sura_tool_calls").insert({
          clinic_id: cid || null,
          user_id: actorId,
          conv_id: conv,
          tool,
          args: args as Record<string, unknown>,
          result: JSON.parse(JSON.stringify(result ?? {})),
          ok: result?.done !== false && !result?.error,
          ms,
        });
      } catch { /* an audit that breaks the reply is worse than none */ }
    };

    const execute = async (c: FnCall): Promise<Record<string, unknown>> => {
      const t0 = Date.now();
      const out = await runTool(c);
      await audit(c.name, c.args, out, Date.now() - t0);
      return out;
    };

    const runTool = async (c: FnCall): Promise<Record<string, unknown>> => {
      if (c.name === "query_clinic") {
        try {
          const out = await runPlan(sb, c.args as unknown as Plan, cid, role, claims.sub);
          context.push(out);
          return out as unknown as Record<string, unknown>;
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return { error, hint: "صحّحي الاستعلام وأعيدي النداء" };
        }
      }

      if (c.name === "clinic_brief") {
        const { data, error } = await sb.rpc("sura_clinic_brief", { p_clinic: cid });
        if (error) return { error: error.message };
        context.push({ clinic_brief: data });
        return { brief: data };
      }

      /* One write per subject per request. Asked once to file an
         insurance card, she wrote two clinical notes two seconds apart;
         the second was worded differently and would have passed any
         exact-text comparison, so this keys on the action and whom it
         touches. Documents are exempt — asking for two is legitimate. */
      const target = String(c.args.patient_id ?? c.args.appointment_id ?? c.args.invoice_id ?? "");
      const key = `${c.name}:${target}`;
      if (c.name !== "create_document" && target && written.has(key)) {
        return { done: false, error: "نُفِّذ هذا الإجراء لهذا الشخص في هذا الطلب — لا تكرّريه." };
      }
      if (target) written.add(key);

      if (c.name === "create_document") {
        const body = await documentBody(String(c.args.brief ?? question));
        const res = await runAction(
          sb,
          { type: "create_document", title: String(c.args.title ?? "مستند"), body_md: body, prompt: question } as Action,
          cid, role, actorId, context,
        );
        const d = (res as { document?: { url: string; label: string } }).document;
        if (d?.url) doc = d;
        context.push({ action_result: res });
        return res as unknown as Record<string, unknown>;
      }

      try {
        const res = await runAction(sb, { type: c.name, ...c.args } as unknown as Action, cid, role, claims.sub, context);
        const d = (res as { document?: { url: string; label: string } }).document;
        if (d?.url) doc = d;
        context.push({ action_result: res });
        return res as unknown as Record<string, unknown>;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error("[sura/ask] tool failed:", c.name, error);
        return { done: false, error };
      }
    };

    /* Writing the body is its own call, on the strong model, in plain
       text — a document inside a structured field is thousands of tokens
       of escaping, and it degenerated every time. The sweep and the
       cover run first because the writer cannot call tools. */
    async function documentBody(brief: string): Promise<string> {
      const { data: sweep } = await sb.rpc("sura_clinic_brief", { p_clinic: cid });
      if (sweep) context.push({ clinic_brief: sweep });

      if (wantsPicture && !madePicture() && Date.now() - started < 120_000) {
        try {
          const cover = await runAction(
            sb,
            {
              type: "generate_image",
              prompt:
                "A calm, professional cover illustration for a dental clinic performance report. " +
                "Minimal flat vector style, soft blue and white, abstract geometric shapes suggesting " +
                "growth and care. No text, no words, no letters, no numbers anywhere in the image.",
              purpose: "غلاف التقرير",
              aspect: "landscape",
            } as unknown as Action,
            cid, role, actorId, context,
          );
          context.push({ action_result: cover });
        } catch (e) {
          console.error("[sura/ask] cover failed:", e instanceof Error ? e.message : e);
        }
      }

      return gemini(
        modelKey,
        `أنتِ سُرى، تكتبين مستنداً لعيادة ${clinicName}.\n\n` +
          `[المطلوب]\n${brief}\n\n` +
          `[البيانات التي قرأتِها — لا تستخدمي رقماً خارجها]\n${JSON.stringify(context).slice(0, 18000)}\n\n` +
          `البيانات أعلاه كاملة وكافية. لا تقولي إنها لا تكفي ولا تطلبي غيرها — اكتبي من الموجود، ` +
          `وإن غاب محور بعينه اذكري غيابه في سطر واحد وواصلي.\n` +
          `اكتبي المستند الآن بصيغة Markdown مباشرة، بلا JSON وبلا أي غلاف وبلا مقدّمة عن نفسك.\n` +
          `- عناوين بـ ## ، والأرقام في جداول Markdown.\n` +
          `- كل قسم: الرقم الذي وُجد، ثم معناه، ثم التوصية.\n` +
          `- ممنوع «سنقوم» و«سيتم» و«سأقوم» وممنوع «نحتاج بيانات» — استخدمي ما هو أمامك.\n` +
          `- ما لا يحتفظ به النظام (مثل سبب عدم الحضور) قوليه صراحةً ولا تخمّني نسبة.\n` +
          "- ارسمي مخطّطاً لكل قسم فيه ثلاثة أرقام قابلة للمقارنة أو أكثر — ثلاثة مخطّطات على الأقل:\n" +
          "  سطر ```chart ثم type: bar، وعنوان، وسطر لكل بند «الاسم | الرقم»، ثم سطر ```\n" +
          `  مرشّحات: الإيراد لكل خدمة، عدم الحضور بأيام الأسبوع وبالساعة وبالطبيب، المفوتَر مقابل المحصّل.\n` +
          `- الصور: لا تكتبي سطر ![...](...) إلا برابط موجود حرفياً في البيانات أعلاه ناتجاً عن generate_image.\n` +
          `- اختمي بقسم «الخطوات التالية» يفصل ما نُفّذ عمّا ينتظر الموافقة.\n` +
          `- ألف إلى ألفي كلمة. لا تكرّري.`,
        false, usage, files, WRITER,
      );
    }

    /* ── the loop ─────────────────────────────────────────────────
     *
     * Eight rounds rather than five, and no cap on calls per round,
     * because a request naming six jobs is now arithmetically possible:
     * the model issues several calls at once and gets several results
     * back. Measured on this key, Pro asks for two in a single turn. */
    let answer = "";
    /* Bounded by the clock, not by a number I picked.
     *
     * Eight rounds was arbitrary, and a request large enough to need a
     * ninth got «لم أصل إلى نتيجة» — a surrender written while a full
     * transcript of results sat in memory. A planning turn costs about
     * three seconds, so twenty of them still finish inside the time
     * budget, and the time budget is the honest limit. */
    for (let round = 0; round < 20; round++) {
      let turn = await geminiTurn(geminiKey, persona, contents, tools, usage);

      /* Spent the turn thinking and said nothing. Ask again for words
         only — no tools to reach for, so there is nothing to do but
         answer. One retry; if it is still silent, that is a real
         failure and gets named. */
      if (turn.calls.length === 0 && !turn.text) {
        contents.push({ role: "user", parts: [{ text: "أجيبي الآن بالعربية من المعطيات التي بين يديك." }] });
        turn = await geminiTurn(geminiKey, persona, contents, [], usage);
        if (!turn.text) throw new SuraError("empty");
      }

      if (turn.calls.length === 0) {
        answer = turn.text;

        /* Answered the world instead of the clinic.
         *
         * World knowledge needs no tools, and a clinic question almost
         * always touches one — so an essay produced on the first turn
         * without a single query is the shape of an off-domain answer.
         * The prompt already forbids this; the prompt also forbade the
         * bare refusal and the invented insurance card, and both came
         * back. A rule that matters gets a check.
         *
         * This asks her to look again rather than forcing a refusal, so
         * a legitimate long answer about her own capabilities survives
         * it. One extra call, only on the suspicious shape. */
        if (round === 0 && !offTopicChecked && answer.length > 400) {
          offTopicChecked = true;
          contents.push({ role: "model", parts: [{ text: answer }] });
          contents.push({
            role: "user",
            parts: [{
              text:
                "قبل أن يصل ردّك: هل هذا السؤال عن هذه العيادة وبياناتها وتشغيلها، أم معرفة عامة من العالم؟ " +
                "إن كان معرفةً عامة فاحذفي ما كتبتِ وأجيبي بالسطر الواحد المحدَّد في نطاقك، بلا شرح ولا معلومة. " +
                "وإن كان عن العيادة أو عن قدراتك فأعيدي جوابك كما هو.",
            }],
          });
          const scoped = await geminiTurn(geminiKey, persona, contents, [], usage);
          if (scoped.text) answer = scoped.text;
        }

        /* Two things an answer may not be. Both were measured, both were
           reworded around every list I wrote, so they are enforced on the
           turn rather than requested in the prompt. */
        if (!pushedBack && (deferring(answer) || refusing(answer))) {
          pushedBack = true;
          const { data: brief } = await sb.rpc("sura_clinic_brief", { p_clinic: cid });
          contents.push({ role: "model", parts: [{ text: answer }] });
          contents.push({
            role: "user",
            parts: [{
              text:
                "هذا ليس جواباً. المسح الكامل لبيانات العيادة: " + JSON.stringify(brief).slice(0, 8000) +
                "\nاكتبي من هذه الأرقام الآن. وأنتِ ترسمين مخطّطات وتُخرجين مستنداً جاهزاً للطباعة و PDF " +
                "وتولّدين صوراً — فلا تقولي إنك لا تستطيعين. ولا تنقلي للمستخدم سبب رفضٍ داخلي.",
            }],
          });
          continue;
        }

        /* The request named a document and none exists. The gathering is
           already done, so this costs a call rather than the work. */
        if (wantsDoc && !doc && !docForced && !nearLimit()) {
          docForced = true;
          const heading = /^\s*#{1,4}\s*(.+)$/m.exec(answer)?.[1]?.trim();
          const res = await execute({
            name: "create_document",
            args: { title: (heading || `تقرير: ${question.slice(0, 60)}`).slice(0, 200), brief: question },
          });
          /* Told as prose, not forged as a tool turn. A functionCall the
             model never made has no thought signature to carry, and the
             next request is rejected for the missing one. */
          contents.push({ role: "model", parts: [{ text: answer }] });
          contents.push({
            role: "user",
            parts: [{ text: `أنشأتُ المستند نيابةً عنك: ${JSON.stringify(res).slice(0, 600)}\nاذكري في سطرين ما فيه من أرقام.` }],
          });
          continue;
        }

        break;
      }

      /* The model's turn verbatim, then the results — this is what lets
         it reason over its own tool use, and what carries the thought
         signature the next request is rejected without. */
      contents.push({ role: "model", parts: turn.parts });

      const responses = [];
      for (const c of turn.calls.slice(0, 10)) {
        responses.push({ functionResponse: { name: c.name, response: await execute(c) } });
      }
      contents.push({ role: "user", parts: responses });

      if (nearLimit()) break;
    }

    /* A request always ends in an answer.
     *
     * Whatever stopped the loop — the clock, the round ceiling, a model
     * that kept reaching for one more tool — the work is already done
     * and sitting in the transcript. Returning "قسّمه لجزأين" or "لم
     * أصل إلى نتيجة" threw all of it away and asked the owner to type
     * the request again, which is the single most infuriating thing a
     * system can do with work it has already paid for.
     *
     * No tools on this call, so there is nothing to reach for. */
    if (!answer) {
      contents.push({
        role: "user",
        parts: [{
          text:
            "توقّفي عن الاستعلام وأجيبي الآن من كل ما جمعتِه أعلاه. " +
            "غطّي كل جزء طلبه المستخدم بعنوان مستقلّ، واذكري صراحةً أي جزء لم تكتمل بياناته وما ينقصه — " +
            "ولا تطلبي منه إعادة صياغة طلبه.",
        }],
      });
      try {
        const last = await geminiTurn(geminiKey, persona, contents, [], usage);
        answer = last.text;
      } catch (e) {
        console.error("[sura/ask] final answer failed:", e instanceof Error ? e.message : e);
      }
    }

    await logUsage(sb, cid, usage);
    return reply(
      answer || "نفّذتُ ما طلبت، ولم أصل إلى صياغة نهائية. اسألني «وش سويتِ؟» وسأسرد ما تمّ.",
      doc ? { doc } : {},
    );

  } catch (e) {
    const kind: SuraFailure = e instanceof SuraError ? e.kind : "unknown";
    console.error("[sura/ask]", kind, e instanceof Error ? e.message : e);

    /* Written down, not just printed. Vercel's log is unreachable from
       the clinic and from anyone debugging on their behalf, so a failure
       that says «تعذّر التحليل الآن» on screen leaves no trace anywhere
       it can be read. */
    try {
      await sb.from("tawd_error_logs").insert({
        workflow_id: "sura-ask",
        clinic_id: claims.clinic_id || null,
        error_message: `${kind}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 2000),
        /* severity_level is low|medium|high|critical — "error" is not a
           member, so every insert here failed silently and the log I
           added to stop guessing was itself unreadable. */
        severity: "high",
        context: { question: question.slice(0, 200), role },
      });
    } catch { /* never fail the reply because logging failed */ }

    /* A named failure, so the interface can offer the right thing —
       retry now, wait a minute, or tell the owner the key is dead. */
    return reply(FAILURE_AR[kind], { failure: kind, retryable: kind !== "bad_key" }, kind);
  }
}
