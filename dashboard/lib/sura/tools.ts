import type { Role } from "@/types/tawd";

/* What Sura can do, declared rather than described.
 *
 * The old protocol asked the model to emit JSON as text — one shape per
 * turn, `{"queries"}` or `{"action"}` or `{"answer"}` — which the route
 * then parsed by hand. Everything that went wrong with this agent traces
 * back to that one decision:
 *
 *   «وصل ردّ غير مكتمل من النموذج» was never the model failing. It was
 *   JSON.parse failing on text that was very nearly JSON. With declared
 *   functions the transport is structured by the API and that error
 *   cannot occur.
 *
 *   One shape per turn meant she could not query and act in the same
 *   breath. A request naming six jobs needed a dozen queries and six
 *   actions against a budget of five rounds and two actions — not hard,
 *   arithmetically impossible. Declared functions can be called several
 *   at a time; measured on this key, Pro issues two in a single turn.
 *
 *   And a tool written in prose is a tool the model may or may not
 *   believe it has. Asked for a PDF she said she could not make one,
 *   while create_document sat in a paragraph a hundred lines up.
 *
 * The names here are exactly the action types runAction already
 * dispatches on, so a function call is executed by the same audited path
 * as before — the guardrails do not move. Only the transport does.
 */

type Schema = {
  type: string;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: string[];
};

export type ToolDecl = { name: string; description: string; parameters: Schema };

const str = (description?: string): Schema => ({ type: "string", ...(description ? { description } : {}) });
const num = (description?: string): Schema => ({ type: "number", ...(description ? { description } : {}) });
const int = (description?: string): Schema => ({ type: "integer", ...(description ? { description } : {}) });
const bool = (description?: string): Schema => ({ type: "boolean", ...(description ? { description } : {}) });

const obj = (properties: Record<string, Schema>, required: string[] = []): Schema =>
  ({ type: "object", properties, required });

const uuid = (what: string): Schema =>
  str(`معرّف ${what} — UUID جاء من نتيجة query_clinic في هذه المحادثة. لا تخترعيه.`);

/* ── reading ─────────────────────────────────────────────────────── */

const READ: ToolDecl[] = [
  {
    name: "query_clinic",
    description:
      "قراءة بيانات العيادة. يُرجع صفوفاً حقيقية من قاعدة البيانات. " +
      "استعملي هذه قبل أي إجراء يحتاج معرّفاً، وقبل أي رقم تذكرينه. " +
      "يمكن نداؤها عدة مرات في نفس الدور.",
    parameters: obj(
      {
        table: str("اسم الجدول من القائمة المتاحة لدورك"),
        select: { type: "array", items: str(), description: "الأعمدة المطلوبة — ضمّني id دائماً" },
        embed: bool("true لجلب اسم المريض/الخدمة/الطبيب مع الصف"),
        filters: {
          type: "array",
          description: "شروط التصفية",
          items: obj(
            {
              col: str("اسم العمود"),
              op: { ...str("المُعامل"), enum: ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"] },
              value: str("القيمة. للبحث باسم شخص استعملي ilike على name — النظام يطابق كل كلمة في name وname_ar ويتجاوز «بن/بنت» واختلاف الهمزة"),
            },
            ["col", "op"],
          ),
        },
        order: obj({ col: str(), desc: bool() }, ["col"]),
        limit: int("حتى 100"),
        aggregate: obj(
          {
            op: { ...str(), enum: ["sum", "count", "avg"] },
            col: str("العمود المحسوب"),
            group_by: str("عمود التجميع — مثلاً service_id"),
          },
          ["op"],
        ),
      },
      ["table"],
    ),
  },
  {
    name: "clinic_brief",
    description:
      "مسح تحليلي كامل وجاهز: الإيراد لكل خدمة، وعدم الحضور بالطبيب والساعة واليوم والخدمة ومدّة الحجز المسبق والمرضى المتكرّرين، " +
      "والشهر مقابل الشهر، والمنقطعون، وقبول الخطط، والمفوتَر مقابل المحصّل. " +
      "استعمليها بدل عشرة استعلامات حين يكون السؤال تحليلياً.",
    parameters: obj({}),
  },
];

/* ── the clinic's day ────────────────────────────────────────────── */

const SCHEDULING: ToolDecl[] = [
  {
    name: "book_appointment",
    description: "حجز موعد حقيقي. يتحقّق من توفّر الطبيب فعلياً ويرفض التعارض.",
    parameters: obj(
      {
        patient_id: uuid("المريض"),
        service_id: uuid("الخدمة"),
        doctor_id: str("معرّف الطبيب، أو \"any\" ليختار النظام المتاح"),
        date: str("YYYY-MM-DD"),
        time: str("HH:MM بتوقيت مسقط"),
      },
      ["patient_id", "service_id", "date", "time"],
    ),
  },
  {
    name: "reschedule_appointment",
    description: "نقل موعد قائم إلى وقت آخر.",
    parameters: obj({ appointment_id: uuid("الموعد"), date: str("YYYY-MM-DD"), time: str("HH:MM") },
      ["appointment_id", "date", "time"]),
  },
  {
    name: "cancel_appointment",
    description: "إلغاء موعد. يُحرّر الوقت تلقائياً لقائمة الانتظار.",
    parameters: obj({ appointment_id: uuid("الموعد"), reason: str("سبب الإلغاء") }, ["appointment_id"]),
  },
  {
    name: "confirm_appointment",
    description: "تأكيد موعد مجدول.",
    parameters: obj({ appointment_id: uuid("الموعد") }, ["appointment_id"]),
  },
  {
    name: "add_to_waitlist",
    description: "إضافة مريض لقائمة الانتظار — يُعرض عليه أي إلغاء تلقائياً.",
    parameters: obj(
      { patient_id: uuid("المريض"), service_id: uuid("الخدمة"), from_date: str("YYYY-MM-DD"), to_date: str("YYYY-MM-DD") },
      ["patient_id", "service_id", "from_date", "to_date"],
    ),
  },
  {
    name: "block_doctor_day",
    description: "إغلاق يوم طبيب (إجازة، مؤتمر). المواعيد القائمة لا تُلغى تلقائياً.",
    parameters: obj({ doctor_id: uuid("الطبيب"), date: str("YYYY-MM-DD"), reason: str() }, ["doctor_id", "date"]),
  },
];

/* ── the patient file ────────────────────────────────────────────── */

const CLINICAL: ToolDecl[] = [
  {
    name: "create_patient",
    description: "تسجيل مريض جديد. يرفض التكرار إن كان الرقم مسجّلاً.",
    parameters: obj(
      {
        name: str("الاسم بالعربية كما ينطقه المستخدم"),
        phone: str("ثمانية أرقام عُمانية أو بصيغة +968"),
        gender: { ...str(), enum: ["male", "female"] },
        email: str(),
      },
      ["name", "phone"],
    ),
  },
  {
    name: "add_clinical_note",
    description: "ملاحظة سريرية على ملف المريض. تُنسب لك وتُسجّل بوقتها.",
    parameters: obj({ patient_id: uuid("المريض"), note: str("نصّ الملاحظة"), private: bool("لا تظهر للمريض") },
      ["patient_id", "note"]),
  },
  {
    name: "write_prescription",
    description: "كتابة وصفة طبية. لا تصفي دواءً من عندك — فقط ما طلبه الطبيب صراحةً.",
    parameters: obj(
      {
        patient_id: uuid("المريض"),
        diagnosis: str(),
        items: {
          type: "array",
          items: obj({ drug: str(), dosage: str(), frequency: str(), duration: str(), instructions: str() }, ["drug"]),
        },
      },
      ["patient_id", "items"],
    ),
  },
  {
    name: "draft_treatment_plan",
    description: "مسودّة خطة علاجية متعدّدة الزيارات. تُعرض على المريض للموافقة.",
    parameters: obj(
      {
        patient_id: uuid("المريض"),
        title: str("عنوان الخطة"),
        items: {
          type: "array",
          items: obj({ service_id: uuid("الخدمة"), description: str(), tooth: str("رقم السنّ"), qty: int() }, ["service_id"]),
        },
      },
      ["patient_id", "title", "items"],
    ),
  },
  { name: "complete_plan_item", description: "إنهاء بند من خطة علاجية.", parameters: obj({ item_id: uuid("البند") }, ["item_id"]) },
];

/* ── money ───────────────────────────────────────────────────────── */

const MONEY: ToolDecl[] = [
  {
    name: "invoice_appointment",
    description: "إصدار فاتورة لموعد بسعر الخدمة وضريبة القيمة المضافة.",
    parameters: obj({ appointment_id: uuid("الموعد"), discount: num("خصم بالريال") }, ["appointment_id"]),
  },
  {
    name: "record_payment",
    description: "تسجيل دفعة على فاتورة.",
    parameters: obj(
      {
        invoice_id: uuid("الفاتورة"),
        amount: num("المبلغ بالريال"),
        method: { ...str("طريقة الدفع"), enum: ["cash", "card", "transfer", "thawani"] },
        reference: str("رقم مرجعي"),
      },
      ["invoice_id", "amount", "method"],
    ),
  },
  {
    name: "submit_insurance_claim",
    description: "رفع مطالبة تأمين على فاتورة.",
    parameters: obj({ invoice_id: uuid("الفاتورة"), provider_id: uuid("شركة التأمين"), amount: num() },
      ["invoice_id", "provider_id"]),
  },
  {
    name: "add_service",
    description: "إضافة خدمة لقائمة خدمات العيادة.",
    parameters: obj({ name: str(), price: num("بالريال"), duration_minutes: int(), category: str() }, ["name", "price"]),
  },
];

/* ── reaching people, and producing things ───────────────────────── */

const OUTPUT: ToolDecl[] = [
  {
    name: "message_patient",
    description: "إرسال رسالة واتساب لمريض. تُسجَّل باسمك في سجلّ الرسائل.",
    parameters: obj({ patient_id: uuid("المريض"), text: str("نصّ الرسالة بالعربية") }, ["patient_id", "text"]),
  },
  {
    name: "queue_recovery",
    description:
      "تسليم مرضى للوكيل الذاتي ليتواصل معهم بنفسه خلال عشر دقائق، تحت ساعات الصمت وحدّ رسالة واحدة يومياً. " +
      "استعمليها بدل أن توصي بالتواصل: التوصية كلام، وهذه تنفيذ.",
    parameters: obj(
      { patient_ids: { type: "array", items: uuid("مريض") }, note: str("سبب المتابعة") },
      ["patient_ids"],
    ),
  },
  {
    name: "create_document",
    description:
      "بناء مستند مصمَّم يُعرض صفحةً جاهزة للطباعة و PDF — تحليل، خطة، دراسة. " +
      "ترسمين داخله مخطّطات من أرقام العيادة، ويمكن تضمين صورة ولّدتها. " +
      "لا تكتبي التحليل في الرسالة: مكانه المستند.",
    parameters: obj(
      { title: str("عنوان المستند"), brief: str("وصف دقيق للأقسام المطلوبة كلها") },
      ["title", "brief"],
    ),
  },
  {
    name: "open_document",
    description: "فتح تقرير الشهر الجاهز.",
    parameters: obj({ kind: { ...str(), enum: ["monthly_report"] }, month: str("YYYY-MM-DD لأي شهر") }, ["kind"]),
  },
  {
    name: "generate_image",
    description:
      "توليد صورة فعلية: غلاف تقرير، ملصق حملة، رسم توضيحي. " +
      "ممنوعة للصور الطبية أو أي صورة تخصّ مريضاً — الصورة المولَّدة ليست سجلاً طبياً.",
    parameters: obj(
      {
        prompt: str("وصف الصورة بالإنجليزية — نموذج الصور يفهمها أدقّ"),
        purpose: str("وصف عربي قصير يظهر تحت الصورة"),
        aspect: { ...str(), enum: ["landscape", "square", "portrait"] },
      },
      ["prompt"],
    ),
  },
];

/* Who may hold which tool.
 *
 * runAction re-checks the role at execution time and always will — a
 * declaration is a convenience, not a permission. But a model shown only
 * what it may do stops proposing what it may not, which is a better
 * conversation than one that offers and then apologises. */
export function toolsFor(role: Role): ToolDecl[] {
  if (role === "platform_admin") return READ;
  if (role === "accountant") return [...READ, ...MONEY, ...OUTPUT.filter((t) => t.name !== "message_patient")];
  if (role === "doctor") {
    return [
      ...READ,
      ...SCHEDULING.filter((t) => t.name !== "add_to_waitlist"),
      ...CLINICAL,
      ...OUTPUT.filter((t) => t.name !== "message_patient"),
    ];
  }
  if (role === "receptionist") return [...READ, ...SCHEDULING, ...CLINICAL.filter((t) => t.name === "create_patient"), ...OUTPUT];
  /* clinic_admin */
  return [...READ, ...SCHEDULING, ...CLINICAL, ...MONEY, ...OUTPUT];
}

/** Names that are read-only — used to decide whether a turn spent budget. */
export const READ_TOOLS = new Set(READ.map((t) => t.name));
