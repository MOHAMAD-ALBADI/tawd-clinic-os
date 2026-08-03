import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";
import { hasRole } from "@/lib/auth/role-redirect";
import { runAction, type Action } from "@/lib/sura/actions";
import { deferring, refusing } from "@/lib/sura/doc-guard";
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
};

/* embedded relations allowed per table (names resolved server-side) */
const EMBEDS: Record<string, string> = {
  appointments: "patients!patient_id(name,phone), services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar,name)",
  invoices: "patients!patient_id(name,phone)",
  invoice_items: "services!service_id(name_ar)",
  appointment_waitlist: "patients!patient_id(name,phone), services!service_id(name_ar)",
  chat_sessions: "patients!patient_id(name,phone)",
  no_show_log: "patients!patient_id(name,phone)",
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
const MODEL = "gemini-3.1-pro-preview";

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
  constructor(public kind: SuraFailure) { super(kind); }
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

  return { table: plan.table, rows: rows.slice(0, 30), row_count: rows.length };
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
) {
  const parts: Record<string, unknown>[] = [
    ...files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })),
    { text: prompt },
  ];

  /* A deadline, because a stalled provider is the most likely failure
     and the least visible. Twenty-eight seconds leaves room for a
     second round inside the platform's limit. */
  const ac = new AbortController();
  /* Pro thinks before it answers and that time is real. Five rounds at
     fifty seconds still fits inside maxDuration = 300. */
  const timer = setTimeout(() => ac.abort(), 50_000);

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
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
  const back = j?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(back)
    ? back.map((p: { text?: string }) => p?.text ?? "").join("").trim()
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

/* Parses a model turn.
 *
 * JSON mode is a strong guarantee, not an absolute one — a model asked
 * for JSON still occasionally wraps it in a markdown fence, or prefixes
 * a sentence. Both are trivially recoverable and neither is worth
 * showing a clinic an error for, so they are recovered here and only a
 * genuinely unparseable turn is named as a failure. */
function parseTurn(raw: string): Record<string, unknown> {
  const attempt = (s: string) => {
    const v = JSON.parse(s);
    if (v && typeof v === "object") return v as Record<string, unknown>;
    throw new Error("not an object");
  };

  try {
    return attempt(raw);
  } catch { /* try the recoveries below */ }

  /* ```json … ``` */
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (fenced) {
    try { return attempt(fenced[1].trim()); } catch { /* keep going */ }
  }

  /* A prose preamble before the object. */
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return attempt(raw.slice(first, last + 1)); } catch { /* out of ideas */ }
  }

  throw new SuraError("bad_json");
}

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
      model: "gemini-2.5-flash",
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
      history = body.history.slice(-6).map((m: { role?: string; text?: string; content?: string }) => ({
        role: m.role === "user" ? "المدير" : "سُرى",
        text: String(m.text ?? m.content ?? "").slice(0, 300),
      }));
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
      `وفي غيرهما لا ترفضي رفضاً مجرّداً ولا تبدئي بـ«لا أستطيع» — سلّمي أقرب شيء تستطيعينه في نفس الردّ.\n\n`) +
    `لديك وصول كامل لقاعدة بيانات العيادة عبر خطط استعلام JSON. الجداول المتاحة:\n${catalogFor(role)}\n\n` +
    `صيغة خطة الاستعلام:\n` +
    `{"queries":[{"table":"...","select":["col",...],"embed":true|false,"filters":[{"col":"...","op":"eq|neq|gt|gte|lt|lte|ilike|in|is","value":...}],"order":{"col":"...","desc":true},"limit":25,"aggregate":{"op":"sum|count|avg","col":"...","group_by":"..."}}]}\n` +
    `- استخدمي aggregate للمجاميع/العدّ/المتوسط (group_by للتجميع مثل أكثر خدمة/طبيب).\n` +
    `- embed=true يجلب اسم المريض/الخدمة/الطبيب مع الصف.\n` +
    `- للبحث باسم شخص: ilike على name (بدون %). النظام يطابق كل كلمة على حدة في name وname_ar معاً ويتجاوز «بن/بنت» واختلاف الهمزة — فاكتبي الاسم كما نطقه المستخدم ولا تجرّبي الأعمدة واحداً واحداً.\n` +
    `- لا تضيفي أبداً فلاتر clinic_id أو doctor_id أو deleted_at — تُضاف تلقائياً من النظام.\n` +
    `- أعمدة *_id تقبل UUID حقيقياً فقط (من نتيجة استعلام سابق) — للبحث بالاسم استخدمي ilike على name.\n` +
    `- فلاتر التاريخ/الوقت على slot_time أو created_at بصيغة ISO مثل "2026-07-04T00:00:00+04:00" أو "2026-07-04".\n` +
    `- بحد أقصى 3 استعلامات بالجولة، وضمّني "id" في select دائماً.\n\n` +
    /* The platform owner writes nothing into a clinic from here. Cancelling a
       patient's appointment is the clinic's act; the operator's route into that
       is the support-approval flow on the clinic file, which is logged. */
    (role === "accountant" || isPlatform
      ? ""
      : `[الإجراءات التي تستطيعين تنفيذها — عند طلب المستخدم الصريح فقط]\n` +
        `{"action":{"type":"book_appointment","patient_id":"<uuid>","service_id":"<uuid>","doctor_id":"<uuid>|any","date":"YYYY-MM-DD","time":"HH:MM"}} — حجز موعد حقيقي\n` +
        `{"action":{"type":"reschedule_appointment","appointment_id":"<uuid>","date":"YYYY-MM-DD","time":"HH:MM"}} — تغيير موعد\n` +
        `{"action":{"type":"cancel_appointment","appointment_id":"<uuid>","reason":"اختياري"}} — إلغاء موعد\n` +
        `{"action":{"type":"confirm_appointment","appointment_id":"<uuid>"}} — تأكيد موعد مجدول\n` +
        (role === "doctor" ? "" :
        `{"action":{"type":"add_to_waitlist","patient_id":"<uuid>","service_id":"<uuid>","from_date":"YYYY-MM-DD","to_date":"YYYY-MM-DD"}} — إضافة لقائمة الانتظار (يُعرض عليه أي إلغاء تلقائياً)\n` +
        `{"action":{"type":"message_patient","patient_id":"<uuid>","text":"نص الرسالة"}} — إرسال رسالة واتساب\n`) +
        `{"action":{"type":"open_document","kind":"monthly_report","month":"YYYY-MM-01 اختياري"}} — إصدار تقرير الشهر جاهزاً للطباعة أو الحفظ PDF\n` +
        `{"action":{"type":"create_document","title":"عنوان المستند","brief":"وصف دقيق لما يُكتب فيه، بالأقسام المطلوبة"}} — مستند تكتبينه أنتِ: تحليل، خطة، دراسة. لا تكتبي محتواه هنا — اكتبي العنوان والوصف فقط، والمحتوى يُكتب في خطوة تالية\n` +

        /* The clinic's day. These were advertised, then silently lost
           when a later edit spliced a neighbouring section out — nine
           actions that existed in the executor and were unreachable
           because nothing told her they were there. */
        `{"action":{"type":"create_patient","name":"الاسم","phone":"+968…","gender":"male|female"}} — تسجيل مريض جديد\n` +
        `{"action":{"type":"invoice_appointment","appointment_id":"<uuid>","discount":0}} — إصدار فاتورة لموعد بضريبة ٥٪\n` +
        `{"action":{"type":"record_payment","invoice_id":"<uuid>","amount":0,"method":"cash|card|bank_transfer|thawani|insurance"}} — تسجيل دفعة\n` +
        `{"action":{"type":"submit_insurance_claim","invoice_id":"<uuid>","provider_id":"<uuid>"}} — رفع مطالبة تأمين\n` +
        `{"action":{"type":"write_prescription","patient_id":"<uuid>","diagnosis":"اختياري","items":[{"drug":"اسم الدواء","dosage":"","frequency":"","duration":""}]}} — مسوّدة وصفة طبية\n` +
        `{"action":{"type":"add_clinical_note","patient_id":"<uuid>","note":"النص"}} — ملاحظة في ملف المريض\n` +
        `{"action":{"type":"complete_plan_item","item_id":"<uuid>"}} — إنجاز بند من خطة علاجية\n` +
        `{"action":{"type":"block_doctor_day","doctor_id":"<uuid>","date":"YYYY-MM-DD","reason":"إجازة"}} — إغلاق يوم طبيب\n` +
        `{"action":{"type":"add_service","name":"الاسم","price":0,"duration_minutes":30}} — إضافة خدمة للقائمة\n` +

        /* The bridge to the autonomous half. */
        `{"action":{"type":"queue_recovery","patient_ids":["<uuid>"],"note":"سبب المتابعة"}} — تسليم مرضى منقطعين لسُرى الذاتية فتتواصل معهم بنفسها خلال عشر دقائق\n` +
        `  استخدميه بدل أن توصي بالتواصل. «أوصي بالتواصل مع ٢٠ منقطعاً» توصية؛ queue_recovery تنفيذ.\n` +
        `{"action":{"type":"generate_image","prompt":"وصف الصورة بالإنجليزية","purpose":"وصف عربي قصير يظهر تحت الصورة","aspect":"landscape|square|portrait"}} — توليد صورة فعلية (شعار، ملصق حملة، رسم توضيحي)\n` +
        `  الوصف بالإنجليزية لأن نموذج الصور يفهمها أدقّ. النتيجة رابط تضعينه في المستند بسطر ![الوصف](الرابط).\n` +
        `  ممنوع توليد صورة طبية أو صورة تخصّ مريضاً (أشعة، حالة سنّ، تشخيص) — الصورة المولَّدة ليست سجلاً طبياً.\n` +

        `\n[المستند]\n` +
        `الردّ سطران يقولان ما فيه؛ المستند هو العمل. استعلمي البيانات أولاً، ثم نفّذي create_document بعنوان ووصف الأقسام.\n` +
        `\nقواعد التنفيذ:\n` +
        `- كل uuid يجب أن يأتي من نتيجة استعلام في هذه المحادثة. استعلمي أولاً ثم نفّذي في الردّ التالي.\n` +
        `- لا تنفّذي إجراء إلا إذا طلبه المستخدم صراحة في رسالته الأخيرة.\n` +
        `- التواريخ والأوقات بتوقيت عُمان.\n` +
        `- بعد التنفيذ أكّدي النتيجة الفعلية كما رجعت، ولا تفترضي النجاح.\n` +
        `- أعيدي إما queries أو action في الرد الواحد — ليس كليهما.\n`);

  const historyBlock = history.length
    ? `\n[المحادثة السابقة]\n${history.map((h) => `${h.role}: ${h.text}`).join("\n")}\n`
    : "";

  try {
    /* agent loop: each model turn returns answer | queries | action (max 4 turns) */
    const context: unknown[] = [];
    let actionsDone = 0;

    /* One request, one write of any given thing.
     *
     * Asked once to file an insurance card, she wrote two clinical notes
     * two seconds apart — the loop ran a second round and she repeated
     * herself, so the patient's file carried the same event twice. The
     * round budget is there to let her gather more, not to let her act
     * again, and no clinic wants a duplicate on a medical record. */
    const written = new Set<string>();
    /* Anything the answer should render as more than text. Kept as a
       field rather than a URL inside the prose, so the interface can
       show a button and she never has to describe one. */
    let doc: { url: string; label: string } | null = null;
    const usage: Usage = { input: 0, output: 0 };

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

    const ask = (final: boolean) =>
      header + historyBlock + fileNote +
      `\n[سؤال المستخدم]\n${question}\n` +
      (context.length ? `\n[نتائج الاستعلامات والإجراءات حتى الآن]\n${JSON.stringify(context).slice(0, 14000)}\n` : "") +
      `\nأعيدي JSON فقط بأحد الأشكال:\n` +
      /* The answer used to arrive as a bulleted catalogue of what Sura is
         able to do, which is a menu rather than a reply. Someone who asked
         a question wants the number, then the context. */
      `1) {"answer":"..."} — الإجابة النهائية بالعربية.\n` +
      `   اكتبي كما يكتب زميل يعرف عمله: مباشرة، بلا تمهيد، وبثقة.\n` +
      `   - الجواب أولاً. كل رقم من النتائج أعلاه حصراً، والمبالغ بصيغة 5.000 ر.ع.\n` +
      `   - أضيفي ما يعنيه الرقم إن كان له معنى — ارتفاع، انخفاض، مقارنة، سبب محتمل.\n` +
      `   - إن لم تكفِ البيانات فقوليها في سطر واقترحي السؤال الذي يُجاب.\n` +
      `   - نسّقي بما يناسب السؤال: رقم واحد يكفيه سطر، والمقارنة أسطر، والقائمة صفوف،\n` +
      `     والخطوات ترقيم، والموضوعان عنوان لكل منهما بـ "## ". لا فقرة طويلة متلاصقة.\n` +
      `   - **بنجمتين** للتوكيد، وسطر فارغ بين الأقسام.\n` +
      `   - إن سُئلتِ عمّا تستطيعين: اعرضي أقسام [من أنتِ] بعناوين، ولكل قسم مثال واقعي يستطيع كتابته الآن.` +
      (final
        ? ``
        : `\n2) {"queries":[...]} — إذا كنت تحتاجين بيانات (أو تصحيح استعلام خاطئ).\n` +
          (role === "accountant" || isPlatform || actionsDone >= 2
            ? ``
            : `3) {"action":{...}} — لتنفيذ إجراء طلبه المستخدم صراحة (بعد حصولك على id من استعلام).`));

    let resp = parseTurn(await gemini(geminiKey, ask(false), true, usage, files));
    let pushedBack = false;

    for (let step = 0; step < 5; step++) {
      if (resp.answer && !resp.queries && !resp.action) {
        const answer = String(resp.answer);

        /* She answered with an offer to investigate rather than the
           investigation. Send her back with the rounds she did not
           spend — once, so a genuine "I need a decision from you"
           still gets through on the second pass. */
        if (!pushedBack && step < 4 && (deferring(answer) || refusing(answer))) {
          pushedBack = true;
          /* Hand her the whole sweep rather than the instruction to go
             and find it. She refused for lack of data; the answer to
             that is data, not another sentence telling her to look. */
          const { data: brief } = await sb.rpc("sura_clinic_brief", { p_clinic: cid });
          if (brief) context.push({ clinic_brief: brief });
          context.push({
            rejected_answer: answer,
            why:
              "هذا ليس جواباً. المسح الكامل لبيانات العيادة مرفق أعلاه في clinic_brief: الإيراد لكل خدمة، " +
              "وعدم الحضور بالطبيب والساعة واليوم والخدمة ومدّة الحجز المسبق والمرضى المتكرّرين، والفترة مقابل الفترة، " +
              "والمنقطعون، وقبول الخطط، والتحصيل. اكتبي من هذه الأرقام الآن. " +
              "وأنتِ ترسمين مخطّطات من بيانات حقيقية داخل المستند وتُخرجينه صفحةً جاهزة للطباعة و PDF — " +
              "فلا تقولي إنك لا تستطيعين إنشاء رسوم أو ملفات. " +
              "ولا تنقلي للمستخدم سبب رفضٍ داخلي: ذاك تعليمة لكِ لتصحيح عملك، وليس جواباً له.",
          });
          resp = parseTurn(await gemini(geminiKey, ask(false), true, usage, files));
          continue;
        }

        await logUsage(sb, cid, usage);
        return reply(answer, doc ? { doc } : {});
      }

      if (resp.action && typeof resp.action === "object" && role !== "accountant" && !isPlatform && actionsDone < 2) {
        actionsDone++;
        try {
          const act = resp.action as Record<string, unknown>;

          /* Keyed on the type and whom it touches rather than on the
             whole payload — the second note was worded differently and
             would have slipped past an exact-text comparison. Documents
             are exempt: asking for two is a legitimate request. */
          const target = String(act.patient_id ?? act.appointment_id ?? act.invoice_id ?? "");
          const key = `${String(act.type)}:${target}`;
          if (act.type !== "create_document" && target && written.has(key)) {
            context.push({
              action_result: {
                action: act.type, done: false,
                error: "نُفِّذ هذا الإجراء لهذا الشخص في هذا الطلب — لا تكرّريه. أجيبي بالنتيجة.",
              },
            });
            resp = parseTurn(await gemini(geminiKey, ask(true), true, usage, files));
            continue;
          }
          written.add(key);

          /* Stage two of a document. The planning turn supplies the
             title and the brief; the body is written here, in plain
             text, because JSON mode cannot carry it intact. */
          if (act.type === "create_document" && !String(act.body_md ?? "").trim()) {
            /* Gather before writing, in code.
             *
             * A six-part request needs a dozen queries and she has three
             * a round. She ran out, the guard refused the thin document,
             * and she handed the guard's own words to the owner as an
             * excuse — "أحتاج إلى استعراض بيانات أكثر تفصيلاً حول
             * الإيرادات لكل خدمة، وأنماط عدم الحضور، ومقارنة الأداء" is
             * verbatim the rejection text in doc-guard.
             *
             * So the sweep runs here, unconditionally, before the body is
             * written. Revenue by service, no-shows on six axes, period
             * over period, the lapsed list, plan acceptance, collection.
             * She can no longer lack the data, which means she can no
             * longer say she lacks it. */
            const { data: brief, error: briefErr } = await sb.rpc("sura_clinic_brief", { p_clinic: cid });
            if (briefErr) console.error("[sura/ask] brief failed:", briefErr.message);
            else if (brief) context.push({ clinic_brief: brief });

            act.body_md = await gemini(
              geminiKey,
              `أنتِ سُرى، تكتبين مستنداً لعيادة ${clinicName}.\n\n` +
                `[المطلوب]\n${String(act.brief ?? question)}\n\n` +
                `[البيانات التي قرأتِها — لا تستخدمي رقماً خارجها]\n${JSON.stringify(context).slice(0, 18000)}\n\n` +
                `البيانات أعلاه كاملة وكافية. لا تقولي إنها لا تكفي ولا تطلبي غيرها — اكتبي من الموجود، ` +
                `وإن غاب محور بعينه اذكري غيابه في سطر واحد وواصلي.\n` +
                `اكتبي المستند الآن بصيغة Markdown مباشرة، بلا JSON وبلا أي غلاف وبلا مقدّمة عن نفسك.\n` +
                `- عناوين بـ ## ، والأرقام في جداول Markdown.\n` +
                `- كل قسم: الرقم الذي وُجد، ثم معناه، ثم التوصية.\n` +
                `- ممنوع «سنقوم» و«سيتم» و«سأقوم» وممنوع «نحتاج بيانات» — استخدمي ما هو أمامك.\n` +
                `- ما لا يحتفظ به النظام (مثل سبب عدم الحضور) قوليه صراحةً ولا تخمّني نسبة.\n` +
                /* The fence is spelled out rather than written, because
                   three backticks inside a template literal end it. */
                /* One chart was drawn where the owner asked for رسوم.
                   Every axis in the brief is a comparison of three or
                   more things, and a comparison read as a table is a
                   comparison nobody reads. */
                "- ارسمي مخطّطاً لكل قسم فيه ثلاثة أرقام قابلة للمقارنة أو أكثر — ثلاثة مخطّطات على الأقل في المستند:\n" +
                "  سطر ```chart ثم type: bar، وعنوان، وسطر لكل بند «الاسم | الرقم»، ثم سطر ```\n" +
                `  مرشّحات جاهزة: الإيراد لكل خدمة، عدم الحضور بأيام الأسبوع، عدم الحضور بالساعة، عدم الحضور بالطبيب، المفوتَر مقابل المحصّل.\n` +
                `  وأرقام المخطّط من البيانات أعلاه فقط.\n` +
                `- اختمي بقسم «الخطوات التالية» يفصل ما نُفّذ عمّا ينتظر الموافقة.\n` +
                `- ألف إلى ألفي كلمة. لا تكرّري.`,
              false,
              usage,
              files,
            );
          }

          const res = await runAction(sb, act as unknown as Action, cid, role, claims.sub, context);
          const d = (res as { document?: { url: string; label: string } }).document;
          if (d?.url) doc = d;
          context.push({ action_result: res });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[sura/ask] action failed:", msg);
          context.push({ action_result: { action: (resp.action as Action).type, done: false, error: msg } });
        }
      } else if (Array.isArray(resp.queries) && resp.queries.length) {
        for (const plan of (resp.queries as Plan[]).slice(0, 3)) {
          try {
            context.push(await runPlan(sb, plan, cid, role, claims.sub));
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[sura/ask] plan failed:", plan?.table, msg);
            context.push({ table: plan?.table, error: msg, hint: "صحّحي الاستعلام وأعيدي المحاولة" });
          }
        }
      } else {
        break;
      }

      /* Files travel on every round, not just the first.
         The bytes cost tokens each time; a fabricated policy number
         written into a patient's file costs more. */
      resp = parseTurn(await gemini(geminiKey, ask(step >= 3), true, usage, files));
    }

    if (resp?.answer) {
      await logUsage(sb, cid, usage);
      return reply(String(resp.answer), doc ? { doc } : {});
    }

    /* Out of rounds with data in hand. Force the conclusion rather than
       discarding the work — a wide request ("analyse no-shows, plan the
       recalls, find the profitable services, put it all in a document")
       is exactly the case that exhausts the loop, and it is also exactly
       the case worth answering. */
    if (context.length > 0) {
      try {
        const forced = parseTurn(
          await gemini(
            geminiKey,
            header + historyBlock + fileNote +
              `\n[سؤال المستخدم]\n${question}\n` +
              `\n[كل ما جمعتِه]\n${JSON.stringify(context).slice(0, 16000)}\n` +
              `\nانتهت جولات الاستعلام. أجيبي الآن من المعطيات أعلاه فقط.\n` +
              `إن كان الطلب متعدّد الأجزاء فغطّي كل جزء بعنوان، وقولي صراحةً عن أي جزء لم تكفِ بياناته.\n` +
              `أعيدي {"answer":"..."} فقط — لا استعلامات ولا إجراءات.`,
            true,
            usage,
          ),
        );
        if (forced?.answer) {
          await logUsage(sb, cid, usage);
          return reply(String(forced.answer), doc ? { doc } : {});
        }
      } catch {
        /* fall through to the honest message below */
      }
    }

    await logUsage(sb, cid, usage);
    return reply(
      "الطلب واسع وما قدرت أغطّيه كاملاً في مرّة واحدة. قسّمه لجزأين وأنا أنفّذ كل واحد.",
      { failure: "unknown" },
      "incomplete",
    );
  } catch (e) {
    const kind: SuraFailure = e instanceof SuraError ? e.kind : "unknown";
    console.error("[sura/ask]", kind, e instanceof Error ? e.message : e);
    /* A named failure, so the interface can offer the right thing —
       retry now, wait a minute, or tell the owner the key is dead. */
    return reply(FAILURE_AR[kind], { failure: kind, retryable: kind !== "bad_key" }, kind);
  }
}
