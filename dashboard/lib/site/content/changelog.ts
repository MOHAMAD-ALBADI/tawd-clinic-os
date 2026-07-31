/* The changelog.

   Curated from real work, not dumped from git. A commit log is written for
   whoever maintains the code — a clinic owner reads nothing useful in it.
   Every line below is a capability a customer would notice, and every one of
   them shipped.

   Two kinds only: new, and improved. A public changelog is a sales document
   before it is a technical one, and a list of past defects is an argument
   against buying written in the vendor's own hand.

   Newest first. A month with nothing a customer would notice gets no entry;
   padding a changelog is how it stops being read. */

export type Entry = { kind: "new" | "better"; ar: string; en: string; arD?: string; enD?: string };
export type Month = { id: string; ar: string; en: string; items: Entry[] };

export const CHANGELOG: Month[] = [
  {
    id: "2026-07",
    ar: "يوليو ٢٠٢٦",
    en: "July 2026",
    items: [
      {
        kind: "new", ar: "موقع طَود الرسمي", en: "The TAWD company site",
        arD: "موقع الشركة الرسمي: النظام، والحلول حسب التخصّص، وسُرى، والأمان، والتسعير — بالعربية والإنجليزية.",
        enD: "The official company site: the system, solutions by speciality, Sura, security and pricing — in Arabic and English.",
      },
      {
        kind: "new", ar: "عرض سُرى الحيّ", en: "A live Sura demo",
        arD: "صندوق محادثة على الموقع يكتب فيه الزائر ويشاهد الموعد يُنشأ — أو لا يُنشأ حين تكون رسالته سؤالاً.",
        enD: "A chat box on the site where a visitor types and watches an appointment appear — or not, when the message was a question.",
      },
      {
        kind: "new", ar: "ربط واتساب بنقرة للعيادة", en: "One-click WhatsApp connection for a clinic",
        arD: "شاشة ربط تتحقّق من ميتا أن الرمز يملك الرقم قبل أن تحفظ أي شيء، وتنسخ مفاتيح المنصّة للعيادة تلقائياً.",
        enD: "A connect screen that verifies with Meta that the token controls the number before saving anything, and copies the platform keys across automatically.",
      },
      {
        kind: "new", ar: "سجلّ حركة المخزون وإتلاف الدفعات", en: "Stock movement ledger and batch write-offs",
        arD: "كل صنف يخرج ومن أخذه ولماذا، وإمكانية إتلاف دفعة منتهية الصلاحية بقيمتها الحقيقية.",
        enD: "Every item that leaves, who took it and why — and a way to write off an expired batch at what it actually cost.",
      },
      {
        kind: "new", ar: "الحملات التسويقية من داخل اللوحة", en: "Marketing campaigns from the dashboard",
        arD: "اختر شريحة من مرضاك، اكتب الرسالة، وأرسلها — مع حالة تسليم لكل مستقبِل وسبب واضح إن لم تصل.",
        enD: "Pick a segment of your patients, write the message, send it — with a delivery state per recipient and a clear reason when one does not arrive.",
      },
      {
        kind: "better", ar: "ردود عربية أطول وأدقّ", en: "Longer, sharper Arabic replies",
        arD: "سُرى تردّ الآن بطول يناسب السؤال، وبصياغة عربية أقرب لطريقة كلام موظّف استقبال محترف.",
        enD: "Sura now answers at a length that fits the question, in Arabic closer to how a professional receptionist actually speaks.",
      },
    ],
  },
  {
    id: "2026-06",
    ar: "يونيو ٢٠٢٦",
    en: "June 2026",
    items: [
      {
        kind: "new", ar: "سُرى على إنستغرام", en: "Sura on Instagram",
        arD: "نفس الوكيل ونفس السياق، على الرسائل المباشرة.",
        enD: "The same agent and the same context, on direct messages.",
      },
      {
        kind: "new", ar: "وحدة التأمين", en: "The insurance module",
        arD: "تغطيات المرضى، مطالبات تُرسل وتُتابع، وما قُبل وما رُفض.",
        enD: "Patient coverage, claims submitted and tracked, and what was approved versus rejected.",
      },
      {
        kind: "new", ar: "عمولات الأطباء والموافقات الرقمية", en: "Doctor commissions and digital consents",
        arD: "عمولة تُحتسب مع الفوترة ثم تُعتمد وتُدفع، وإقرارات المريض موقّعة رقمياً في ملفه.",
        enD: "Commission accrued at invoicing then approved and paid, and patient consents signed digitally on the file.",
      },
      {
        kind: "new", ar: "الرواتب والمصروفات وحساب الربح", en: "Payroll, expenses and profit",
        arD: "حضور ومسيّرات رواتب ومصروفات، وربح شهري محسوب من العمل لا مقدَّر.",
        enD: "Attendance, payroll runs and expenses, with a monthly profit computed from the work rather than estimated.",
      },
      {
        kind: "better", ar: "تذكير المواعيد على كامل جدول اليوم", en: "Reminders across the whole day's schedule",
        arD: "كل موعد في اليوم التالي يستلم تذكيره، ويقبل التأكيد أو الإلغاء بردّ واحد.",
        enD: "Every appointment on the following day gets its reminder, and accepts a confirm or a cancel in one reply.",
      },
    ],
  },
  {
    id: "2026-05",
    ar: "مايو ٢٠٢٦",
    en: "May 2026",
    items: [
      {
        kind: "new", ar: "سُرى تسمع وتتكلّم", en: "Sura listens and speaks",
        arD: "الرسائل الصوتية تُفرَّغ نصاً ويُردّ عليها، وبإمكانها الردّ صوتاً.",
        enD: "Voice notes are transcribed and answered, and it can reply in voice.",
      },
      {
        kind: "new", ar: "المخزون والصيدلية", en: "Inventory and pharmacy",
        arD: "دفعات وصلاحيات، خصم تلقائي مع كل خدمة تُفوتر، وصرف الوصفات.",
        enD: "Batches and expiry, automatic deduction as each service is billed, and prescription dispensing.",
      },
      {
        kind: "new", ar: "لوحات الاستقبال والمحاسبة", en: "Reception and accounting consoles",
        arD: "غرفة انتظار ومناداة عبر واتساب، وصندوق نقدي بضريبة عُمان وإقفال يومي.",
        enD: "A waiting room with WhatsApp calling, and a till with Omani VAT and a daily close.",
      },
      {
        kind: "better", ar: "دوام مقسوم للأطباء", en: "Split shifts for doctors",
        arD: "صباحي ومسائي لنفس الطبيب في اليوم نفسه، ومنع التعارض يفهم الاثنين.",
        enD: "Morning and evening for the same doctor on the same day, with clash prevention that understands both.",
      },
    ],
  },
];
