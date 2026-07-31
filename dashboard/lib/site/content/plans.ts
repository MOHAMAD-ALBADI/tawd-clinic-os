/* The plans, and everything the system does.

   No numbers on this page. TAWD's price genuinely depends on the number of
   doctors, which modules a clinic turns on, and message volume — printing
   three figures would invent a model the company does not have, and the first
   real quote would then contradict its own website. Every card says تواصل
   معنا, and the conversation produces the number.

   What replaces the price is the thing a buyer actually wants and almost never
   gets: the complete list of what the system does, laid out so they can see
   exactly which of it they get. A clinic owner comparing suppliers is counting
   capabilities, not reading adjectives.

   Everything in the matrix below is built and running. */

export type Tier = "clinic" | "center" | "group";
export type Row = { ar: string; en: string; in: Tier[] };
export type Group = { ar: string; en: string; rows: Row[] };

const ALL: Tier[] = ["clinic", "center", "group"];
const FROM_CENTER: Tier[] = ["center", "group"];
const GROUP: Tier[] = ["group"];

export const PLANS = [
  {
    id: "clinic" as Tier,
    ar: { n: "العيادة", for: "عيادة واحدة، طبيب إلى خمسة", d: "كل ما تحتاجه عيادة لتُدار بالكامل من نظام واحد، ومعها سُرى على واتساب." },
    en: { n: "Clinic", for: "One clinic, one to five doctors", d: "Everything a clinic needs to run entirely from one system, with Sura on WhatsApp." },
    hot: false,
  },
  {
    id: "center" as Tier,
    ar: { n: "المجمّع الطبي", for: "تخصّصات متعدّدة، فريق كامل", d: "كل ما سبق، مع الصيدلية والتأمين والرواتب والمحاسبة وأدوار الفريق الكاملة." },
    en: { n: "Medical centre", for: "Multiple specialities, a full team", d: "Everything above, plus pharmacy, insurance, payroll, accounting and full team roles." },
    hot: true,
  },
  {
    id: "group" as Tier,
    ar: { n: "متعدّد الفروع", for: "مجموعة عيادات تحت إدارة واحدة", d: "كل ما سبق، مع فصل الفروع، وإدارة مركزية، ودعم مخصّص." },
    en: { n: "Multi-branch", for: "A group of clinics under one management", d: "Everything above, plus branch separation, central management and dedicated support." },
    hot: false,
  },
] as const;

export const MATRIX: Group[] = [
  {
    ar: "المواعيد والمرضى", en: "Appointments & patients",
    rows: [
      { ar: "تقويم المواعيد وجداول الأطباء", en: "Appointment calendar and doctor schedules", in: ALL },
      { ar: "دوام مقسوم (صباحي ومسائي) وإجازات", en: "Split shifts (morning and evening) and leave", in: ALL },
      { ar: "منع التعارض على مستوى قاعدة البيانات", en: "Clash prevention enforced by the database", in: ALL },
      { ar: "ملفّ المريض والسجلّ الطبي الكامل", en: "Patient file and full clinical record", in: ALL },
      { ar: "مرفقات وصور وتقارير في ملفّ المريض", en: "Attachments, images and reports on the file", in: ALL },
      { ar: "صفحة حجز عامة برابط عيادتك", en: "A public booking page on your own link", in: ALL },
      { ar: "غرفة الانتظار ومناداة المريض عبر واتساب", en: "Waiting room and calling patients over WhatsApp", in: ALL },
      { ar: "استيراد بيانات مرضاك الحاليين", en: "Importing your existing patient data", in: ALL },
    ],
  },
  {
    ar: "سُرى والتواصل", en: "Sura & communication",
    rows: [
      { ar: "سُرى تردّ وتحجز على واتساب", en: "Sura answers and books on WhatsApp", in: ALL },
      { ar: "على رقم عيادتك الحالي", en: "On your clinic's existing number", in: ALL },
      { ar: "عربي وإنجليزي، يُكتشفان تلقائياً", en: "Arabic and English, detected automatically", in: ALL },
      { ar: "الرسائل الصوتية تُفهم ويُردّ عليها", en: "Voice notes understood and answered", in: ALL },
      { ar: "تصعيد الحالات الطارئة لفريق العيادة", en: "Emergencies escalated to the clinic team", in: ALL },
      { ar: "تذكير المواعيد وتأكيدها بردّ واحد", en: "Reminders, confirmed or cancelled in one reply", in: ALL },
      { ar: "قائمة الانتظار تملأ الإلغاءات تلقائياً", en: "A waitlist that fills cancellations automatically", in: ALL },
      { ar: "استرجاع المرضى المنقطعين", en: "Bringing back lapsed patients", in: ALL },
      { ar: "الحملات التسويقية على واتساب", en: "WhatsApp marketing campaigns", in: ALL },
      { ar: "سُرى على إنستغرام", en: "Sura on Instagram", in: FROM_CENTER },
      { ar: "ودجت المحادثة على موقع عيادتك", en: "A chat widget on your clinic's website", in: FROM_CENTER },
    ],
  },
  {
    ar: "المال والفوترة", en: "Money & billing",
    rows: [
      { ar: "الفواتير وضريبة القيمة المضافة العُمانية ٥٪", en: "Invoices with Omani 5% VAT", in: ALL },
      { ar: "طرق دفع متعدّدة ومدفوعات جزئية", en: "Multiple payment methods and part payments", in: ALL },
      { ar: "الذمم والمتأخّرات ومتابعتها", en: "Receivables and chasing what is owed", in: ALL },
      { ar: "المرتجعات وإشعارات الدائن والإعفاءات", en: "Refunds, credit notes and write-offs", in: ALL },
      { ar: "الصندوق والإقفال اليومي", en: "The till and the daily close", in: ALL },
      { ar: "إرسال الفواتير والإيصالات بالبريد", en: "Invoices and receipts sent by email", in: ALL },
      { ar: "الدفع الإلكتروني عبر ثواني", en: "Online payment through Thawani", in: FROM_CENTER },
      { ar: "المصروفات وحساب الربح الشهري", en: "Expenses and monthly profit", in: FROM_CENTER },
      { ar: "عمولات الأطباء: احتساب، اعتماد، صرف", en: "Doctor commissions: accrued, approved, paid", in: FROM_CENTER },
    ],
  },
  {
    ar: "العيادة والعلاج", en: "Clinical",
    rows: [
      { ar: "الخدمات والأسعار وقوائمها", en: "Services, prices and price lists", in: ALL },
      { ar: "الوصفات الطبية موقّعة من الطبيب", en: "Prescriptions signed by the doctor", in: ALL },
      { ar: "الموافقات الرقمية على ملفّ المريض", en: "Digital consents on the patient file", in: ALL },
      { ar: "خطط العلاج متعدّدة الزيارات ونسبة الإنجاز", en: "Multi-visit treatment plans with progress", in: FROM_CENTER },
      { ar: "مخطّط الأسنان لكل مريض", en: "A per-patient tooth chart", in: FROM_CENTER },
      { ar: "المخزون: دفعات وصلاحيات وسجلّ حركة", en: "Stock: batches, expiry and a movement ledger", in: FROM_CENTER },
      { ar: "خصم المواد تلقائياً مع كل خدمة تُفوتر", en: "Materials deducted automatically as services are billed", in: FROM_CENTER },
      { ar: "الصيدلية وصرف الوصفات", en: "Pharmacy and dispensing", in: FROM_CENTER },
      { ar: "التأمين: التغطيات والمطالبات وتسويتها", en: "Insurance: coverage, claims and settlement", in: FROM_CENTER },
    ],
  },
  {
    ar: "الفريق والإدارة", en: "Team & management",
    rows: [
      { ar: "أدوار وصلاحيات: طبيب، استقبال، محاسب، مدير", en: "Roles: doctor, reception, accounting, manager", in: ALL },
      { ar: "لوحة لكل دور، يرى فيها ما يخصّه فقط", en: "A console per role, showing only what concerns it", in: ALL },
      { ar: "التقارير الإدارية على أرقام عيادتك الحقيقية", en: "Management reports on your clinic's real numbers", in: ALL },
      { ar: "سجلّ تدقيق لا يُعدَّل ولا يُحذف", en: "An audit log that cannot be edited or deleted", in: ALL },
      { ar: "اسأل سُرى عن أرقام عيادتك من اللوحة", en: "Ask Sura about your own numbers from the dashboard", in: ALL },
      { ar: "الحضور والانصراف ومسيّرات الرواتب", en: "Attendance and payroll runs", in: FROM_CENTER },
      { ar: "برنامج الولاء والنقاط", en: "A loyalty and points programme", in: FROM_CENTER },
      { ar: "فروع منفصلة ببيانات ومستخدمين مستقلّين", en: "Separate branches with their own data and users", in: GROUP },
      { ar: "تقارير موحّدة على مستوى المجموعة", en: "Consolidated reporting across the group", in: GROUP },
    ],
  },
  {
    ar: "التشغيل والدعم", en: "Onboarding & support",
    rows: [
      { ar: "ربط رقم واتساب عيادتك وتجهيز سُرى", en: "Connecting your WhatsApp number and setting up Sura", in: ALL },
      { ar: "إدخال خدماتك وأسعارك وأطبائك", en: "Loading your services, prices and doctors", in: ALL },
      { ar: "تدريب فريق العيادة", en: "Training your clinic's team", in: ALL },
      { ar: "دعم عبر واتساب", en: "Support over WhatsApp", in: ALL },
      { ar: "تحديثات النظام بلا رسوم إضافية", en: "System updates at no extra charge", in: ALL },
      { ar: "تصدير كامل لبياناتك متى طلبت", en: "A full export of your data whenever you ask", in: ALL },
      { ar: "مسؤول حساب مخصّص", en: "A dedicated account manager", in: GROUP },
      { ar: "أولوية في الدعم وطلبات التطوير", en: "Priority support and development requests", in: GROUP },
    ],
  },
];
