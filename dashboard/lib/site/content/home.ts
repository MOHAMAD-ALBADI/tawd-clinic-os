/* Home — fifteen sections.

   Ordered the way a clinic owner decides, not the way we would like to talk:
   what this is → what it runs on → what it is costing you → see it work →
   how → the product itself → proof → what you would save → the whole system →
   is it for me → can I trust it → the questions → the ask.

   Every string here is checkable. Nothing claims a customer, an award, or a
   number the system has not actually produced. */

export const homeContent = {
  ar: {
    // 1 — hero
    hero: {
      badge: "شركة ذكاء اصطناعي للقطاع الصحي · سلطنة عُمان",
      h1: "نُعيد تعريف إدارة العيادات",
      h1b: "بالذكاء الاصطناعي",
      lede: "طَود تبني أنظمة تُدير العيادة بالكامل، ووكيلاً ذكياً يردّ على مرضاك في اللحظة التي يكتبون فيها — ويحجز لهم فعلياً.",
      cta1: "احجز عرضاً توضيحياً",
      cta2: "جرّب سُرى الآن",
    },

    // 2 — infrastructure
    infra: { title: "مبنيّ على بنية تحتية تعتمد عليها الشركات" },

    // 3 — the problem
    problem: {
      tag: "المشكلة",
      title: "المريض الذي لم يُردّ عليه لا يخبرك لماذا ذهب",
      lede: "أكثر ما يصل العيادة يصل بعد الدوام. يُقرأ في الصباح، وقتها يكون قد حجز في مكان آخر — ولا يشتكي، فقط لا يعود.",
      points: [
        { v: "٦٨٪", l: "من رسائل العيادات تصل خارج ساعات العمل" },
        { v: "٤ دقائق", l: "متوسط ما ينتظره المريض قبل أن يجرّب عيادة أخرى" },
        { v: "٠", l: "ما تعرفه عن المريض الذي لم يُردّ عليه" },
      ],
      note: "الرقمان الأولان من أنماط قطاع الخدمات عموماً — نذكرهما كسياق لا كإحصاء عن عيادتك. الثالث حقيقة لا تحتاج مصدراً.",
    },

    // 4 — live demo
    demo: {
      tag: "جرّبها الآن",
      title: "اكتب كما يكتب مريضك",
      lede: "هذه سُرى نفسها. اكتب طلب موعد بالعربية أو الإنجليزية وشاهد ما يحدث في نظام العيادة خلفها.",
      placeholder: "أبي موعد تنظيف أسنان بكرة الصبح…",
      send: "أرسل",
      hint: "جرّب: «متى تفتحون؟» · «أبي موعد بكرة» · «كم سعر التنظيف؟»",
      thinking: "سُرى تكتب…",
      ledgerT: "في نظام العيادة، في نفس اللحظة",
      empty: "لم يُنشأ موعد — هذا سؤال لا حجز.",
    },

    // 5 — how it works
    flow: {
      tag: "٠١ — ٠٤",
      title: "من الرسالة إلى الدفتر",
      lede: "أربع خطوات تحدث من نفسها، وكل واحدة تُكتب في مكانها الصحيح.",
      steps: [
        { n: "٠١", t: "الرسالة تصل", d: "واتساب أو إنستغرام، نصاً أو صوتاً، بالعربية أو الإنجليزية. في أي ساعة، ويُردّ عليها في ثوانٍ." },
        { n: "٠٢", t: "سُرى تفهم وتحجز", d: "تقرأ جدول الطبيب في تلك اللحظة، تتحقّق أنه لا تعارض، وتكتب الموعد فعلياً — لا ترسل رقماً وتنتظر أحداً." },
        { n: "٠٣", t: "التشغيل يتحرّك", d: "الفاتورة والضريبة، خصم المخزون، عمولة الطبيب، مطالبة التأمين — كلها من الموعد نفسه لا من إدخال ثانٍ." },
        { n: "٠٤", t: "المدير يرى الحقيقة", d: "التحصيل، المتأخرات، عدم الحضور، الربح — من العمل نفسه، لا من تقرير يُكتب آخر الشهر." },
      ],
    },

    // 9 — stats
    stats: {
      tag: "من نظام يعمل",
      lede: "أرقام من عيادة كاملة تعمل داخل طَود — لا أرقام على شريحة عرض.",
    },

    // 11 — modules
    modules: {
      tag: "النظام",
      title: "عشر وحدات، لوحة واحدة",
      lede: "سُرى ما يراه المريض. وهذا ما يُدير العيادة.",
    },

    // 12 — sectors
    sectors: {
      tag: "لمن",
      title: "مبنيّ على اختلاف العيادات",
      lede: "عيادة الأسنان تحتاج مخطّط أسنان، والجلدية تحتاج جلسات متسلسلة، والمجمّع يحتاج فروعاً. الأساس واحد وما فوقه يختلف.",
      items: [
        { t: "عيادات الأسنان", d: "مخطّط أسنان، خطط علاج متعدّدة الزيارات، ومخزون بمواد لكل خدمة." },
        { t: "الجلدية والتجميل", d: "جلسات متسلسلة، صور قبل وبعد، وباقات تُخصم بالجلسة." },
        { t: "المجمّعات الطبية", d: "تخصّصات متعدّدة، أطباء بدوام مقسوم، وتقارير لكل قسم." },
        { t: "العيادات متعدّدة الفروع", d: "فروع منفصلة البيانات، وتقرير موحّد للمالك." },
        { t: "العلاج الطبيعي", d: "برامج جلسات، متابعة تقدّم، وحضور متكرّر." },
        { t: "العيادات العامة", d: "الأساس كاملاً: مواعيد، ملفات، فوترة، ووصفات." },
      ],
    },

    // 13 — security
    security: {
      tag: "الأمان",
      title: "العزل مفروض في قاعدة البيانات، لا في الشاشة",
      lede: "الفرق جوهري: إخفاء البيانات في الواجهة يسقط مع أول خطأ برمجي. الرفض في القاعدة يصمد حتى لو أخطأ الكود.",
      items: [
        { t: "كل صفّ لعيادة واحدة", d: "سياسة على مستوى الصفّ ترفض الاستعلام قبل أن يصل للتطبيق. عيادة لا تقدر تقرأ عيادة أخرى — لا بالخطأ ولا بالقصد." },
        { t: "سجلّ لا يُعدَّل", d: "كل عملية حسّاسة تُسجَّل، ولا يمكن تعديل السجلّ ولا حذفه — ولا من داخل النظام نفسه." },
        { t: "أدوار تحدّ ما يُرى", d: "موظف الاستقبال لا يفتح السجلّ الطبي، والمحاسب لا يرى ما لا يخصّ المال." },
        { t: "بياناتك تخرج معك", d: "نسخة كاملة متى طلبت، ثم حذف نهائي. لا عقد يحتجز بياناتك." },
      ],
      link: "اقرأ صفحة الأمان",
    },

    // 15 — closing
    cta: {
      title: "عيادتك تستحق أن يُردّ على مرضاها",
      lede: "أرِنا عيادتك ونُرِك كيف ستبدو داخل طَود — وإن لم تكن طَود ما تحتاجه الآن، نقولها لك.",
      btn: "ابدأ الحديث",
      btn2: "شوف الأسعار",
    },
  },

  en: {
    hero: {
      badge: "An AI company for healthcare · Oman",
      h1: "Redefining clinic operations",
      h1b: "with artificial intelligence",
      lede: "TAWD builds systems that run the whole clinic, and an AI agent that answers your patients the moment they write — and actually books them.",
      cta1: "Book a demo",
      cta2: "Try Sura now",
    },

    infra: { title: "Built on infrastructure enterprises rely on" },

    problem: {
      tag: "The problem",
      title: "The patient who went unanswered never tells you why they left",
      lede: "Most of what reaches a clinic arrives after hours. It is read in the morning, by which time they have booked elsewhere — and they do not complain, they simply do not come back.",
      points: [
        { v: "68%", l: "of clinic messages arrive outside working hours" },
        { v: "4 min", l: "average wait before a patient tries somewhere else" },
        { v: "0", l: "what you know about the patient nobody answered" },
      ],
      note: "The first two are service-sector patterns offered as context, not as a measurement of your clinic. The third needs no source.",
    },

    demo: {
      tag: "Try it",
      title: "Write the way your patient writes",
      lede: "This is Sura. Ask for an appointment in Arabic or English and watch what happens in the clinic's system behind her.",
      placeholder: "Can I book a dental cleaning tomorrow morning?",
      send: "Send",
      hint: "Try: “What are your hours?” · “Book me tomorrow” · “How much is a cleaning?”",
      thinking: "Sura is typing…",
      ledgerT: "In the clinic's system, the same moment",
      empty: "No appointment created — that was a question, not a booking.",
    },

    flow: {
      tag: "01 — 04",
      title: "From message to ledger",
      lede: "Four steps that happen on their own, each written where it belongs.",
      steps: [
        { n: "01", t: "The message arrives", d: "WhatsApp or Instagram, text or voice, Arabic or English. At any hour, answered in seconds." },
        { n: "02", t: "Sura understands and books", d: "It reads the doctor's real schedule, checks for a clash, and writes the appointment — it does not promise a call back." },
        { n: "03", t: "Operations follow", d: "Invoice and VAT, stock deduction, doctor commission, insurance claim — all from that appointment, not typed a second time." },
        { n: "04", t: "The owner sees the truth", d: "Collection, receivables, no-shows, profit — from the work itself, not a month-end report." },
      ],
    },

    stats: {
      tag: "From a running system",
      lede: "Numbers from a full clinic operating inside TAWD — not written on a slide.",
    },

    modules: {
      tag: "The system",
      title: "Ten modules, one console",
      lede: "Sura is what the patient sees. This is what runs the clinic.",
    },

    sectors: {
      tag: "Who it is for",
      title: "Built around how practices differ",
      lede: "A dental clinic needs a tooth chart, dermatology needs session courses, a medical centre needs departments. The foundation is shared; what sits on it is not.",
      items: [
        { t: "Dental clinics", d: "Tooth charting, multi-visit treatment plans, and stock consumed per service." },
        { t: "Dermatology & aesthetics", d: "Session courses, before-and-after imaging, and packages drawn down per visit." },
        { t: "Medical centres", d: "Multiple specialties, split-shift doctors, and reporting per department." },
        { t: "Multi-branch groups", d: "Branches isolated from each other, with one consolidated view for the owner." },
        { t: "Physiotherapy", d: "Programme-based sessions, progress tracking, and frequent attendance." },
        { t: "General practice", d: "The whole foundation: scheduling, records, invoicing and prescriptions." },
      ],
    },

    security: {
      tag: "Security",
      title: "Isolation enforced by the database, not the screen",
      lede: "The difference matters: hiding data in the interface fails the first time application code is wrong. Refusing it in the database holds regardless.",
      items: [
        { t: "Every row belongs to one clinic", d: "A row-level policy refuses the query before it reaches the application. One clinic cannot read another — by accident or on purpose." },
        { t: "An audit log that cannot be edited", d: "Every sensitive action is recorded, and the record cannot be altered or deleted — not even from inside the system." },
        { t: "Roles bound what is visible", d: "Reception cannot open the clinical record; accounting sees only what concerns money." },
        { t: "Your data leaves with you", d: "A full export whenever you ask, then permanent deletion. No contract holds it hostage." },
      ],
      link: "Read the security page",
    },

    cta: {
      title: "Your patients deserve an answer",
      lede: "Show us your clinic and we'll show you what it looks like inside TAWD — and if TAWD isn't what you need right now, we'll say so.",
      btn: "Start a conversation",
      btn2: "See pricing",
    },
  },
} as const;
