import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";

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
  if (t.clinicCol) q = q.eq("clinic_id", cid);
  if (role === "doctor" && plan.table === "appointments") q = q.eq("doctor_id", sub);
  if ("deleted_at" in Object.fromEntries(t.cols.map((c) => [c, 1])) ) { /* noop */ }
  if (["patients", "appointments", "invoices"].includes(plan.table)) q = q.is("deleted_at", null);

  for (const f of plan.filters ?? []) {
    if (!f || typeof f.col !== "string" || !OPS.has(f.op)) continue;
    if (!t.cols.includes(f.col)) continue;
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

async function gemini(key: string, prompt: string, json: boolean) {
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
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error(j?.error?.message ?? "empty model response");
  return text;
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
  const cid = claims.clinic_id;

  const [cfgRes, clinicRes] = await Promise.all([
    sb.from("channel_configs").select("config").eq("clinic_id", cid).eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle(),
    sb.from("tawd_clinics").select("name, name_ar, clinic_type").eq("id", cid).single(),
  ]);
  const geminiKey = (cfgRes.data?.config as Record<string, string> | null)?.gemini_key;
  if (!geminiKey) {
    return NextResponse.json({ answer: "إعداد الذكاء الاصطناعي غير مكتمل لهذه العيادة — تواصل مع دعم طود." });
  }
  const clinicName = clinicRes.data?.name_ar ?? clinicRes.data?.name ?? "العيادة";

  const now = new Date();
  const header =
    `أنتِ "سُرى"، العقل الذكي لعيادة ${clinicName}. تتحدثين مع ${role === "doctor" ? "طبيب" : role === "receptionist" ? "موظف استقبال" : role === "accountant" ? "المحاسب" : "مدير العيادة"}.\n` +
    `اليوم (UTC): ${now.toISOString()} — توقيت مسقط = UTC+4. الأوقات في قاعدة البيانات UTC.\n` +
    `العملة: ريال عُماني بثلاث منازل عشرية.\n\n` +
    `لديك وصول كامل لقاعدة بيانات العيادة عبر خطط استعلام JSON. الجداول المتاحة:\n${catalogFor(role)}\n\n` +
    `صيغة خطة الاستعلام:\n` +
    `{"queries":[{"table":"...","select":["col",...],"embed":true|false,"filters":[{"col":"...","op":"eq|neq|gt|gte|lt|lte|ilike|in|is","value":...}],"order":{"col":"...","desc":true},"limit":25,"aggregate":{"op":"sum|count|avg","col":"...","group_by":"..."}}]}\n` +
    `- استخدمي aggregate للمجاميع/العدّ/المتوسط (group_by للتجميع مثل أكثر خدمة/طبيب).\n` +
    `- embed=true يجلب اسم المريض/الخدمة/الطبيب مع الصف.\n` +
    `- ilike للبحث بالأسماء العربية (بدون %).\n` +
    `- بحد أقصى 3 استعلامات بالجولة.\n`;

  const historyBlock = history.length
    ? `\n[المحادثة السابقة]\n${history.map((h) => `${h.role}: ${h.text}`).join("\n")}\n`
    : "";

  try {
    /* round 1: plan or direct answer */
    const p1 =
      header + historyBlock +
      `\n[سؤال المستخدم]\n${question}\n\n` +
      `أعيدي JSON فقط بأحد الشكلين:\n` +
      `1) {"answer":"..."} إذا كان السؤال عاماً أو تحية أو تُجيبينه من المحادثة السابقة.\n` +
      `2) {"queries":[...]} إذا كان يحتاج بيانات من قاعدة البيانات (المفضّل دائماً للأسئلة عن العيادة).`;

    const r1 = JSON.parse(await gemini(geminiKey, p1, true));
    if (r1.answer && !r1.queries) {
      return NextResponse.json({ answer: String(r1.answer) });
    }

    let plans: Plan[] = Array.isArray(r1.queries) ? r1.queries.slice(0, 3) : [];
    let results: unknown[] = [];
    let lastError = "";

    for (let round = 0; round < 2; round++) {
      results = [];
      lastError = "";
      for (const plan of plans) {
        try {
          results.push(await runPlan(sb, plan, cid, role, claims.sub));
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          results.push({ table: plan?.table, error: lastError });
        }
      }

      const p2 =
        header + historyBlock +
        `\n[سؤال المستخدم]\n${question}\n\n` +
        `[نتائج الاستعلامات]\n${JSON.stringify(results).slice(0, 14000)}\n\n` +
        `أعيدي JSON فقط:\n` +
        `1) {"answer":"..."} — الإجابة النهائية بالعربية، موجزة ودقيقة، اعتماداً حصراً على النتائج أعلاه (لا تخترعي أرقاماً). نسّقي المبالغ مثل 5.000 ر.ع.\n` +
        (round === 0
          ? `2) {"queries":[...]} — فقط إذا كانت النتائج غير كافية أو فيها خطأ وتحتاجين استعلاماً مختلفاً.`
          : ``);

      const r2 = JSON.parse(await gemini(geminiKey, p2, true));
      if (r2.answer && !r2.queries) {
        return NextResponse.json({ answer: String(r2.answer) });
      }
      if (round === 0 && Array.isArray(r2.queries) && r2.queries.length) {
        plans = r2.queries.slice(0, 3);
        continue;
      }
      if (r2.answer) return NextResponse.json({ answer: String(r2.answer) });
      break;
    }

    return NextResponse.json({
      answer: lastError
        ? "واجهت صعوبة في قراءة هذه البيانات — جرّب صياغة السؤال بشكل مختلف."
        : "ما قدرت أوصل لإجابة دقيقة — جرّب تحديد سؤالك أكثر.",
    });
  } catch {
    return NextResponse.json({ answer: "تعذّر التحليل الآن — حاول مرة أخرى بعد لحظات." });
  }
}
