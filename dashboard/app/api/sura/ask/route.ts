import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";
import { hasRole } from "@/lib/auth/role-redirect";
import { runAction, type Action } from "@/lib/sura/actions";
import type { Attachment } from "@/lib/sura/types";
import { ensureConversation, saveTurn, type StoredFile } from "@/lib/sura/conversations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

const OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  | "provider_down" | "refused" | "too_long" | "empty" | "unknown";

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
      throw new Error(`قيمة ${f.col} ليست UUID صالحاً — للبحث بالاسم استعلمي أولاً عن patients بـ ilike على name ثم استخدمي الـ id الناتج، أو استخدمي embed=true`);
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
      q = q.ilike(f.col, s.includes("%") ? s : `%${s}%`);
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
        const k = String(r[agg.group_by] ?? "غير محدد");
        groups[k] = groups[k] ?? { count: 0, sum: 0 };
        groups[k].count++;
        groups[k].sum += agg.col ? num(r) : 0;
      }
      const list = Object.entries(groups)
        .map(([key, g]) => ({ [agg.group_by as string]: key, count: g.count, ...(agg.col ? { sum: +g.sum.toFixed(3), avg: +(g.sum / g.count).toFixed(3) } : {}) }))
        .sort((a, b) => Number(b.count) - Number(a.count))
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
  const timer = setTimeout(() => ac.abort(), 28_000);

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
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
            maxOutputTokens: files.length ? 3000 : 2200,
            thinkingConfig: { thinkingBudget: 0 },
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
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    /* An empty candidate almost always means the safety filter fired or
       the output budget was spent before a token was produced. They need
       different answers, and "empty model response" gave neither. */
    const why = j?.candidates?.[0]?.finishReason;
    throw new SuraError(
      why === "SAFETY" ? "refused" : why === "MAX_TOKENS" ? "too_long" : "empty",
    );
  }
  return text;
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
      `[ما أنتِ عليه — اعرفيه جيداً وأجيبي عنه بثقة إن سُئلتِ]\n` +
      `أنتِ وكيل تشغيلي كامل داخل نظام طَود، لستِ صندوق أسئلة. تستطيعين:\n` +
      `١. القراءة من قاعدة بيانات العيادة الحيّة والإجابة عن أي رقم فيها — إيرادات، تحصيل، مواعيد، عدم حضور، إنتاجية طبيب، خطط علاجية، مخزون، تأمين.\n` +
      `٢. التنفيذ: تحجزين موعداً حقيقياً، تؤجّلين، تلغين، تؤكّدين، تضيفين لقائمة الانتظار، تكتبين مسوّدة خطة علاجية بأسعار العيادة، وترسلين رسالة واتساب للمريض.\n` +
      `٣. قراءة الملفات: إن أرفق المستخدم صورة أو ملف PDF فأنتِ ترينه فعلاً وتقرئينه — بطاقة تأمين، تقرير مختبر، أشعة، عرض سعر، فاتورة مورّد. اقرأيه واستخرجي منه ما يخدم سؤاله.\n` +
      `٤. إصدار مستند: إن طُلب منكِ تقرير أو PDF أو ملف، نفّذي open_document — يظهر للمستخدم زرّاً جاهزاً يفتح المستند. لا تشرحي خطوات ولا تعطي مساراً؛ نفّذي.\n` +
      `٥. العمل وحدك: كل عشر دقائق تستيقظين بلا أن يطلب منكِ أحد، فتبحثين عن كرسي فارغ بسبب إلغاء وتعرضينه على أنسب مريض، وعن خطة علاجية توقّفت فتتابعين صاحبها. كل قرار تتّخذينه مسجَّل بسببه في صفحة الوكيل.\n` +
      `ما لا تفعلينه: لا تشخّصين ولا تصفين دواءً ولا تعطين رأياً طبياً، ولا تخترعين رقماً أو سعراً ليس في البيانات.\n\n`) +
    `لديك وصول كامل لقاعدة بيانات العيادة عبر خطط استعلام JSON. الجداول المتاحة:\n${catalogFor(role)}\n\n` +
    `صيغة خطة الاستعلام:\n` +
    `{"queries":[{"table":"...","select":["col",...],"embed":true|false,"filters":[{"col":"...","op":"eq|neq|gt|gte|lt|lte|ilike|in|is","value":...}],"order":{"col":"...","desc":true},"limit":25,"aggregate":{"op":"sum|count|avg","col":"...","group_by":"..."}}]}\n` +
    `- استخدمي aggregate للمجاميع/العدّ/المتوسط (group_by للتجميع مثل أكثر خدمة/طبيب).\n` +
    `- embed=true يجلب اسم المريض/الخدمة/الطبيب مع الصف.\n` +
    `- ilike للبحث بالأسماء العربية (بدون %).\n` +
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
        `{"action":{"type":"draft_treatment_plan","patient_id":"<uuid>","title":"عنوان","items":[{"service_id":"<uuid>","description":"اختياري","tooth":"اختياري","qty":1}]}} — مسوّدة خطة علاجية (الأسعار تُؤخذ من جدول خدماتك)\n` +
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
    /* Anything the answer should render as more than text. Kept as a
       field rather than a URL inside the prose, so the interface can
       show a button and she never has to describe one. */
    let doc: { url: string; label: string } | null = null;
    const usage: Usage = { input: 0, output: 0 };

    const fileNote = files.length
      ? `\n[مرفقات]\nأرفق المستخدم ${files.length} ملفاً (${files.map((f) => f.name ?? f.mime).join("، ")}). ` +
        `اقرأيها واستخرجي منها ما يخدم السؤال. إن كانت وثيقة مريض فلخّصي المهمّ منها ولا تنسخيها كاملة.\n`
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
      `   - إن سُئلتِ عمّا تستطيعين: اعرضي الخمس من [ما أنتِ عليه] مرتّبة، ولكل واحدة مثال يكتبه الآن.` +
      (final
        ? ``
        : `\n2) {"queries":[...]} — إذا كنت تحتاجين بيانات (أو تصحيح استعلام خاطئ).\n` +
          (role === "accountant" || isPlatform || actionsDone >= 2
            ? ``
            : `3) {"action":{...}} — لتنفيذ إجراء طلبه المستخدم صراحة (بعد حصولك على id من استعلام).`));

    let resp = JSON.parse(await gemini(geminiKey, ask(false), true, usage, files));

    for (let step = 0; step < 4; step++) {
      if (resp.answer && !resp.queries && !resp.action) {
        await logUsage(sb, cid, usage);
        return reply(String(resp.answer), doc ? { doc } : {});
      }

      if (resp.action && typeof resp.action === "object" && role !== "accountant" && !isPlatform && actionsDone < 2) {
        actionsDone++;
        try {
          const res = await runAction(sb, resp.action as Action, cid, role, claims.sub);
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

      resp = JSON.parse(await gemini(geminiKey, ask(step >= 2), true, usage));
    }

    await logUsage(sb, cid, usage);
    if (resp?.answer) return reply(String(resp.answer), doc ? { doc } : {});
    return reply(
      "ما قدرت أكمل هذا الطلب — جرّب صياغته بشكل أوضح أو قسّمه لخطوتين.",
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
