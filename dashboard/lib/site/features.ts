/* The alternating feature sections — the spine the first two versions were
   missing entirely.

   Every reference landing page carries two or three of these: one large,
   readable product screen with the claim written beside it. Six identical
   text cards is not a landing page, it is a summary. */

export type FeatureRow = {
  shot: string;
  ar: { tag: string; title: string; body: string; points: string[]; cap: string };
  en: { tag: string; title: string; body: string; points: string[]; cap: string };
};

export const FEATURES: FeatureRow[] = [
  {
    /* The schedule rather than the day dashboard: this screen reads the same at
       any hour, where "today" is legitimately empty at 1am and makes the
       product look asleep. */
    shot: "/shots/appointments.png",
    ar: {
      tag: "المواعيد",
      title: "كل موعد في العيادة، وحالته، في مكان واحد",
      body:
        "من حجزته سُرى ومن حجزه الاستقبال — الكل في جدول واحد. لكل موعد طبيبه وخدمته وحالته، والنظام نفسه يمنع حجز طبيب مرّتين في الوقت ذاته.",
      points: [
        "منع التعارض مفروض في قاعدة البيانات لا في الشاشة",
        "دوام مقسوم صباحي ومسائي، وإجازات",
        "نسبة الإكمال وعدم الحضور أمامك دائماً",
        "من حجز عبر سُرى ومن حجز من الاستقبال",
      ],
      cap: "المواعيد — ٢٠٠ موعد، ٥١ مكتملاً، ١٢٣ قيد الانتظار",
    },
    en: {
      tag: "Schedule",
      title: "Every appointment, and its state, in one place",
      body:
        "What Sura booked and what reception booked, in the same schedule. Each appointment carries its doctor, its service and its status — and the system itself refuses to book one doctor twice at the same time.",
      points: [
        "Clash prevention enforced by the database, not the screen",
        "Split morning and evening shifts, and leave",
        "Completion and no-show rates always in view",
        "Who booked through Sura, and who booked at the desk",
      ],
      cap: "Appointments — 200 booked, 51 completed, 123 upcoming",
    },
  },
  {
    shot: "/shots/finance.png",
    ar: {
      tag: "المال",
      title: "اعرف ربحك، لا إيرادك فقط",
      body:
        "الإيراد ناقص المصروف يساوي الربح — محسوباً من الفواتير والمدفوعات والرواتب نفسها، لا من تقدير آخر الشهر. وضريبة القيمة المضافة ٥٪ محسوبة على كل فاتورة كما يوجب النظام العُماني.",
      points: [
        "إيراد ومصروف وصافي ربح وهامش، شهراً بشهر",
        "طرق التحصيل: نقداً، مكينة، تحويل",
        "الذمم غير المحصّلة وما تأخّر منها",
        "ضريبة ٥٪ على كل فاتورة",
      ],
      cap: "المالية — إيراد الشهر ٧٬٥٨٢ ر.ع، صافي الربح ٣٬١٥٨ ر.ع",
    },
    en: {
      tag: "Money",
      title: "Know your profit, not just your revenue",
      body:
        "Revenue minus expenses equals profit — computed from the invoices, payments and payroll themselves, not estimated at month end. And 5% VAT on every invoice, as Omani law requires.",
      points: [
        "Revenue, expenses, net profit and margin, month by month",
        "How payments arrived: cash, terminal, transfer",
        "Receivables, and which of them are late",
        "5% VAT on every invoice",
      ],
      cap: "Finance — OMR 7,582 revenue, OMR 3,158 net profit",
    },
  },
  {
    shot: "/shots/inventory.png",
    ar: {
      tag: "المخزون",
      title: "كل صنف يخرج، تعرف من أخذه ولماذا",
      body:
        "المخزون يُخصم من نفسه مع كل خدمة تُفوتر ومع كل وصفة تُصرف. والدفعات لها تواريخ صلاحية تُنبّهك قبلها، وسجلّ الحركة يقول من ومتى وكم ولماذا.",
      points: [
        "خصم تلقائي عند الفوترة وعند صرف الوصفة",
        "دفعات وتواريخ صلاحية وتنبيه مبكر",
        "سجلّ حركة كامل لا يُعدَّل",
        "قيمة المخزون وقيمة الهالك",
      ],
      cap: "المخزون — الأصناف وسجلّ الحركة",
    },
    en: {
      tag: "Stock",
      title: "Every item that leaves, and who took it",
      body:
        "Stock deducts itself as each service is billed and each prescription dispensed. Batches carry expiry dates that warn you in advance, and the movement ledger says who, when, how much and why.",
      points: [
        "Automatic deduction at billing and dispensing",
        "Batches, expiry dates and early warning",
        "A full movement ledger that cannot be edited",
        "Stock value, and the value of what was wasted",
      ],
      cap: "Inventory — items and the movement ledger",
    },
  },
];

/* The channels Sura genuinely runs on today. Named, not implied — and no
   channel is listed that is not actually live. */
export const CHANNELS = {
  ar: { label: "سُرى تعمل على", items: ["واتساب", "إنستغرام", "المحادثة على موقعك"] },
  en: { label: "Sura runs on", items: ["WhatsApp", "Instagram", "Web chat"] },
};

export const TRUST = {
  ar: ["تشغيل خلال يوم عمل", "بياناتك تخرج معك", "دعم مباشر من المؤسّس"],
  en: ["Live within a working day", "Your data leaves with you", "Support direct from the founder"],
};
