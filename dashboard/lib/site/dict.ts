/* Every word on the company site, in both languages, in one place.

   A toggle rather than stacked translations: Oman has English-speaking clinics
   and Arabic-speaking ones, and asking either to scroll past the other's copy
   to reach their own is a small insult repeated on every page.

   The English is not a translation of the Arabic. Both are written for the
   person who reads in that language — the Arabic leads with what a clinic
   owner feels at 11pm, the English leads with what an operator wants to know.
   Running Arabic through a translator produces copy that is technically right
   and reads like an import. */

export type Lang = "ar" | "en";

export const dict = {
  ar: {
    dir: "rtl" as const,
    brand: "طَود",
    nav: {
      product: "المنتج",
      pricing: "الأسعار",
      faq: "أسئلة شائعة",
      about: "عن طَود",
      contact: "تواصل",
      login: "دخول",
      menu: "القائمة",
      close: "إغلاق",
    },

    home: {
      eyebrow: "مساعد ذكي داخل واتساب · سلطنة عُمان",
      title1: "رسالة واحدة",
      title2: "تصير موعداً مؤكّداً",
      lede:
        "سُرى تردّ على مرضى عيادتك في واتساب وإنستغرام، تفهم ما يريدونه، وتحجز لهم موعداً حقيقياً في نظام العيادة — بلا موظّف ينتظر الرسالة.",
      ctaPrimary: "اطلب عرضاً",
      ctaSecondary: "شوف كيف تعمل",

      chatHeader: "واتساب العيادة",
      chatIn: "مساء الخير، أبي موعد تنظيف أسنان بكرة الصبح",
      chatTyping: "سُرى تكتب…",
      chatOut:
        "أهلاً وسهلاً 👋\n\nمتوفّر لدينا غداً الساعة ٩:٠٠ صباحاً مع د. سارة البلوشي.\n\nأثبّته لك؟",
      chatConfirm: "إي ثبتيه",
      ledgerLabel: "في نظام العيادة، في نفس اللحظة",
      ledgerService: "تنظيف وتلميع الأسنان",
      ledgerDoctor: "د. سارة البلوشي",
      ledgerStatus: "مؤكّد",
      replay: "أعد التشغيل",

      stripTitle: "لا تُدار عيادة برسائل لا يقرؤها أحد",
      stripBody:
        "أكثر ما يصل العيادة يصل بعد الدوام، وأغلبه لا يُقرأ إلا في الصباح — وقتها يكون المريض قد حجز في مكان آخر.",

      flowTitle: "من الرسالة إلى الدفتر",
      flowLede: "أربع خطوات تحدث من نفسها، وكل واحدة منها تُكتب في مكانها الصحيح.",
      flow: [
        {
          n: "١",
          t: "الرسالة تصل",
          d: "واتساب أو إنستغرام، نصاً أو رسالة صوتية، بالعربية أو بالإنجليزية. تصل في أي ساعة ويُردّ عليها في ثوانٍ.",
        },
        {
          n: "٢",
          t: "سُرى تفهم وتحجز",
          d: "تقرأ جدول الطبيب الحقيقي في تلك اللحظة، تتحقّق أنه لا يوجد تعارض، وتكتب الموعد فعلياً — لا ترسل رقماً وتنتظر أحداً.",
        },
        {
          n: "٣",
          t: "التشغيل يتحرّك خلفها",
          d: "الفاتورة وضريبة القيمة المضافة، خصم المخزون، عمولة الطبيب، مطالبة التأمين — كلها تُحسب من الموعد نفسه لا من إدخال ثانٍ.",
        },
        {
          n: "٤",
          t: "المدير يرى الحقيقة",
          d: "نسبة التحصيل، المتأخرات، عدم الحضور، الربح — أرقام مأخوذة من العمل نفسه، لا من تقرير يكتبه أحد آخر آخر الشهر.",
        },
      ],

      proofTitle: "أرقام من نظام يعمل",
      proofLede:
        "مأخوذة من عيادة كاملة تعمل داخل طَود — لا أرقام مكتوبة على شريحة عرض.",
      proof: [
        { v: "312", l: "فاتورة صادرة" },
        { v: "85.6%", l: "نسبة التحصيل" },
        { v: "7.7%", l: "عدم الحضور" },
        { v: "500+", l: "موعد مُدار" },
      ],
      proofNote:
        "العيادة أعلاه بيئة تشغيل كاملة نختبر عليها كل شيء قبل أن يصل إلى عيادة حقيقية.",

      depthTitle: "وتحتها نظام عيادة كامل",
      depthLede:
        "سُرى هي ما يراه المريض. أمّا ما يُدير العيادة فعلياً فهو ما تحتها.",
      depth: [
        { t: "المواعيد والأطباء", d: "دوام مقسوم، إجازات، ومنع التعارض على مستوى قاعدة البيانات." },
        { t: "الفوترة والضريبة", d: "فواتير بضريبة ٥٪، مدفوعات جزئية، ذمم، وإشعارات دائن." },
        { t: "المخزون والصيدلية", d: "دفعات وصلاحيات، خصم تلقائي مع كل خدمة، وسجلّ حركة كامل." },
        { t: "الرواتب والمصروفات", d: "حضور، مسيّرات رواتب، مصروفات، وربح شهري محسوب لا مقدَّر." },
        { t: "التأمين", d: "تغطيات المرضى، مطالبات، ومتابعة ما قُبل وما رُفض." },
        { t: "خطط العلاج", d: "خطط متعدّدة الزيارات، قبول المريض، ونسبة الإنجاز." },
        { t: "الوصفات والصيدلية", d: "وصفة موقّعة من الطبيب، وصرف يخصم من المخزون بنفسه." },
        { t: "الولاء والحملات", d: "نقاط تُكتسب بالإنفاق وتُستبدل عند الدفع، وحملات واتساب من اللوحة." },
        { t: "عمولات الأطباء", d: "تُحتسب مع الفوترة، تُعتمد، ثم تُدفع وتُقيَّد مصروفاً." },
        { t: "الموافقات الرقمية", d: "إقرارات المريض موقّعة رقمياً ومحفوظة في ملفه." },
      ],

      ctaTitle: "عيادتك تستحق أن يُردّ على مرضاها",
      ctaBody: "أرِنا عيادتك ونُرِك كيف ستبدو داخل طَود.",
      ctaButton: "ابدأ الحديث",
    },

    product: {
      eyebrow: "المنتج",
      title: "ما الذي يعمل فعلياً",
      lede:
        "طَود ليس تطبيق حجز فوقه ردّ آلي. هو نظام تشغيل عيادة، وسُرى هي واجهته أمام المريض.",
      suraTitle: "سُرى",
      suraLede:
        "وكيل يقرأ حالة العيادة ويكتب فيها. الفرق بينه وبين ردّ آلي أنه يفعل شيئاً، لا أن يقول شيئاً.",
      suraPoints: [
        { t: "تحجز فعلاً", d: "تكتب الموعد في قاعدة البيانات بعد فحص جدول الطبيب والتعارض — لا تعد المريض بأن أحداً سيتواصل معه." },
        { t: "تفهم الصوت", d: "الرسالة الصوتية تُفرَّغ نصاً ويُردّ عليها، وبإمكانها الردّ صوتاً." },
        { t: "لغتان", d: "تكتشف لغة المريض وتردّ بها — عربية أو إنجليزية." },
        { t: "تعرف المراجع", d: "تميّز المريض القديم من الجديد وتخاطبه على هذا الأساس." },
        { t: "تتوقّف عند الخطر", d: "عند اشتباه حالة طارئة تتوقّف وتُنبّه فريق العيادة فوراً بدل أن تجتهد." },
        { t: "لا تشخّص", d: "لا تعطي رأياً طبياً ولا تصف علاجاً. حدودها مكتوبة في تعليماتها." },
      ],
      opsTitle: "النظام تحتها",
      screensTitle: "من داخل النظام",
      screensLede: "لقطات من طَود وهو يعمل.",
    },

    pricing: {
      eyebrow: "الأسعار",
      title: "تسعير يُبنى على عيادتك",
      lede:
        "عدد الأطباء، والوحدات التي تحتاجها فعلاً، وحجم الرسائل — ثلاثة أشياء تختلف من عيادة لأخرى، فلا يوجد رقم واحد صادق لكل العيادات.",
      whatTitle: "ما يشمله الاشتراك دائماً",
      what: [
        "سُرى على واتساب",
        "المواعيد وجداول الأطباء",
        "ملفات المرضى والسجلّ الطبي",
        "الفوترة وضريبة القيمة المضافة",
        "التقارير الإدارية",
        "تدريب الفريق والدعم",
      ],
      modulesTitle: "وحدات تُضاف عند الحاجة",
      modules: [
        "المخزون والصيدلية",
        "الرواتب والحضور",
        "التأمين والمطالبات",
        "خطط العلاج",
        "برنامج الولاء",
        "الدفع الإلكتروني",
      ],
      ctaTitle: "خلّنا نحسبها لعيادتك",
      ctaBody: "محادثة قصيرة عن حجم عيادتك تكفي لنعطيك رقماً واضحاً بلا مفاجآت.",
      ctaButton: "اطلب عرض سعر",
      note: "لا رسوم مخفيّة، ولا عقد يمنعك من الخروج ببياناتك.",
    },

    faq: {
      eyebrow: "أسئلة شائعة",
      title: "الأسئلة التي تُسأل فعلاً",
      items: [
        {
          q: "هل سأخسر رقم واتساب عيادتي الحالي؟",
          a: "لا. الطريقة الأسهل أن يبقى رقمك الحالي كما هو ويأخذ الحجز خطاً مخصّصاً لسُرى. وهناك طريقة تعمل على رقمك نفسه ويظل تطبيق واتساب الأعمال شغّالاً عليه بجانبها — نشرحها لك حسب وضع عيادتك.",
        },
        {
          q: "هل تستطيع سُرى أن تعطي رأياً طبياً؟",
          a: "لا، ولا يُفترض بها. لا تشخّص ولا تصف علاجاً. وعند أي إشارة لحالة طارئة تتوقّف وتُنبّه فريق العيادة. القرار السريري للطبيب المرخّص وحده.",
        },
        {
          q: "أين تُحفظ بيانات مرضانا؟ ومن يصل إليها؟",
          a: "البيانات ملك العيادة لا ملك طَود. كل صفّ مرتبط بعيادة واحدة، والعزل مفروض في قاعدة البيانات نفسها — أي أن الوصول يُرفض حتى لو أخطأ الكود، لا مجرّد إخفاء في الواجهة. ولكل موظّف دور يحدّد ما يراه.",
        },
        {
          q: "ماذا لو أردنا الخروج؟",
          a: "تُسلَّم لك نسخة كاملة من بياناتك، ثم تُحذف نهائياً بطلبك. لا عقد يحتجز بياناتك.",
        },
        {
          q: "كم يستغرق التشغيل؟",
          a: "الإعداد الأساسي — الخدمات، الأطباء، الدوام، وربط واتساب — يُنجز في يوم عمل. ونبقى معك في الأسبوع الأول حتى يستقرّ الفريق عليه.",
        },
        {
          q: "هل يعمل مع عيادة صغيرة؟",
          a: "نعم، وهي أكثر من يستفيد. عيادة بطبيب واحد لا تملك موظّفاً يجلس للرسائل — وهذا بالضبط ما تسدّه سُرى.",
        },
        {
          q: "هل هذي شركة حقيقية أم مشروع جانبي؟",
          a: "شركة عُمانية يقودها مؤسّسها، وطَود منتجها الوحيد — يُبنى ويُشغَّل ويُصان يومياً. صفحاتنا القانونية وسياسة الخصوصية منشورة وقابلة للقراءة قبل أن توقّع شيئاً.",
        },
      ],
      moreTitle: "سؤال غير موجود هنا؟",
      moreBody: "اسأله مباشرة — نردّ بأنفسنا.",
    },

    about: {
      eyebrow: "عن طَود",
      title: "طَود",
      meaning: "طَود: الجبل الراسخ الذي لا يتزحزح.",
      lede:
        "شركة برمجيات عُمانية تبني نظام تشغيل للعيادات، ووكيلاً ذكياً يردّ على مرضاها.",
      storyTitle: "لماذا بُني",
      story: [
        "أغلب العيادات في عُمان تُدار على دفتر ومجموعة واتساب. لا لأن أصحابها لا يريدون أفضل، بل لأن ما هو معروض عليهم إمّا نظام أجنبي لا يعرف الضريبة العُمانية ولا يكتب العربية بشكل صحيح، أو تطبيق حجز لا يعرف شيئاً عمّا يحدث بعد الحجز.",
        "وفي الحالتين تبقى نفس المشكلة: الرسائل تصل بعد الدوام ولا يقرؤها أحد، والمريض الذي لم يُردّ عليه يذهب لغيرك ولا يخبرك لماذا.",
        "طَود بُني لهذا: أن يُردّ على المريض في اللحظة التي كتب فيها، وأن يتحوّل ردّه إلى موعد وفاتورة وسجلّ — دون أن يكتب أحد شيئاً مرتين.",
      ],
      founderTitle: "المؤسّس",
      founderName: "محمد البادي",
      founderRole: "المؤسّس والرئيس التنفيذي",
      founderBio:
        "بنيت طَود بالكامل — النظام، وسُرى، وكل قرار فيهما. من شكل الفاتورة إلى الكلمة التي تقولها سُرى لمريض يكتب في منتصف الليل.\n\nأعمل مع العيادات مباشرة، بلا طبقة بيني وبينها. حين تتصل عيادة، أنا من يردّ.",
      principlesTitle: "ما نلتزم به",
      principles: [
        { t: "بياناتك لك", d: "لا نستخدم بيانات عيادة لغرضنا، ولا نشاركها مع عيادة أخرى، وتخرج بها متى شئت." },
        { t: "لا نَعِد بما لم يُبنَ", d: "ما تراه في هذا الموقع موجود ويعمل. وما لم يُبنَ بعد نقوله كما هو." },
        { t: "الطبّ للطبيب", d: "طَود أداة تشغيل. القرار السريري لصاحبه، وسُرى لا تقترب منه." },
      ],
    },

    contact: {
      eyebrow: "تواصل",
      title: "خلّنا نتكلّم",
      lede:
        "أخبرنا عن عيادتك — عدد الأطباء وما يرهقك اليوم — ونرجع لك برأي واضح، حتى لو كان أن طَود ليس ما تحتاجه الآن.",
      nameL: "الاسم",
      clinicL: "اسم العيادة",
      phoneL: "رقم التواصل",
      emailL: "البريد الإلكتروني",
      msgL: "ما الذي تريد حلّه؟",
      msgPlaceholder: "مثال: عندنا ثلاثة أطباء، والرسائل بعد الدوام تضيع علينا مرضى.",
      send: "أرسل",
      sending: "جارٍ الإرسال…",
      sent: "وصلتنا رسالتك — نرجع لك قريباً.",
      failed: "تعذّر الإرسال. راسلنا مباشرة على البريد أدناه.",
      required: "الاسم ورقم التواصل وسؤالك — هذي الثلاثة نحتاجها للردّ عليك.",
      directTitle: "أو مباشرة",
      emailV: "playmoham19@gmail.com",
      instaV: "tawd.os",
    },

    footer: {
      tagline: "نظام تشغيل العيادات — سلطنة عُمان",
      company: "الشركة",
      product: "المنتج",
      legalT: "القانونية",
      privacy: "سياسة الخصوصية",
      terms: "شروط الاستخدام",
      deletion: "حذف البيانات",
      rights: "جميع الحقوق محفوظة",
      built: "يُبنى في عُمان",
    },
  },

  en: {
    dir: "ltr" as const,
    brand: "TAWD",
    nav: {
      product: "Product",
      pricing: "Pricing",
      faq: "FAQ",
      about: "Company",
      contact: "Contact",
      login: "Sign in",
      menu: "Menu",
      close: "Close",
    },

    home: {
      eyebrow: "An AI agent inside WhatsApp · Oman",
      title1: "One message,",
      title2: "one confirmed appointment",
      lede:
        "Sura answers your patients on WhatsApp and Instagram, works out what they need, and books a real appointment in the clinic's system — with nobody waiting to read the message.",
      ctaPrimary: "Request a demo",
      ctaSecondary: "See how it works",

      chatHeader: "Clinic WhatsApp",
      chatIn: "Hi — can I get a dental cleaning tomorrow morning?",
      chatTyping: "Sura is typing…",
      chatOut:
        "Hello 👋\n\nWe have tomorrow at 9:00 AM with Dr. Sara Al Balushi.\n\nShall I confirm it for you?",
      chatConfirm: "Yes please",
      ledgerLabel: "In the clinic's system, the same moment",
      ledgerService: "Scale & polish",
      ledgerDoctor: "Dr. Sara Al Balushi",
      ledgerStatus: "Confirmed",
      replay: "Replay",

      stripTitle: "A clinic cannot run on messages nobody reads",
      stripBody:
        "Most of what reaches a clinic arrives after hours, and most of it is read the next morning — by which time the patient has booked somewhere else.",

      flowTitle: "From message to ledger",
      flowLede: "Four steps that happen on their own, each written where it belongs.",
      flow: [
        {
          n: "1",
          t: "The message arrives",
          d: "WhatsApp or Instagram, text or voice note, Arabic or English. It arrives at any hour and is answered in seconds.",
        },
        {
          n: "2",
          t: "Sura understands and books",
          d: "It reads the doctor's real schedule at that moment, checks for a clash, and writes the appointment — it does not promise that someone will call back.",
        },
        {
          n: "3",
          t: "Operations follow",
          d: "The invoice and its VAT, the stock deduction, the doctor's commission, the insurance claim — all computed from that appointment rather than typed a second time.",
        },
        {
          n: "4",
          t: "The owner sees the truth",
          d: "Collection rate, receivables, no-shows, profit — taken from the work itself, not from a report someone writes at month end.",
        },
      ],

      proofTitle: "Numbers from a running system",
      proofLede: "Taken from a full clinic operating inside TAWD — not written on a slide.",
      proof: [
        { v: "312", l: "invoices issued" },
        { v: "85.6%", l: "collection rate" },
        { v: "7.7%", l: "no-show rate" },
        { v: "500+", l: "appointments handled" },
      ],
      proofNote:
        "That clinic is a full operating environment where everything is tested before it reaches a real one.",

      depthTitle: "And a whole clinic system beneath it",
      depthLede: "Sura is what the patient sees. What actually runs the clinic is underneath.",
      depth: [
        { t: "Scheduling", d: "Split shifts, leave, and clash prevention enforced by the database itself." },
        { t: "Billing & VAT", d: "5% VAT invoices, partial payments, receivables, and credit notes." },
        { t: "Inventory & pharmacy", d: "Batches and expiry, automatic deduction per service, and a full movement ledger." },
        { t: "Payroll & expenses", d: "Attendance, payroll runs, expenses, and a monthly profit that is computed, not estimated." },
        { t: "Insurance", d: "Patient coverage, claims, and what was approved versus rejected." },
        { t: "Treatment plans", d: "Multi-visit plans, patient acceptance, and progress." },
        { t: "Prescriptions & pharmacy", d: "A prescription signed by the doctor, and dispensing that deducts stock by itself." },
        { t: "Loyalty & campaigns", d: "Points earned on spend and redeemed at the till, and WhatsApp campaigns from the console." },
        { t: "Doctor commissions", d: "Accrued at invoicing, approved, then paid and booked as an expense." },
        { t: "Digital consents", d: "Patient consents signed digitally and kept on the file." },
      ],

      ctaTitle: "Your patients deserve an answer",
      ctaBody: "Show us your clinic and we'll show you what it looks like inside TAWD.",
      ctaButton: "Start a conversation",
    },

    product: {
      eyebrow: "Product",
      title: "What actually runs",
      lede:
        "TAWD is not a booking app with a chatbot bolted on. It is a clinic operating system, and Sura is its face to the patient.",
      suraTitle: "Sura",
      suraLede:
        "An agent that reads the clinic's state and writes to it. What separates it from a chatbot is that it does something rather than says something.",
      suraPoints: [
        { t: "It really books", d: "It writes the appointment to the database after checking the doctor's schedule and clashes — it does not promise a call back." },
        { t: "It hears voice notes", d: "Voice messages are transcribed and answered, and it can reply in voice." },
        { t: "Two languages", d: "It detects the patient's language and answers in it — Arabic or English." },
        { t: "It knows returning patients", d: "It tells a returning patient from a new one and speaks to them accordingly." },
        { t: "It stops at risk", d: "On any sign of an emergency it stops and alerts the clinic team instead of improvising." },
        { t: "It does not diagnose", d: "No medical opinion, no prescriptions. Its limits are written into its instructions." },
      ],
      opsTitle: "The system underneath",
      screensTitle: "Inside the system",
      screensLede: "TAWD at work.",
    },

    pricing: {
      eyebrow: "Pricing",
      title: "Priced around your clinic",
      lede:
        "Doctor count, the modules you actually need, and message volume — three things that differ per clinic, so there is no single honest number for all of them.",
      whatTitle: "Always included",
      what: [
        "Sura on WhatsApp",
        "Appointments and doctor schedules",
        "Patient records and clinical notes",
        "Invoicing and VAT",
        "Management reporting",
        "Team training and support",
      ],
      modulesTitle: "Modules added when needed",
      modules: [
        "Inventory & pharmacy",
        "Payroll & attendance",
        "Insurance & claims",
        "Treatment plans",
        "Loyalty programme",
        "Online payments",
      ],
      ctaTitle: "Let us price it for your clinic",
      ctaBody: "A short conversation about your size is enough to give you a clear number with no surprises.",
      ctaButton: "Request a quote",
      note: "No hidden fees, and no contract that keeps you from leaving with your data.",
    },

    faq: {
      eyebrow: "FAQ",
      title: "The questions people actually ask",
      items: [
        {
          q: "Will I lose my clinic's current WhatsApp number?",
          a: "No. The simplest route keeps your existing number exactly as it is and gives booking its own line for Sura. There is also a route that runs on your own number while the WhatsApp Business app keeps working alongside it — we'll walk you through whichever fits your clinic.",
        },
        {
          q: "Can Sura give medical advice?",
          a: "No, and it should not. It does not diagnose or prescribe. On any sign of an emergency it stops and alerts your team. Clinical decisions belong to the licensed clinician alone.",
        },
        {
          q: "Where is our patient data, and who can reach it?",
          a: "The data belongs to the clinic, not to TAWD. Every row belongs to exactly one clinic and that isolation is enforced by the database itself — access is refused even if application code is wrong, rather than merely hidden in the interface. Each staff member has a role that limits what they see.",
        },
        {
          q: "What if we want to leave?",
          a: "You receive a complete export of your data, which is then permanently deleted on request. No contract holds your data hostage.",
        },
        {
          q: "How long does setup take?",
          a: "The core setup — services, doctors, hours, and the WhatsApp connection — is done within a working day. We stay with you through the first week while the team settles in.",
        },
        {
          q: "Does it work for a small clinic?",
          a: "Yes, and they gain the most. A single-doctor clinic has nobody sitting on the messages — which is exactly the gap Sura fills.",
        },
        {
          q: "Is this a real company or a side project?",
          a: "An Omani company led by its founder, with TAWD as its only product — built, run, and maintained daily. Our legal pages and privacy policy are published and readable before you sign anything.",
        },
      ],
      moreTitle: "Question not here?",
      moreBody: "Ask it directly — we answer ourselves.",
    },

    about: {
      eyebrow: "Company",
      title: "TAWD",
      meaning: "طَود (tawd): a towering mountain that does not move.",
      lede:
        "An Omani software company building a clinic operating system, and an AI agent that answers its patients.",
      storyTitle: "Why it was built",
      story: [
        "Most clinics in Oman run on a paper diary and a WhatsApp group. Not because their owners want less, but because what is offered to them is either foreign software that does not know Omani VAT and sets Arabic badly, or a booking app that knows nothing about what happens after the booking.",
        "Either way the same problem remains: messages arrive after hours and nobody reads them, and the patient who went unanswered goes elsewhere without telling you why.",
        "TAWD was built for that: to answer the patient in the moment they wrote, and to turn that answer into an appointment, an invoice and a record — without anyone typing anything twice.",
      ],
      founderTitle: "Founder",
      founderName: "Mohammed Al Badi",
      founderRole: "Founder & CEO",
      founderBio:
        "I built TAWD end to end — the system, Sura, and every decision in both. From the shape of an invoice to the words Sura chooses for a patient writing at midnight.\n\nI work with clinics directly, with no layer between us. When a clinic calls, I answer.",
      principlesTitle: "What we hold to",
      principles: [
        { t: "Your data is yours", d: "We do not use one clinic's data for our own purposes, never share it with another clinic, and you leave with it whenever you choose." },
        { t: "We don't promise what isn't built", d: "What you see on this site exists and runs. What isn't built yet, we say so plainly." },
        { t: "Medicine belongs to the clinician", d: "TAWD is operational software. The clinical decision is the doctor's, and Sura does not go near it." },
      ],
    },

    contact: {
      eyebrow: "Contact",
      title: "Let's talk",
      lede:
        "Tell us about your clinic — how many doctors, and what wears you down today — and we'll come back with a straight answer, even if it's that TAWD isn't what you need right now.",
      nameL: "Name",
      clinicL: "Clinic name",
      phoneL: "Phone",
      emailL: "Email",
      msgL: "What are you trying to solve?",
      msgPlaceholder: "e.g. We have three doctors, and after-hours messages are costing us patients.",
      send: "Send",
      sending: "Sending…",
      sent: "We have your message — we'll come back to you shortly.",
      failed: "That didn't send. Email us directly below.",
      required: "Name, a way to reach you, and your question — we need those three to reply.",
      directTitle: "Or directly",
      emailV: "playmoham19@gmail.com",
      instaV: "tawd.os",
    },

    footer: {
      tagline: "Clinic operating system — Oman",
      company: "Company",
      product: "Product",
      legalT: "Legal",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      deletion: "Data Deletion",
      rights: "All rights reserved",
      built: "Built in Oman",
    },
  },
} as const;

export type Dict = (typeof dict)["ar"];
