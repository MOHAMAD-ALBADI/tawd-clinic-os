/* The navigation tree — one source for the header, the mega panels, the footer
   and the sitemap.

   Everything listed here resolves to a page that exists. Nothing ships in the
   nav that cannot survive a click: an empty page found from the menu is the
   first thing a prospect sees when they go looking for proof. */

export type NavLeaf = { href: string; ar: string; en: string; arD?: string; enD?: string };
export type NavGroup = { ar: string; en: string; items: NavLeaf[] };

export const NAV: { key: string; ar: string; en: string; href?: string; groups?: NavGroup[]; feature?: NavLeaf }[] = [
  /* One company, one product.

     There were three sub-brands here — ClinicOS, TAWD AI, TAWD Analytics —
     invented to fill a menu. They made a single system look like a product
     line a buyer has to assemble, and they put the company's own name third.
     The product is طَود. Sura is part of it. */
  {
    key: "product",
    ar: "النظام", en: "The system",
    groups: [
      {
        ar: "نظام طَود", en: "The TAWD system",
        items: [
          { href: "/products", ar: "نظرة عامة", en: "Overview", arD: "النظام كاملاً في صفحة", enD: "The whole system on one page" },
          { href: "/products/clinic", ar: "إدارة العيادة", en: "Clinic management", arD: "المواعيد والملفات والفوترة والمخزون", enD: "Appointments, records, billing and stock" },
          { href: "/ai", ar: "سُرى", en: "Sura", arD: "الذكاء الذي يردّ على مرضاك ويحجز", enD: "The intelligence that answers your patients and books" },
          { href: "/integrations", ar: "التكاملات", en: "Integrations", arD: "واتساب وإنستغرام والمدفوعات", enD: "WhatsApp, Instagram and payments" },
        ],
      },
    ],
    feature: { href: "/security", ar: "الأمان والخصوصية", en: "Security & privacy", arD: "عزل كامل لبيانات كل عيادة", enD: "Every clinic's data fully isolated" },
  },
  {
    key: "solutions",
    ar: "الحلول", en: "Solutions",
    groups: [
      {
        ar: "حسب التخصّص", en: "By practice",
        items: [
          { href: "/solutions/dental", ar: "عيادات الأسنان", en: "Dental clinics" },
          { href: "/solutions/dermatology", ar: "الجلدية والتجميل", en: "Dermatology & aesthetics" },
          { href: "/solutions/plastic-surgery", ar: "جراحة التجميل", en: "Plastic surgery" },
          { href: "/solutions/physiotherapy", ar: "العلاج الطبيعي", en: "Physiotherapy" },
        ],
      },
      {
        ar: "حسب الحجم", en: "By size",
        items: [
          { href: "/solutions/clinics", ar: "العيادات المستقلة", en: "Independent clinics" },
          { href: "/solutions/medical-centers", ar: "المجمّعات الطبية", en: "Medical centres" },
          { href: "/solutions/multi-branch", ar: "متعدّدة الفروع", en: "Multi-branch groups" },
        ],
      },
    ],
  },
  { key: "sura", ar: "سُرى", en: "Sura", href: "/ai" },
  {
    key: "resources",
    ar: "الموارد", en: "Resources",
    groups: [
      {
        ar: "الموارد", en: "Resources",
        items: [
          { href: "/resources", ar: "المركز", en: "Hub" },
          { href: "/resources/changelog", ar: "سجلّ التحديثات", en: "Changelog", arD: "كل ما شُحن، بتاريخه", enD: "Everything shipped, dated" },
          { href: "/resources/faq", ar: "أسئلة شائعة", en: "FAQ" },
        ],
      },
      {
        ar: "التكاملات", en: "Integrations",
        items: [
          { href: "/integrations", ar: "كل التكاملات", en: "All integrations" },
          { href: "/integrations#channels", ar: "قنوات المرضى", en: "Patient channels" },
          { href: "/integrations#payments", ar: "المدفوعات", en: "Payments" },
        ],
      },
    ],
  },
  {
    key: "company",
    ar: "الشركة", en: "Company",
    groups: [
      {
        ar: "الشركة", en: "Company",
        items: [
          { href: "/company/about", ar: "عن طَود", en: "About" },
          { href: "/company/vision", ar: "الرؤية", en: "Vision" },
          { href: "/security", ar: "الأمان", en: "Security" },
          { href: "/contact", ar: "تواصل", en: "Contact" },
        ],
      },
    ],
  },
  { key: "pricing", ar: "الأسعار", en: "Pricing", href: "/pricing" },
];

/* Footer columns. Legal lives here only — it belongs at the bottom of a page,
   not in a header someone is trying to buy from. */
export const FOOTER: NavGroup[] = [
  {
    ar: "النظام", en: "The system",
    items: [
      { href: "/products", ar: "نظرة عامة", en: "Overview" },
      { href: "/products/clinic", ar: "إدارة العيادة", en: "Clinic management" },
      { href: "/ai", ar: "سُرى", en: "Sura" },
      { href: "/integrations", ar: "التكاملات", en: "Integrations" },
      { href: "/pricing", ar: "الأسعار", en: "Pricing" },
    ],
  },
  {
    ar: "الحلول", en: "Solutions",
    items: [
      { href: "/solutions/dental", ar: "عيادات الأسنان", en: "Dental" },
      { href: "/solutions/dermatology", ar: "الجلدية", en: "Dermatology" },
      { href: "/solutions/medical-centers", ar: "المجمّعات", en: "Medical centres" },
      { href: "/solutions/multi-branch", ar: "متعدّدة الفروع", en: "Multi-branch" },
    ],
  },
  {
    ar: "الموارد", en: "Resources",
    items: [
      { href: "/resources/changelog", ar: "سجلّ التحديثات", en: "Changelog" },
      { href: "/resources", ar: "مركز الموارد", en: "Resource hub" },
      { href: "/resources/faq", ar: "أسئلة شائعة", en: "FAQ" },
      { href: "/early-access", ar: "الوصول المبكر", en: "Early access" },
    ],
  },
  {
    ar: "الشركة", en: "Company",
    items: [
      { href: "/company/about", ar: "عن طَود", en: "About" },
      { href: "/company/vision", ar: "الرؤية", en: "Vision" },
      { href: "/security", ar: "الأمان", en: "Security" },
      { href: "/contact", ar: "تواصل", en: "Contact" },
    ],
  },
  {
    ar: "القانونية", en: "Legal",
    items: [
      { href: "/legal/privacy", ar: "سياسة الخصوصية", en: "Privacy" },
      { href: "/legal/terms", ar: "شروط الاستخدام", en: "Terms" },
      { href: "/legal/data-deletion", ar: "حذف البيانات", en: "Data deletion" },
    ],
  },
];
