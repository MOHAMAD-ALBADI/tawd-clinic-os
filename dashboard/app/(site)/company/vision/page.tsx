"use client";

import { useSite } from "@/components/site/lang";
import { PageHero, Head, CardGrid, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";
import { Target, Layers, Globe2, HandHeart } from "lucide-react";

const C = {
  ar: {
    tag: "الرؤية",
    h1: "أن تُدار كل عيادة في الخليج بنظام يفهم لغتها",
    lede: "ليس بنظام أجنبي مترجَم، ولا بدفتر ومجموعة واتساب. بنظام بُني هنا، لطريقة العمل هنا.",
    whyT: "لماذا هذا يستحقّ شركة",
    why: [
      "العيادات الصغيرة والمتوسطة هي أغلب الرعاية الصحية في المنطقة، وأقلّها حظاً في البرمجيات.",
      "الأنظمة العالمية لا تعرف ضريبة عُمان ولا تكتب العربية بشكل صحيح ولا تفهم دواماً مقسوماً.",
      "وتطبيقات الحجز المحلية تتوقّف عند الحجز، بينما المشكلة الحقيقية تبدأ بعده.",
      "والذكاء الاصطناعي غيّر ما هو ممكن: صار بإمكان عيادة بطبيب واحد أن تردّ على مرضاها ٢٤ ساعة.",
    ],
    stepsT: "أين نحن، وإلى أين",
    steps: [
      { t: "اليوم — نظام تشغيل عيادة", d: "نظام طَود كاملاً مع سُرى، يعمل على بيئة تشغيل حقيقية، ويُشغَّل مع أول العيادات في عُمان.", i: Layers },
      { t: "التالي — منصّة ذكاء", d: "وكلاء يتعاملون مع المتابعة والتحصيل وقوائم الانتظار من أنفسهم، لا سُرى وحدها.", i: Target },
      { t: "بعدها — بيانات القطاع", d: "حين تعمل عيادات كثيرة على نظام واحد، تصير المقارنة المجهولة الهوية قيمة لكل واحدة منها.", i: Globe2 },
      { t: "دائماً — العيادة تملك بياناتها", d: "أي توسّع لا يمسّ هذا. البيانات للعيادة، وتخرج معها متى شاءت.", i: HandHeart },
    ],
    principlesT: "ما لن نفعله",
    principles: [
      { t: "لن نبيع بيانات المرضى", d: "لا لمعلن، ولا لشركة تأمين، ولا لباحث. أبداً ولا بأي شكل مجهول الهوية يقبل إعادة التعريف." },
      { t: "لن نقفل عليك بياناتك", d: "التصدير حقّ دائم لا ميزة في باقة أعلى." },
      { t: "نبني ما يُستخدم فعلاً", d: "كل ميزة تدخل النظام لأن عيادة احتاجتها، لا لأنها تُحسّن شريحة عرض." },
    ],
  },
  en: {
    tag: "Vision",
    h1: "That every clinic in the Gulf runs on software that understands its language",
    lede: "Not foreign software in translation, and not a paper diary and a WhatsApp group. Software built here, for how work is actually done here.",
    whyT: "Why this deserves a company",
    why: [
      "Small and mid-sized clinics deliver most of the region's healthcare and are the least well served by software.",
      "Global systems do not know Omani VAT, do not set Arabic properly, and do not understand a split shift.",
      "Local booking apps stop at the booking, while the real problem starts after it.",
      "And AI changed what is possible: a single-doctor clinic can now answer its patients around the clock.",
    ],
    stepsT: "Where we are, and where this goes",
    steps: [
      { t: "Today — a clinic operating system", d: "The TAWD system complete with Sura, running against a real operating environment, going live with the first clinics in Oman.", i: Layers },
      { t: "Next — an intelligence platform", d: "Agents handling follow-up, collections and waitlists on their own, not Sura alone.", i: Target },
      { t: "After — sector data", d: "When many clinics run on one system, anonymised benchmarking becomes valuable to every one of them.", i: Globe2 },
      { t: "Always — the clinic owns its data", d: "No expansion touches this. The data belongs to the clinic and leaves with it whenever it wants.", i: HandHeart },
    ],
    principlesT: "What we will not do",
    principles: [
      { t: "We will not sell patient data", d: "Not to an advertiser, an insurer, or a researcher. Not ever, and not in any anonymised form that could be re-identified." },
      { t: "We will not lock your data in", d: "Export is a permanent right, not a feature of a higher tier." },
      { t: "We will not promise what is not built", d: "What is in development says so, on every page." },
    ],
  },
} as const;

export default function VisionPage() {
  const { lang } = useSite();
  const c = C[lang];
  return (
    <>
      <PageHero tag={c.tag} title={c.h1} lede={c.lede} />

      <section className="sec">
        <div className="wrap" style={{ maxWidth: "76ch" }}>
          <Head title={c.whyT} />
          <div style={{ display: "grid", gap: "1.4rem" }}>
            {c.why.map((p, i) => (
              <Reveal key={p} delay={i * 60}>
                <p style={{ fontSize: "1.02rem", lineHeight: 2.1, color: "var(--tx-1)" }}>{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,.012)" }}>
        <div className="wrap">
          <Head title={c.stepsT} />
          <CardGrid cols={2} items={c.steps} />
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <Head title={c.principlesT} />
          <CardGrid items={c.principles} />
        </div>
      </section>

      <CtaBand title={lang === "ar" ? "كن من أول من يشغّله" : "Be among the first to run it"} />
    </>
  );
}
