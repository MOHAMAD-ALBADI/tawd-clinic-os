/* Seven practice types, one route.

   Everything here is a capability the product actually has — the tooth chart,
   session courses, split shifts, branch isolation are all built. What differs
   per sector is which of them matters, and that is what these pages say. */

export type Sector = {
  slug: string;
  ar: { name: string; h1: string; lede: string; pains: string[]; gains: { t: string; d: string }[]; close: string };
  en: { name: string; h1: string; lede: string; pains: string[]; gains: { t: string; d: string }[]; close: string };
};

export const SECTORS: Sector[] = [
  {
    slug: "dental",
    ar: {
      name: "عيادات الأسنان",
      h1: "عيادة أسنان تُدار من مخطّط الأسنان إلى الفاتورة",
      lede: "علاج الأسنان متعدّد الزيارات بطبيعته، والمريض يسأل عن السعر قبل أن يحجز. طَود يتعامل مع الاثنين.",
      pains: [
        "خطة علاج من خمس زيارات لا أحد يتابع أين وصلت",
        "مواد تُستهلك مع كل حشوة ولا تُخصم من المخزون",
        "مريض يسأل عن سعر التنظيف بعد الدوام فلا يجد رداً",
      ],
      gains: [
        { t: "مخطّط أسنان لكل مريض", d: "كل سنّ وحالته، ويُحدَّث مع كل زيارة — لا ورقة في ملف." },
        { t: "خطط متعدّدة الزيارات", d: "خطة بسعرها وبنودها، يقبلها المريض، ونسبة الإنجاز أمامك." },
        { t: "مواد لكل خدمة", d: "حدّد ما تستهلكه الحشوة مرّة، ويُخصم تلقائياً مع كل فوترة." },
        { t: "سُرى تجاوب عن الأسعار", d: "الأسعار من جدول خدماتك أنت، لا من تخمين." },
      ],
      close: "أرِنا عيادة أسنانك",
    },
    en: {
      name: "Dental clinics",
      h1: "A dental practice run from the tooth chart to the invoice",
      lede: "Dentistry is multi-visit by nature, and patients ask the price before they book. TAWD handles both.",
      pains: [
        "A five-visit plan nobody is tracking",
        "Materials consumed on every filling that never leave the stock count",
        "A patient asking the price of a cleaning after hours and getting nothing",
      ],
      gains: [
        { t: "A tooth chart per patient", d: "Every tooth and its state, updated at each visit — not a sheet in a folder." },
        { t: "Multi-visit treatment plans", d: "A plan with its price and line items, accepted by the patient, with progress in view." },
        { t: "Materials per service", d: "Define what a filling consumes once; it deducts automatically at billing." },
        { t: "Sura answers on price", d: "From your own service list, not from a guess." },
      ],
      close: "Show us your dental practice",
    },
  },
  {
    slug: "dermatology",
    ar: {
      name: "الجلدية والتجميل",
      h1: "جلسات متسلسلة، وباقات تُخصم بالجلسة",
      lede: "الجلدية تبيع برامج لا زيارات. والنظام لازم يعرف كم بقي من الباقة، ومتى الجلسة القادمة.",
      pains: [
        "باقة ست جلسات، والمريض يسأل كم بقي ولا أحد يعرف",
        "صور قبل وبعد على جوّال الطبيبة",
        "مريضة تعيد الحجز كل شهرين ولا أحد يذكّرها",
      ],
      gains: [
        { t: "باقات تُخصم بالجلسة", d: "الرصيد المتبقي أمام الاستقبال وأمام المريض." },
        { t: "صور مرفقة بالملف", d: "قبل وبعد داخل ملف المريض، معزولة ومحفوظة." },
        { t: "استدعاء تلقائي", d: "سُرى تتواصل مع من انقطع، في الوقت الذي يعود فيه عادةً." },
        { t: "مواعيد متكرّرة", d: "برنامج الجلسات يُحجز كاملاً مرّة واحدة." },
      ],
      close: "أرِنا عيادتك",
    },
    en: {
      name: "Dermatology & aesthetics",
      h1: "Session courses, and packages drawn down per visit",
      lede: "Aesthetics sells programmes, not appointments. The system has to know what is left of a package and when the next session is due.",
      pains: [
        "A six-session package and nobody can say how many are left",
        "Before-and-after photos on the doctor's phone",
        "A patient who rebooks every two months and is never reminded",
      ],
      gains: [
        { t: "Packages drawn down per session", d: "The remaining balance visible to reception and to the patient." },
        { t: "Images on the file", d: "Before and after inside the patient record, isolated and retained." },
        { t: "Automatic recall", d: "Sura reaches out to lapsed patients at the point they usually return." },
        { t: "Recurring appointments", d: "A whole session programme booked in one action." },
      ],
      close: "Show us your clinic",
    },
  },
  {
    slug: "plastic-surgery",
    ar: {
      name: "جراحة التجميل",
      h1: "استشارة، موافقة، عملية، ومتابعة — في ملف واحد",
      lede: "الجراحة التجميلية ثقيلة على التوثيق: موافقات، مراحل، ومتابعة بعد العملية. كلها في مكان واحد.",
      pains: [
        "موافقات موقّعة ورقياً تضيع أو تُنسى",
        "متابعة ما بعد العملية تعتمد على ذاكرة الموظفة",
        "استشارات كثيرة تتحوّل قليل منها لعمليات، ولا أحد يعرف كم",
      ],
      gains: [
        { t: "موافقات رقمية موقّعة", d: "إقرار المريض في ملفه، بتاريخه، غير قابل للتعديل." },
        { t: "متابعة مجدولة", d: "مواعيد ما بعد العملية تُنشأ مع العملية نفسها." },
        { t: "نسبة تحوّل الاستشارات", d: "كم استشارة صارت عملية — رقم من العمل لا من تقدير." },
        { t: "خطط بمراحل", d: "كل مرحلة بسعرها وحالتها." },
      ],
      close: "تحدّث معنا",
    },
    en: {
      name: "Plastic surgery",
      h1: "Consultation, consent, procedure and follow-up — one file",
      lede: "Surgical practice is documentation-heavy: consents, stages, and post-operative follow-up. All in one place.",
      pains: [
        "Paper consents that go missing or get forgotten",
        "Post-op follow-up that depends on someone remembering",
        "Many consultations, few conversions, and no number for it",
      ],
      gains: [
        { t: "Signed digital consents", d: "On the patient's file, dated, and not editable afterwards." },
        { t: "Scheduled follow-up", d: "Post-operative appointments created with the procedure itself." },
        { t: "Consultation conversion", d: "How many consultations became procedures — measured, not estimated." },
        { t: "Staged plans", d: "Each stage with its own price and state." },
      ],
      close: "Talk to us",
    },
  },
  {
    slug: "physiotherapy",
    ar: {
      name: "العلاج الطبيعي",
      h1: "حضور متكرّر، وتقدّم يمكن قياسه",
      lede: "العلاج الطبيعي يعيش على الالتزام. والنظام الذي لا يذكّر المريض يخسره في الأسبوع الثالث.",
      pains: [
        "برنامج اثنتي عشرة جلسة، والمريض ينقطع عند الرابعة",
        "لا سجلّ لتقدّم الحالة بين الجلسات",
        "مواعيد أسبوعية تُحجز يدوياً كل مرّة",
      ],
      gains: [
        { t: "برنامج يُحجز مرّة", d: "اثنتا عشرة جلسة أسبوعية بضغطة واحدة." },
        { t: "تذكير قبل كل جلسة", d: "أكبر سبب للانقطاع هو النسيان، وهذا يُعالَج بذكرى." },
        { t: "ملاحظات تقدّم", d: "حالة المريض عند كل جلسة، مقروءة كخطّ زمني." },
        { t: "معدّل الالتزام", d: "من يكمل البرنامج ومن ينقطع، ومتى." },
      ],
      close: "أرِنا مركزك",
    },
    en: {
      name: "Physiotherapy",
      h1: "Frequent attendance, and progress you can measure",
      lede: "Physiotherapy lives on adherence. A system that does not remind the patient loses them in week three.",
      pains: [
        "A twelve-session programme abandoned at session four",
        "No record of progress between sessions",
        "Weekly appointments booked by hand every time",
      ],
      gains: [
        { t: "A programme booked once", d: "Twelve weekly sessions in a single action." },
        { t: "A reminder before each session", d: "The biggest cause of drop-off is forgetting, and forgetting is fixable." },
        { t: "Progress notes", d: "The patient's state at each session, read as a timeline." },
        { t: "Adherence rate", d: "Who completes a programme, who stops, and when." },
      ],
      close: "Show us your centre",
    },
  },
  {
    slug: "clinics",
    ar: {
      name: "العيادات المستقلة",
      h1: "طبيب واحد، وموظفة واحدة، ونظام لا يحتاج فريق تقنية",
      lede: "أصغر العيادات هي أكثر من يستفيد: لا يوجد من يجلس للرسائل، ولا من يكتب التقارير آخر الشهر.",
      pains: [
        "الطبيب هو المدير والمحاسب وموظف الاستقبال",
        "الرسائل تصل والطبيب داخل الكشف",
        "لا وقت لتعلّم نظام معقّد",
      ],
      gains: [
        { t: "سُرى تكون الاستقبال", d: "تردّ وتحجز وأنت داخل الكشف." },
        { t: "تشغيل في يوم", d: "الخدمات والدوام والربط — في يوم عمل واحد." },
        { t: "تقارير بلا محاسب", d: "الإيراد والمصروف والربح محسوبة من العمل نفسه." },
        { t: "لا فريق تقنية", d: "لا خادم ولا صيانة. تفتح المتصفّح فقط." },
      ],
      close: "ابدأ بعيادتك",
    },
    en: {
      name: "Independent clinics",
      h1: "One doctor, one receptionist, and no IT department",
      lede: "The smallest clinics gain the most: nobody is sitting on the messages, and nobody is writing reports at month end.",
      pains: [
        "The doctor is also the manager, the accountant and reception",
        "Messages arrive while the doctor is with a patient",
        "No time to learn a complicated system",
      ],
      gains: [
        { t: "Sura is the front desk", d: "Answers and books while you are with a patient." },
        { t: "Live in a day", d: "Services, hours and the WhatsApp connection in one working day." },
        { t: "Reporting without an accountant", d: "Revenue, expenses and profit computed from the work itself." },
        { t: "No IT", d: "No server, no maintenance. You open a browser." },
      ],
      close: "Start with your clinic",
    },
  },
  {
    slug: "medical-centers",
    ar: {
      name: "المجمّعات الطبية",
      h1: "تخصّصات متعدّدة، وأطباء بدوام مقسوم، وتقرير لكل قسم",
      lede: "المجمّع ليس عيادة أكبر — هو عدّة عيادات تتشارك استقبالاً واحداً ومالية واحدة.",
      pains: [
        "طبيب صباحي وآخر مسائي على نفس الغرفة",
        "تقرير الإيراد لا يفرّق بين الأقسام",
        "استقبال واحد يخدم خمسة تخصّصات",
      ],
      gains: [
        { t: "دوام مقسوم", d: "صباحي ومسائي لنفس الطبيب، ومنع التعارض يفهمهما." },
        { t: "تقرير لكل تخصّص", d: "الإيراد وعدد المرضى ونسبة الإشغال، مقسومة." },
        { t: "عمولات الأطباء", d: "تُحتسب مع الفوترة لكل طبيب على حدة." },
        { t: "استقبال واحد", d: "طابور موحّد ومناداة، مهما تعدّدت الأقسام." },
      ],
      close: "تحدّث معنا عن مجمّعك",
    },
    en: {
      name: "Medical centres",
      h1: "Multiple specialties, split-shift doctors, and reporting per department",
      lede: "A medical centre is not a bigger clinic — it is several clinics sharing one front desk and one set of books.",
      pains: [
        "A morning doctor and an evening doctor in the same room",
        "A revenue report that cannot separate departments",
        "One reception serving five specialties",
      ],
      gains: [
        { t: "Split shifts", d: "Morning and evening for the same doctor, and clash prevention that understands both." },
        { t: "Reporting per specialty", d: "Revenue, patient counts and utilisation, separated." },
        { t: "Doctor commissions", d: "Accrued at invoicing, per doctor." },
        { t: "One front desk", d: "A single queue and calling system across every department." },
      ],
      close: "Talk to us about your centre",
    },
  },
  {
    slug: "multi-branch",
    ar: {
      name: "العيادات متعدّدة الفروع",
      h1: "فروع معزولة عن بعضها، وصورة واحدة للمالك",
      lede: "كل فرع يدير نفسه ولا يرى غيره. والمالك وحده يرى الجميع.",
      pains: [
        "موظف فرع يستطيع فتح بيانات فرع آخر",
        "لا رقم موحّد للمجموعة إلا بجمع يدوي",
        "سياسات وأسعار تختلف بين الفروع بلا ضبط",
      ],
      gains: [
        { t: "عزل على مستوى قاعدة البيانات", d: "فرع لا يقرأ فرعاً — رفض في القاعدة لا إخفاء في الشاشة." },
        { t: "لوحة للمالك", d: "كل الفروع في رقم واحد، ومقارنة بينها." },
        { t: "خدمات وأسعار لكل فرع", d: "مشتركة حين تريد، ومختلفة حين تريد." },
        { t: "رقم واتساب لكل فرع", d: "كل فرع وسُراه ورقمه." },
      ],
      close: "تحدّث معنا عن مجموعتك",
    },
    en: {
      name: "Multi-branch groups",
      h1: "Branches isolated from each other, one picture for the owner",
      lede: "Each branch runs itself and sees nothing else. Only the owner sees them all.",
      pains: [
        "Staff at one branch able to open another branch's data",
        "No group-level number without adding it up by hand",
        "Prices and policies drifting between branches",
      ],
      gains: [
        { t: "Isolation at the database", d: "One branch cannot read another — refused in the database, not hidden in the screen." },
        { t: "An owner's view", d: "Every branch in one figure, and compared against each other." },
        { t: "Per-branch services and pricing", d: "Shared where you want it, different where you need it." },
        { t: "A WhatsApp number per branch", d: "Each branch with its own line and its own Sura." },
      ],
      close: "Talk to us about your group",
    },
  },
];

export const bySlug = (s: string) => SECTORS.find((x) => x.slug === s);
