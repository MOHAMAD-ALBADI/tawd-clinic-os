"use client";

import { History, Braces, HelpCircle, ShieldCheck, Plug, Sparkles } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, CardGrid, CtaBand } from "@/components/site/kit";

export default function ResourcesHub() {
  const { lang } = useSite();
  const ar = lang === "ar";

  return (
    <>
      <PageHero
        tag={ar ? "الموارد" : "Resources"}
        title={ar ? "كل ما تحتاج معرفته قبل أن تقرّر" : "Everything you need before you decide"}
        lede={ar
          ? "ما شُحن فعلاً، وكيف يُربط النظام، والأسئلة التي تُسأل فعلاً — بلا تسويق."
          : "What actually shipped, how it connects, and the questions people really ask — without the marketing."}
      />

      <section className="sec">
        <div className="wrap">
          <CardGrid items={[
            { t: ar ? "سجلّ التحديثات" : "Changelog",
              d: ar ? "كل ما شُحن، بتاريخه. طَود يُبنى ويُصان يومياً." : "Everything shipped, dated. TAWD is built and maintained daily.",
              i: History, href: "/resources/changelog" },
            { t: ar ? "واجهة البرمجة" : "API reference",
              d: ar ? "نقاط النهاية المتاحة اليوم، بأشكال الطلب والردّ الحقيقية." : "The endpoints available today, with their real request and response shapes.",
              i: Braces, href: "/resources/api" },
            { t: ar ? "أسئلة شائعة" : "FAQ",
              d: ar ? "رقم واتساب، الخصوصية، الخروج بالبيانات، ومدّة التشغيل." : "The WhatsApp number, privacy, leaving with your data, and how long setup takes.",
              i: HelpCircle, href: "/resources/faq" },
            { t: ar ? "الأمان" : "Security",
              d: ar ? "العزل والسجلّ والبنية — وما لا ندّعيه." : "Isolation, the audit log, the infrastructure — and what we do not claim.",
              i: ShieldCheck, href: "/security" },
            { t: ar ? "التكاملات" : "Integrations",
              d: ar ? "ما يعمل اليوم، وما هو قيد البناء، بحالته الحقيقية." : "What is live today and what is in development, with its real state.",
              i: Plug, href: "/integrations" },
            { t: ar ? "منصّة الذكاء" : "AI Platform",
              d: ar ? "كيف تقرّر سُرى، وما لا تفعله." : "How Sura decides, and what it will not do.",
              i: Sparkles, href: "/ai" },
          ]} />
        </div>
      </section>

      <CtaBand title={ar ? "سؤال لم تجد جوابه؟" : "A question you did not find?"}
        lede={ar ? "اسأله مباشرة — يجيبك من بنى النظام." : "Ask it directly — the person who built it answers."} />
    </>
  );
}
