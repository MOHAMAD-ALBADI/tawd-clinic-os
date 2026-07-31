"use client";

import { History, HelpCircle, ShieldCheck, Plug, Sparkles, Rocket } from "lucide-react";
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
          ? "سجلّ ما نضيفه للنظام، وكيف يُربط، والأسئلة التي يسألها أصحاب العيادات قبل أن يقرّروا."
          : "What we add to the system, how it connects, and the questions clinic owners ask before they decide."}
      />

      <section className="sec">
        <div className="wrap">
          <CardGrid items={[
            { t: ar ? "سجلّ التحديثات" : "Changelog",
              d: ar ? "كل ما أضفناه للنظام، بتاريخه." : "Everything we have added to the system, dated.",
              i: History, href: "/resources/changelog" },
            { t: ar ? "أسئلة شائعة" : "FAQ",
              d: ar ? "رقم واتساب، الخصوصية، الخروج بالبيانات، ومدّة التشغيل." : "The WhatsApp number, privacy, leaving with your data, and how long setup takes.",
              i: HelpCircle, href: "/resources/faq" },
            { t: ar ? "الأمان" : "Security",
              d: ar ? "كيف تُعزل بيانات عيادتك، وما الذي يضمن أنها لك وحدك." : "How your clinic's data is isolated, and what guarantees it is yours alone.",
              i: ShieldCheck, href: "/security" },
            { t: ar ? "التكاملات" : "Integrations",
              d: ar ? "واتساب وإنستغرام والمدفوعات — ما يتّصل به النظام." : "WhatsApp, Instagram and payments — what the system connects to.",
              i: Plug, href: "/integrations" },
            { t: ar ? "سُرى" : "Sura",
              d: ar ? "كيف تقرّر سُرى، وأين تقف حدودها المهنية." : "How Sura decides, and where its professional boundaries sit.",
              i: Sparkles, href: "/ai" },
            { t: ar ? "الوصول المبكّر" : "Early access",
              d: ar ? "طَود يفتح لعدد محدود من العيادات في عُمان." : "TAWD is opening to a limited number of clinics in Oman.",
              i: Rocket, href: "/early-access" },
          ]} />
        </div>
      </section>

      <CtaBand title={ar ? "سؤال لم تجد جوابه؟" : "A question you did not find?"}
        lede={ar ? "اسأله مباشرة — يجيبك من بنى النظام." : "Ask it directly — the person who built it answers."} />
    </>
  );
}
