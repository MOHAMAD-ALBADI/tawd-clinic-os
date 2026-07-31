/* The changelog.

   Curated from real work, not dumped from git. A commit log is written for
   whoever maintains the code — "fix: net_total is a generated column" tells a
   clinic owner nothing. Every line below is a change a customer would notice,
   and every one of them actually shipped.

   Newest first. When a month has nothing a customer would notice, it does not
   get an entry; padding a changelog is how it stops being read. */

export type Entry = { kind: "new" | "fix" | "better"; ar: string; en: string; arD?: string; enD?: string };
export type Month = { id: string; ar: string; en: string; items: Entry[] };

export const CHANGELOG: Month[] = [
  {
    id: "2026-07",
    ar: "يوليو ٢٠٢٦",
    en: "July 2026",
    items: [
      {
        kind: "new", ar: "موقع طَود الرسمي", en: "The TAWD company site",
        arD: "موقع عام كامل بدل صفحة تسجيل دخول: المنتجات، الحلول، منصّة الذكاء، الأمان، والتسعير — بالعربية والإنجليزية.",
        enD: "A full public site in place of a login screen: products, solutions, the AI platform, security and pricing — in Arabic and English.",
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
        kind: "fix", ar: "الحملات كانت تُسجَّل ولا تُرسل", en: "Campaigns were recorded but never sent",
        arD: "كانت الحملة تُسجَّل «تعمل» ولا تصل رسالة واحدة. الإرسال الآن داخل النظام، ولكل مستقبِل حالته وسبب إخفاقه إن أخفق.",
        enD: "A campaign was marked running and not one message went out. Sending now happens in the system, with a per-recipient result and a real reason on failure.",
      },
      {
        kind: "fix", ar: "إشعارات المنصّة كانت تخرج من رقم عيادة", en: "Platform notices were sent from a clinic's number",
        arD: "كل رسالة من طَود لعملائها كانت تُرسل من رقم واتساب أول عيادة في القائمة. صارت تُرسل من رقم المنصّة نفسه.",
        enD: "Every message TAWD sent its customers left from the first clinic's WhatsApp number. It now sends from the platform's own.",
      },
      {
        kind: "better", ar: "الردود العربية أطول وأوضح", en: "Arabic replies got longer and clearer",
        arD: "كانت سُرى تقطع ردّها عند ثلاثين حرفاً بسبب حدّ في إعدادات النموذج. الآن تردّ بطول يناسب السؤال.",
        enD: "Sura was cutting replies off at about thirty characters because of a model budget limit. It now answers at a length that fits the question.",
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
        kind: "fix", ar: "التذكيرات كانت تُرسل لأول مريض فقط", en: "Reminders were reaching only the first patient",
        arD: "سير التذكير كان يعالج أول موعد ويتوقّف. أُصلح، ويعمل منذ ذلك الحين بلا إخفاق.",
        enD: "The reminder workflow processed the first appointment and stopped. Fixed, and running without failure since.",
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
