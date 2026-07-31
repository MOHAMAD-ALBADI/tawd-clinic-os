import type { Metadata } from "next";

/* Per-route metadata.

   The layout sets a title template of "%s | طَود" and, until now, nothing ever
   filled %s: all twenty-five routes shared one title. That is invisible in the
   browser but it is exactly what a search result shows, and twenty-five
   identical results is worse than one.

   Pages are client components, so they cannot export metadata themselves. Each
   segment gets a three-line layout.tsx that re-exports an entry from this
   table, which keeps every title in one file where they can be read against
   each other rather than scattered across twenty folders.

   Arabic, because the site opens in Arabic and a page has one title regardless
   of which way the visitor later flips the toggle. Product names stay in Latin
   script — someone searching "TAWD ClinicOS" should find the page. */

type Entry = { t: string; d: string };

const TABLE: Record<string, Entry> = {
  "products": {
    t: "المنتجات",
    d: "ClinicOS لتشغيل العيادة، وTAWD AI للردّ على مرضاها، وAnalytics قيد البناء. ما تبنيه طَود، بحالته الحقيقية.",
  },
  "products/clinic": {
    t: "ClinicOS — نظام تشغيل العيادة",
    d: "المواعيد والملفات والفوترة والمخزون والرواتب والتأمين والخطط العلاجية في نظام واحد، بالعربية وضريبة عُمان.",
  },
  "products/ai": {
    t: "TAWD AI — سُرى",
    d: "سُرى تردّ على واتساب وإنستغرام بالعربية والإنجليزية، تحجز في تقويمك فعلاً، وتُصعّد الحالة الطارئة لإنسان في ثوانٍ.",
  },
  "products/analytics": {
    t: "TAWD Analytics — قيد التطوير",
    d: "تقارير عيادتك تعمل اليوم داخل ClinicOS. مقارنة الفروع والتنبّؤ بالطلب قيد البناء — ونقول لماذا لم تُشحن بعد.",
  },
  "solutions": {
    t: "الحلول",
    d: "الأسنان والجلدية والتجميل والعلاج الطبيعي، والعيادة المستقلة والمجمّع الطبي والمجموعة متعدّدة الفروع.",
  },
  "ai": {
    t: "منصّة الذكاء الاصطناعي",
    d: "كيف تُقرّر سُرى، وعلى أي بيانات، وما الذي ترفض فعله — الحدود مكتوبة بالكامل لا ملمّح إليها.",
  },
  "security": {
    t: "الأمان والخصوصية",
    d: "عزل بيانات كل عيادة على مستوى قاعدة البيانات، سجلّ تدقيق، وموافقات المرضى الرقمية. وما لا ندّعيه.",
  },
  "integrations": {
    t: "التكاملات",
    d: "واتساب وإنستغرام وثواني والبريد — كل بند بحالته الحقيقية: يعمل الآن، أو قيد البناء.",
  },
  "pricing": {
    t: "الأسعار",
    d: "اشتراك شهري واضح للعيادة، بلا رسوم خفيّة وبلا عقد يحبسك. وبياناتك تخرج معك إن قرّرت المغادرة.",
  },
  "contact": {
    t: "تواصل معنا",
    d: "أرسل سؤالك ويجيبك من بنى النظام، لا فريق مبيعات يقرأ نصّاً محفوظاً.",
  },
  "early-access": {
    t: "الوصول المبكّر",
    d: "طَود يفتح لعدد محدود من العيادات في عُمان. من ينضمّ الآن يشكّل ما يُبنى بعده.",
  },
  "resources": {
    t: "الموارد",
    d: "ما شُحن فعلاً، وكيف يُربط النظام، والأسئلة التي تُسأل حقاً — بلا تسويق.",
  },
  "resources/changelog": {
    t: "سجلّ التحديثات",
    d: "كل ما شُحن، بتاريخه. طَود يُبنى ويُصان يومياً — هذه قائمة بما تغيّر فعلاً لا خارطة طريق.",
  },
  "resources/api": {
    t: "واجهة البرمجة",
    d: "نقاط النهاية المتاحة اليوم بمصادقتها الحقيقية. لا توثيق لما لم يُبنَ.",
  },
  "resources/faq": {
    t: "أسئلة شائعة",
    d: "رقم واتساب، والخصوصية، والخروج ببياناتك، وكم يستغرق التشغيل — الأسئلة التي تُسأل فعلاً.",
  },
  "company/about": {
    t: "عن طَود",
    d: "من نحن، ولماذا بُني هذا النظام في عُمان، ومن يقف خلفه.",
  },
  "company/vision": {
    t: "الرؤية",
    d: "إلى أين يتّجه طَود، وما الذي نرفض بناءه في الطريق.",
  },
};

/* `absolute` rather than a bare string, deliberately.

   There are two title templates above this: the root layout brands the whole
   app, and an intermediate segment that sets a plain title (like /products)
   consumes the template and leaves its own children unbranded. The result was
   /pricing reading "الأسعار | طَود" while /products/ai read "TAWD AI — سُرى"
   with no brand at all, and the homepage reading the brand twice.

   `absolute` opts out of every template above, so each page states its full
   title and nothing upstream can change it. */
export function meta(key: string): Metadata {
  const e = TABLE[key];
  if (!e) return {};
  return {
    title: { absolute: `${e.t} | طَود` },
    description: e.d,
    openGraph: { title: `${e.t} | طَود`, description: e.d, type: "website", locale: "ar_OM" },
    alternates: { canonical: `/${key}` },
  };
}

export const ROUTES = Object.keys(TABLE);
