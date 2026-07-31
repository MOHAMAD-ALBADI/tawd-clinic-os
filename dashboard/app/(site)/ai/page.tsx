"use client";

import { Bot, Mic, Languages, ShieldAlert, BrainCircuit, Workflow, Lock, Gauge } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CardGrid, Steps, CtaBand, SplitList } from "@/components/site/kit";
import { SuraDemo } from "@/components/site/sura-demo";

/* Sura's page.

   There were two pages about Sura — this one and /products/ai — competing for
   the same search and splitting the same argument. This is the one that
   survived; the other redirects here.

   The guardrail section is not a disclaimer bolted on the end. In healthcare,
   knowing exactly where an assistant stops is something a buyer actively
   checks for, so it sits in the middle of the page where it gets read. */
const C = {
  ar: {
    tag: "سُرى",
    h1: "ذكاء يتّخذ قراراً داخل بيانات حقيقية",
    lede: "الفرق بين نموذج يجاوب على سؤال ونظام يفعل شيئاً هو كل شيء. سُرى تقرأ حالة العيادة وتكتب فيها — لا تعد بأن أحداً سيتواصل معك.",
    capT: "ما تفعله سُرى",
    caps: [
      { t: "تحجز فعلاً", d: "تقرأ جدول الطبيب في تلك اللحظة، تفحص التعارض، وتكتب الموعد في قاعدة البيانات.", i: Bot },
      { t: "تسمع وتتكلّم", d: "الرسالة الصوتية تُفرَّغ نصاً ويُردّ عليها، وبإمكانها الردّ صوتاً.", i: Mic },
      { t: "لغتان", d: "تكتشف لغة المريض وتردّ بها — عربية أو إنجليزية، بلا إعداد.", i: Languages },
      { t: "تعرف المراجع", d: "تميّز المريض القديم من الجديد وتخاطبه على هذا الأساس.", i: BrainCircuit },
      { t: "تعمل خلفها أتمتة", d: "تذكير المواعيد، ملء الشواغر من قائمة الانتظار، واستدعاء المنقطعين.", i: Workflow },
      { t: "تتوقّف عند الطوارئ", d: "عند اشتباه حالة طارئة تتوقّف وتُنبّه فريق العيادة فوراً.", i: ShieldAlert },
    ],
    howT: "كيف تقرّر",
    how: [
      { n: "٠١", t: "تقرأ السياق", d: "خدمات العيادة، جدول الأطباء، ساعات الدوام، وتاريخ المريض الموجز — من قاعدة العيادة نفسها." },
      { n: "٠٢", t: "تفهم النيّة", d: "حجز؟ سؤال عن سعر؟ إلغاء؟ أم حالة تحتاج إنساناً؟" },
      { n: "٠٣", t: "تتحقّق قبل أن تعد", d: "التعارض والدوام والإجازات تُفحص قبل أن تُذكر ساعة واحدة للمريض." },
      { n: "٠٤", t: "تكتب وتؤكّد", d: "الموعد يُكتب، والتأكيد يصل، والتذكير يُجدول." },
    ],
    limT: "ضوابط مهنية مبنيّة في صميمها",
    limLede: "في الرعاية الصحية، انضباط المساعد لا يقلّ أهمية عن ذكائه. سُرى مصمّمة لتعرف أين يقف دورها بالضبط.",
    lims: [
      "لا تشخّص ولا تصف علاجاً ولا تعطي رأياً طبياً",
      "لا تعد بنتيجة علاج ولا تتفاوض على سعر",
      "تتوقّف وتُسلّم لإنسان عند الطوارئ والشكاوى",
      "لا ترسل رسائل تسويقية لمن لم يوافق",
    ],
    secT: "الذكاء والأمان",
    secLede: "ما يُرسل للنموذج محدود عمداً: نصّ الرسالة وسياق العيادة اللازم للإجابة. السجلات الطبية التفصيلية والبيانات المالية لا تغادر قاعدة البيانات، ولا شيء منها يُستخدم لتدريب أي نموذج.",
    secs: [
      { t: "أقلّ ما يلزم", d: "الخدمات والدوام والتوفّر وملخّص المريض — لا أكثر.", i: Lock },
      { t: "لا تدريب على بياناتك", d: "لا تُستخدم بيانات أي عيادة لتدريب نموذج، ولا تُشارك مع عيادة أخرى.", i: ShieldAlert },
      { t: "كل محادثة مسجّلة", d: "العيادة تقرأ كل ما قالته سُرى، متى شاءت.", i: Gauge },
    ],
  },
  en: {
    tag: "Sura",
    h1: "Intelligence that makes a decision inside real data",
    lede: "The gap between a model that answers a question and a system that does something is everything. Sura reads the clinic's state and writes to it — it does not promise that someone will call you back.",
    capT: "What Sura does",
    caps: [
      { t: "It really books", d: "Reads the doctor's schedule at that moment, checks for a clash, and writes the appointment to the database.", i: Bot },
      { t: "It listens and speaks", d: "Voice notes are transcribed and answered, and it can reply in voice.", i: Mic },
      { t: "Two languages", d: "Detects the patient's language and answers in it — Arabic or English, with no setup.", i: Languages },
      { t: "It knows returning patients", d: "Tells a returning patient from a new one and speaks to them accordingly.", i: BrainCircuit },
      { t: "Automation behind it", d: "Appointment reminders, filling cancellations from the waitlist, and recalling lapsed patients.", i: Workflow },
      { t: "It stops at emergencies", d: "On a suspected emergency it stops and alerts the clinic team immediately.", i: ShieldAlert },
    ],
    howT: "How it decides",
    how: [
      { n: "01", t: "Read the context", d: "Services, doctor schedules, opening hours and a brief patient history — from the clinic's own database." },
      { n: "02", t: "Work out the intent", d: "A booking? A price question? A cancellation? Or something that needs a person?" },
      { n: "03", t: "Check before promising", d: "Clashes, hours and leave are checked before a single time is offered." },
      { n: "04", t: "Write and confirm", d: "The appointment is written, the confirmation goes out, the reminder is scheduled." },
    ],
    limT: "Professional guardrails, built in",
    limLede: "In healthcare an assistant's discipline matters as much as its intelligence. Sura is built to know exactly where its role ends.",
    lims: [
      "No diagnosis, no prescriptions, no medical opinion",
      "No promises about outcomes and no negotiating on price",
      "Stops and hands to a person on emergencies and complaints",
      "No marketing messages to anyone who has not opted in",
    ],
    secT: "Intelligence and privacy",
    secLede: "What reaches the model is deliberately narrow: the message text and the clinic context needed to answer it. Detailed clinical records and financial data never leave the database, and none of it trains any model.",
    secs: [
      { t: "The minimum required", d: "Services, hours, availability and a patient summary — nothing more.", i: Lock },
      { t: "No training on your data", d: "No clinic's data trains a model, and none of it is shared with another clinic.", i: ShieldAlert },
      { t: "Every conversation logged", d: "The clinic can read everything Sura said, whenever it wants.", i: Gauge },
    ],
  },
} as const;

export default function AiPlatformPage() {
  const { lang } = useSite();
  const c = C[lang];
  return (
    <>
      <PageHero
        tag={c.tag} title={c.h1} lede={c.lede}
        cta={{ href: "/contact", label: lang === "ar" ? "احجز عرضاً توضيحياً" : "Book a demo" }}
        cta2={{ href: "/products/clinic", label: lang === "ar" ? "شوف النظام كاملاً" : "See the whole system" }}
      />

      <SuraDemo />

      <section className="sec">
        <div className="wrap">
          <Head title={c.capT} />
          <CardGrid items={c.caps} />
        </div>
      </section>

      <section className="sec" style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,.012)" }}>
        <div className="wrap">
          <Head tag={lang === "ar" ? "٠١ — ٠٤" : "01 — 04"} title={c.howT} />
          <Steps steps={c.how} />
        </div>
      </section>

      <SplitList tag={lang === "ar" ? "الانضباط" : "Discipline"} title={c.limT} lede={c.limLede} points={c.lims} />

      <section className="sec" style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,.012)" }}>
        <div className="wrap">
          <Head title={c.secT} lede={c.secLede} />
          <CardGrid items={c.secs} />
        </div>
      </section>

      <CtaBand title={lang === "ar" ? "شوف سُرى على عيادتك" : "See Sura on your clinic"} />
    </>
  );
}
