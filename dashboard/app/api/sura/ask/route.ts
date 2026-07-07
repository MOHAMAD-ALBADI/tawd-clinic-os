import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";

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

const ROLE_TABLES: Record<Role, string[]> = {
  clinic_admin: Object.keys(TABLES),
  accountant: Object.keys(TABLES),
  platform_admin: Object.keys(TABLES),
  doctor: ["appointments", "patients", "services", "tawd_staff_users", "appointment_waitlist", "no_show_log"],
  receptionist: ["appointments", "patients", "services", "tawd_staff_users", "appointment_waitlist", "sura_alerts", "no_show_log", "chat_sessions"],
};

const OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AgentAction = { type: string; appointment_id?: string; reason?: string };

/* Real, tightly-scoped mutations Sura may perform on explicit user request. */
async function runAction(
  sb: Awaited<ReturnType<typeof createServiceRoleClient>>,
  action: AgentAction,
  cid: string,
  role: Role,
  sub: string
) {
  if (role === "accountant") throw new Error("هذا الدور لا يملك صلاحية تنفيذ إجراءات على المواعيد");
  const id = String(action.appointment_id ?? "");
  if (!UUID_RE.test(id)) throw new Error("appointment_id يجب أن يكون UUID حقيقياً من نتيجة استعلام");

  const nowIso = new Date().toISOString();
  let patch: Record<string, unknown>;
  let allowedFrom: string[];

  if (action.type === "cancel_appointment") {
    patch = {
      status: "cancelled",
      cancelled_at: nowIso,
      cancelled_by: sub,
      cancellation_reason: String(action.reason ?? "").trim() || "إلغاء عبر سُرى (لوحة التحكم)",
      updated_at: nowIso,
    };
    allowedFrom = ["scheduled", "confirmed", "checked_in"];
  } else if (action.type === "confirm_appointment") {
    patch = { status: "confirmed", updated_at: nowIso };
    allowedFrom = ["scheduled"];
  } else {
    throw new Error(`إجراء غير مدعوم: ${action.type}`);
  }

  let q = sb
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .eq("clinic_id", cid)
    .is("deleted_at", null)
    .in("status", allowedFrom);
  if (role === "doctor") q = q.eq("doctor_id", sub);

  const { data, error } = await q.select("id, slot_time, status").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      action: action.type,
      done: false,
      reason: "لا يوجد موعد بهذا المعرف قابل للتعديل (تحققي من الحالة أو الصلاحية)",
    };
  }
  return { action: action.type, done: true, appointment: data };
}

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
  return ROLE_TABLES[role]
    .map((t) => `- ${t}: [${TABLES[t].cols.join(", ")}] — ${TABLES[t].desc}${EMBEDS[t] ? " (يدعم embed=true لجلب أسماء المريض/الخدمة/الطبيب)" : ""}`)
    .join("\n");
}

async function runPlan(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, plan: Plan, cid: string, role: Role, sub: string) {
  const t = TABLES[plan.table];
  if (!t || !ROLE_TABLES[role].includes(plan.table)) throw new Error(`جدول غير مسموح: ${plan.table}`);

  const agg = plan.aggregate;
  const wantCols = (plan.select ?? []).filter((c) => t.cols.includes(c));
  const baseCols = wantCols.length ? wantCols : t.cols.slice(0, 8);
  const selectStr =
    (agg ? Array.from(new Set([...(agg.col ? [agg.col] : []), ...(agg.group_by ? [agg.group_by] : []), ...baseCols])) : baseCols).join(",") +
    (plan.embed && EMBEDS[plan.table] ? `, ${EMBEDS[plan.table]}` : "");

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

async function gemini(key: string, prompt: string, json: boolean, usage?: Usage) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1200,
          thinkingConfig: { thinkingBudget: 0 },
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );
  const j = await res.json();
  if (usage && j?.usageMetadata) {
    usage.input += Number(j.usageMetadata.promptTokenCount ?? 0);
    usage.output += Number(j.usageMetadata.candidatesTokenCount ?? 0);
  }
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error(j?.error?.message ?? "empty model response");
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
  if (!claims || !claims.clinic_id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = (claims.role ?? "clinic_admin") as Role;

  let question = "";
  let history: { role: string; text: string }[] = [];
  try {
    const body = await req.json();
    question = String(body?.question ?? "").slice(0, 500).trim();
    if (Array.isArray(body?.history)) {
      history = body.history.slice(-6).map((m: { role?: string; text?: string; content?: string }) => ({
        role: m.role === "user" ? "المدير" : "سُرى",
        text: String(m.text ?? m.content ?? "").slice(0, 300),
      }));
    }
  } catch { /* fallthrough */ }
  if (!question) return NextResponse.json({ error: "empty question" }, { status: 400 });

  const sb = await createServiceRoleClient();
  const isPlatform = hasRole(claims, "platform_admin");
  const cid = isPlatform ? "" : claims.clinic_id; // '' = unscoped platform mode

  const [cfgRes, clinicRes, meRes] = await Promise.all([
    sb.from("channel_configs").select("config").eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle(),
    sb.from("tawd_clinics").select("name, name_ar, clinic_type").eq("id", claims.clinic_id).maybeSingle(),
    sb.from("tawd_staff_users").select("name, name_ar").eq("id", claims.sub).maybeSingle(),
  ]);
  const geminiKey = (cfgRes.data?.config as Record<string, string> | null)?.gemini_key;
  if (!geminiKey) {
    return NextResponse.json({ answer: "إعداد الذكاء الاصطناعي غير مكتمل لهذه العيادة — تواصل مع دعم طود." });
  }
  const clinicName = clinicRes.data?.name_ar ?? clinicRes.data?.name ?? "العيادة";
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
      ? `أنتِ "سُرى"، العقل الذكي لمنصة طود كاملة. تتحدثين مع ${roleLabel} — صلاحياته شاملة: استعلاماتك تغطي كل العيادات (أضيفي clinic_id في select للتمييز بينها عند الحاجة).\n`
      : `أنتِ "سُرى"، العقل الذكي لعيادة ${clinicName}. تتحدثين مع ${roleLabel}.\n`) +
    `هوية المتحدث معروفة ومؤكدة تلقائياً من تسجيل دخوله — لا تسأليه أبداً عن اسمه أو معرفه أو هويته.\n` +
    (role === "doctor"
      ? `كل استعلامات جدول appointments تُفلتر تلقائياً على مواعيد هذا الطبيب فقط — "مواعيدي/مرضاي" تعني نتائج الاستعلام مباشرة.\n`
      : "") +
    `تاريخ اليوم في مسقط: ${muscatDate} (${muscatDay}). "غداً" = اليوم التالي لهذا التاريخ. الأوقات في قاعدة البيانات UTC (مسقط = UTC+4).\n` +
    `نتيجة استعلام فارغة [] تعني ببساطة: لا بيانات مطابقة — أجيبي بذلك بثقة (مثال: "لا مواعيد غداً"). لا تفترضي أبداً وجود مشكلة في الهوية أو خطأ تقني.\n` +
    `العملة: ريال عُماني بثلاث منازل عشرية.\n\n` +
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
    (role === "accountant"
      ? ""
      : `[الإجراءات المتاحة — عند طلب المستخدم الصريح فقط]\n` +
        `{"action":{"type":"cancel_appointment","appointment_id":"<uuid>","reason":"اختياري"}} — إلغاء موعد\n` +
        `{"action":{"type":"confirm_appointment","appointment_id":"<uuid>"}} — تأكيد موعد مجدول\n` +
        `- appointment_id يجب أن يأتي من نتيجة استعلام في هذه المحادثة (استعلمي أولاً إن لزم، ثم نفّذي في الرد التالي).\n` +
        `- لا تنفّذي إجراء إلا إذا طلبه المستخدم صراحة في رسالته الأخيرة، وأكّدي له النتيجة الفعلية بعد التنفيذ.\n` +
        `- أعيدي إما queries أو action في الرد الواحد — ليس كليهما.\n`);

  const historyBlock = history.length
    ? `\n[المحادثة السابقة]\n${history.map((h) => `${h.role}: ${h.text}`).join("\n")}\n`
    : "";

  try {
    /* agent loop: each model turn returns answer | queries | action (max 4 turns) */
    const context: unknown[] = [];
    let actionsDone = 0;
    const usage: Usage = { input: 0, output: 0 };

    const ask = (final: boolean) =>
      header + historyBlock +
      `\n[سؤال المستخدم]\n${question}\n` +
      (context.length ? `\n[نتائج الاستعلامات والإجراءات حتى الآن]\n${JSON.stringify(context).slice(0, 14000)}\n` : "") +
      `\nأعيدي JSON فقط بأحد الأشكال:\n` +
      `1) {"answer":"..."} — الإجابة/التأكيد النهائي بالعربية، موجز ودقيق، اعتماداً حصراً على النتائج أعلاه (لا تخترعي أرقاماً؛ المبالغ مثل 5.000 ر.ع).` +
      (final
        ? ``
        : `\n2) {"queries":[...]} — إذا كنت تحتاجين بيانات (أو تصحيح استعلام خاطئ).\n` +
          (role === "accountant" || actionsDone >= 2
            ? ``
            : `3) {"action":{...}} — لتنفيذ إجراء طلبه المستخدم صراحة (بعد حصولك على id من استعلام).`));

    let resp = JSON.parse(await gemini(geminiKey, ask(false), true, usage));

    for (let step = 0; step < 4; step++) {
      if (resp.answer && !resp.queries && !resp.action) {
        await logUsage(sb, cid, usage);
        return NextResponse.json({ answer: String(resp.answer) });
      }

      if (resp.action && typeof resp.action === "object" && role !== "accountant" && actionsDone < 2) {
        actionsDone++;
        try {
          const res = await runAction(sb, resp.action as AgentAction, cid, role, claims.sub);
          context.push({ action_result: res });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[sura/ask] action failed:", msg);
          context.push({ action_result: { action: (resp.action as AgentAction).type, done: false, error: msg } });
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
    if (resp?.answer) return NextResponse.json({ answer: String(resp.answer) });
    return NextResponse.json({
      answer: "ما قدرت أكمل هذا الطلب — جرّب صياغته بشكل أوضح أو قسّمه لخطوتين.",
    });
  } catch {
    return NextResponse.json({ answer: "تعذّر التحليل الآن — حاول مرة أخرى بعد لحظات." });
  }
}
