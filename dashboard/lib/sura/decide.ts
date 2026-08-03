import type { Decision, GapCandidate, Goal } from "./types";

/* The judgement step.
 *
 * One structured call, one decision. Not a ReAct loop — and that is a
 * choice, not a shortcut. A multi-step reasoning loop earns its cost when
 * the agent must discover what it needs as it goes; here the scanner has
 * already assembled every fact in SQL, so a loop would only add latency,
 * spend, and failure modes to a decision the model can make once.
 *
 * The response is constrained by a schema on Gemini's side. Free-form
 * output with a JSON.parse and a hopeful try/catch is how the previous
 * generation of this agent produced replies that silently drifted; a
 * declared schema makes the malformed case impossible rather than
 * handled.
 */

/* Flash, deliberately. This runs every ten minutes over every open goal
   and makes one narrow choice from a list the scanner already built —
   the reasoning is cheap and the volume is not. 3.6 is a large step up
   from 2.5 at the same tier of cost. */
const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["message_patient", "wait", "drop", "escalate"] },
    patient_id: { type: "string" },
    message_ar: { type: "string" },
    wake_in_minutes: { type: "integer" },
    reason: { type: "string" },
    considered: { type: "array", items: { type: "string" } },
  },
  required: ["action", "reason", "considered"],
} as const;

const RULES = `أنتِ سُرى، الوكيل الذكي لعيادة داخل نظام طَود.

هذه ليست محادثة. لم يراسلك أحد. أنتِ تستيقظين على هدف مفتوح وتقرّرين ماذا تفعلين به.

قواعد لا تُخالَف:
- لا تشخّصي ولا تصفي علاجاً ولا تعدي بنتيجة.
- لا تذكري سعراً غير المذكور في المعطيات.
- رسالة واحدة قصيرة، بالعربية، بلهجة عُمانية مهذّبة وطبيعية — لا لغة إعلانات.
- اذكري الشيء المحدّد (الخدمة، الوقت، اسم الطبيب) لا كلاماً عاماً.
- إن لم يكن أي مرشّح مناسباً، اختاري drop ولا تراسلي أحداً.
- «considered» يجب أن يذكر البدائل التي وازنتِها ولماذا استبعدتِها — هذا يُعرض لصاحب العيادة.
- «reason» جملة عربية واحدة تشرح الاختيار.`;

function gapPrompt(goal: Goal, cands: GapCandidate[]): string {
  const c = goal.context as Record<string, string>;
  const when = new Date(String(c.slot_time)).toLocaleString("ar-OM", {
    timeZone: "Asia/Muscat",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rows = cands
    .map(
      (x, i) =>
        `${i + 1}. ${x.name} [${x.patient_id}]\n` +
        `   زيارات مكتملة: ${x.visits} · تغيّب: ${x.no_shows}` +
        `${x.pref_hour != null ? ` · يأتي عادةً الساعة ${x.pref_hour}` : ""}\n` +
        `   ${x.open_plan_item ? `عنده بند متبقٍ في خطته: ${x.open_plan_item} (${x.open_plan_omr} ر.ع)` : "لا يوجد بند متبقٍ يطابق الخدمة"}\n` +
        `   ${x.on_waitlist ? "مسجّل في قائمة الانتظار لهذه الخدمة" : "غير مسجّل في قائمة الانتظار"}\n` +
        `   آخر تواصل من سُرى: ${x.days_since_contact >= 999 ? "لم يسبق" : `قبل ${x.days_since_contact} يوماً`}`,
    )
    .join("\n");

  return `${RULES}

الموقف: موعد أُلغي وصار هناك كرسي فارغ. إن لم يُملأ فقيمته صفر.

الخدمة: ${c.service_name}
الطبيب: ${c.doctor_name}
الوقت: ${when}
القيمة: ${goal.value_omr} ر.ع

المرشّحون:
${rows}

اختاري مريضاً واحداً فقط واكتبي له الرسالة، أو drop إن لم يكن أحدهم مناسباً.
رجّحي: من عنده بند متبقٍ يطابق الخدمة، ثم من طلب أن يُبلَّغ، ثم من لا يتغيّب، ثم من يوافق وقته المعتاد.
تجنّبي من راسلته سُرى قريباً.
في message_ar: اذكري الخدمة والطبيب واليوم والساعة، واسألي سؤالاً يُجاب بنعم أو لا.`;
}

function planPrompt(goal: Goal, patient: { name: string }): string {
  const c = goal.context as Record<string, string | number | null>;
  const item = c.next_item ? String(c.next_item) : null;

  /* Two different situations wearing one goal kind.
   *
   * A patient with an unfinished treatment gets named the treatment. A
   * lapsed patient with no open plan has nothing to be reminded OF — and
   * the earlier version handed the prompt whatever was in next_item,
   * which for a hand-queued goal was the internal queue label. It went
   * out on WhatsApp. */
  if (!item) {
    return `${RULES}

الموقف: مريض لم يراجع العيادة منذ فترة. ليست لديه خطة علاجية مفتوحة — لا تذكري خطةً ولا بنداً ولا مبلغاً.

المريض: ${patient.name}
${c.queue_note ? `سبب الاختيار (داخلي — لا تذكريه له): ${c.queue_note}` : ""}

اكتبي رسالة قصيرة ودّية تطمئنين فيها عليه وتذكّرينه أن العيادة موجودة، وتعرضين حجز موعد فحص إن أحبّ.
لا تخترعي علاجاً ولا سعراً ولا تاريخ زيارة. لا تلومي ولا تُلحّي.`;
  }

  return `${RULES}

الموقف: مريض بدأ خطة علاجية ثم توقّف. التشخيص تمّ والعلاج لم يكتمل.

المريض: ${patient.name}
البند المتبقّي: ${item}${c.next_price ? ` — ${c.next_price} ر.ع` : ""}
${c.days_stalled ? `توقّف منذ: ${c.days_stalled} يوماً` : ""}
قيمة المتبقّي من الخطة: ${goal.value_omr} ر.ع

اكتبي رسالة تذكّره بالبند المتبقّي **باسمه تحديداً** لا بوجود خطة، وتعرضي حجز موعد له.
لا تلومي ولا تُلحّي. إن كان التوقّف أكثر من ١٢٠ يوماً فاختاري drop — المريض غالباً انتقل لعيادة أخرى.`;
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

export async function decide(
  apiKey: string,
  goal: Goal,
  payload: { candidates?: GapCandidate[]; patient?: { name: string } },
): Promise<Decision | null> {
  const prompt =
    goal.kind === "gap_fill"
      ? gapPrompt(goal, payload.candidates ?? [])
      : planPrompt(goal, payload.patient ?? { name: "المريض" });

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        /* Thinking is charged against this ceiling, so it rose with the
           model. An exhausted budget returns nothing at all, and a goal
           that silently never advances is the worst failure here. */
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        /* Gemini 3 rejects thinkingBudget: 0 — "This model only works in
           thinking mode". Low is the floor, and a decision this narrow
           does not want more than the floor. */
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
  });

  if (!res.ok) return null;

  /* Every part joined, not the first. A thinking model splits its reply,
     and parts[0] can be an opening fragment — valid text, invalid JSON,
     and a goal that never advances for a reason nothing logs. */
  const body = (await res.json()) as GeminiResponse;
  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  return normalise(raw, payload.candidates ?? []);
}

/* Trust the schema for shape, verify the content.
 *
 * The schema guarantees `action` is one of four strings. It does not
 * guarantee the patient_id is one we offered — and a hallucinated id
 * would send a real message to whoever happened to own that row. */
function normalise(raw: unknown, cands: GapCandidate[]): Decision | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const reason = typeof o.reason === "string" && o.reason.trim() ? o.reason.trim() : null;
  if (!reason) return null;

  const considered = Array.isArray(o.considered)
    ? o.considered.filter((x): x is string => typeof x === "string").slice(0, 8)
    : [];

  switch (o.action) {
    case "message_patient": {
      const id = typeof o.patient_id === "string" ? o.patient_id : "";
      const msg = typeof o.message_ar === "string" ? o.message_ar.trim() : "";
      if (!msg) return null;
      // For a gap the model picks from a list; anything outside it is a
      // hallucination and must not become an outbound message.
      if (cands.length > 0 && !cands.some((c) => c.patient_id === id)) return null;
      return { action: "message_patient", patient_id: id, message_ar: msg, reason, considered };
    }
    case "wait": {
      const m = typeof o.wake_in_minutes === "number" ? o.wake_in_minutes : 120;
      return {
        action: "wait",
        wake_in_minutes: Math.min(2880, Math.max(15, Math.round(m))),
        reason,
        considered,
      };
    }
    case "drop":
      return { action: "drop", reason, considered };
    case "escalate":
      return { action: "escalate", reason, considered };
    default:
      return null;
  }
}
