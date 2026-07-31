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
   script where it is the product's own name. */

type Entry = { t: string; d: string };

const TABLE: Record<string, Entry> = {
  "products": {
    t: "النظام",
    d: "نظام واحد يُدير العيادة من أول رسالة إلى إقفال اليوم: المواعيد والملفات والفوترة والمخزون، ومعه سُرى التي تردّ على مرضاك وتحجز لهم.",
  },
  "products/clinic": {
    t: "إدارة العيادة",
    d: "المواعيد والملفات الطبية والفوترة والمخزون والرواتب والتأمين والخطط العلاجية في نظام واحد، بالعربية وضريبة عُمان.",
  },
  "solutions": {
    t: "الحلول",
    d: "الأسنان والجلدية والتجميل والعلاج الطبيعي، والعيادة المستقلة والمجمّع الطبي والمجموعة متعدّدة الفروع.",
  },
  "ai": {
    t: "سُرى",
    d: "ذكاء اصطناعي يردّ على مرضى عيادتك في واتساب وإنستغرام بالعربية والإنجليزية، ويحجز لهم مواعيد حقيقية في جدول الطبيب.",
  },
  "security": {
    t: "الأمان والخصوصية",
    d: "عزل بيانات كل عيادة على مستوى قاعدة البيانات، سجلّ تدقيق لا يُعدَّل، وموافقات المرضى الرقمية — والتزام بقانون حماية البيانات العُماني.",
  },
  "integrations": {
    t: "التكاملات",
    d: "واتساب وإنستغرام والمحادثة على موقعك، ومدفوعات ثواني والفوترة الضريبية العُمانية — يعمل مع ما تستخدمه عيادتك اليوم.",
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
    d: "سجلّ التحديثات، والتكاملات، والأسئلة التي يسألها أصحاب العيادات فعلاً قبل أن يقرّروا.",
  },
  "resources/changelog": {
    t: "سجلّ التحديثات",
    d: "كل ما أضفناه للنظام، بتاريخه. طَود يُبنى ويُطوَّر يومياً.",
  },
  "resources/faq": {
    t: "أسئلة شائعة",
    d: "رقم واتساب، والخصوصية، والخروج ببياناتك، وكم يستغرق التشغيل — الأسئلة التي تُسأل فعلاً.",
  },
  "company/about": {
    t: "عن طَود",
    d: "فريق عُماني يبني نظام تشغيل العيادات والذكاء الذي يردّ على مرضاها — من نحن، ولماذا بنينا طَود.",
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
   /pricing reading "الأسعار | طَود" while a nested page read its title with
   no brand at all, and the homepage reading the brand twice.

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
