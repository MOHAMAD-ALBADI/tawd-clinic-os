"use client";

import Link from "next/link";
/* AtSign, not Instagram: this build of lucide-react has no Instagram glyph and
   importing it takes the whole dev server down with a 500 on every route. */
import {
  MessageSquare, Mic, Languages, Brain, ShieldAlert,
  AtSign, CalendarCheck, Users, Repeat,
} from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CardGrid, SplitList, CtaBand, Steps } from "@/components/site/kit";
import { SuraDemo } from "@/components/site/sura-demo";
import { Reveal } from "@/components/site/reveal";

/* TAWD AI — the product page for the intelligence layer.

   Distinct from /ai, which is the platform page: that one explains how the
   agent decides and what it refuses to do. This one is the commercial page —
   what you get, on which channels, and what it costs you in staff time. */
export default function ProductAiPage() {
  const { lang } = useSite();
  const ar = lang === "ar";

  return (
    <>
      <PageHero
        tag="TAWD AI"
        title={ar ? "موظّفة استقبال لا تنام، ولا تنسى مريضاً" : "A receptionist who never sleeps, and never forgets a patient"}
        lede={ar
          ? "سُرى تردّ على واتساب وإنستغرام بالعربية والإنجليزية، تحجز فعلاً في التقويم، وتحوّل الحالة الطارئة إلى إنسان في ثوانٍ. ليست ردّاً آلياً — تقرأ التقويم وتكتب فيه."
          : "Sura answers WhatsApp and Instagram in Arabic and English, books directly into the calendar, and escalates an emergency to a human in seconds. Not an auto-reply — it reads the calendar and writes to it."}
        cta={{ href: "/contact", label: ar ? "اطلب عرضاً" : "Request a demo" }}
        cta2={{ href: "/ai", label: ar ? "كيف تُقرّر" : "How it decides" }}
      />

      {/* The demo comes second, not last. It is the argument. */}
      <section className="sec">
        <div className="wrap">
          <Head
            tag={ar ? "جرّبها" : "Try it"}
            title={ar ? "اكتب كما يكتب مريضك" : "Type the way your patient would"}
            lede={ar
              ? "اطلب موعداً، أو اسأل عن السعر، أو اكتب أنك تتألّم. الجدول على اليمين يتحرّك — أو لا يتحرّك، وهذا هو المقصود."
              : "Ask for an appointment, ask a price, or say you are in pain. The schedule beside it moves — or deliberately does not."}
          />
          <div style={{ marginTop: "2.2rem" }}>
            <SuraDemo />
          </div>
        </div>
      </section>

      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <Head
            tag={ar ? "ما تفعله" : "What it does"}
            title={ar ? "ستّة أشياء تستهلك يوم موظّف الاستقبال" : "Six things that consume a receptionist's day"}
          />
          <div style={{ marginTop: "2.2rem" }}>
            <CardGrid cols={3} items={[
              { i: MessageSquare,
                t: ar ? "تردّ فوراً، طوال اليوم" : "Answers instantly, all day",
                d: ar ? "الرسالة التي تصل الثانية عشرة ليلاً تُجاب الثانية عشرة ليلاً. أغلب حجوزات العيادات تُطلب خارج الدوام." : "A message at midnight is answered at midnight. Most clinic bookings are requested outside working hours." },
              { i: CalendarCheck,
                t: ar ? "تحجز في التقويم فعلاً" : "Books in the real calendar",
                d: ar ? "تقرأ دوام الطبيب ومدّة الخدمة والمواعيد القائمة، ثم تكتب الموعد. لا ورقة وسيطة ولا تأكيد يدوي." : "It reads the doctor's rota, the service duration and existing appointments, then writes the booking. No middle step, no manual confirmation." },
              { i: Mic,
                t: ar ? "تسمع الرسائل الصوتية" : "Understands voice notes",
                d: ar ? "كثير من المرضى يرسلون صوتاً لا نصاً. تُفرَّغ الرسالة وتُفهم ويُردّ عليها — وبإمكانها الردّ صوتاً." : "Many patients send voice, not text. The note is transcribed, understood and answered — and it can answer in voice." },
              { i: Languages,
                t: ar ? "عربي وإنجليزي بلا إعداد" : "Arabic and English, no setup",
                d: ar ? "تكتشف لغة الرسالة وتردّ بها. المريض الذي كتب بالإنجليزية يستلم تأكيده بالإنجليزية." : "It detects the language of the message and replies in it. A patient who wrote in English gets their confirmation in English." },
              { i: Brain,
                t: ar ? "تعرف من عاد" : "Recognises a returning patient",
                d: ar ? "تعرف آخر زيارة وطبيبها والخدمة، فلا تسأل المريض القديم أسئلة المريض الجديد." : "It knows the last visit, its doctor and its service, so a returning patient is not asked a new patient's questions." },
              { i: ShieldAlert,
                t: ar ? "تُصعّد الطارئ لإنسان" : "Escalates an emergency",
                d: ar ? "الألم الشديد والنزيف والتورّم تُرفع فوراً إلى تنبيه أحمر في اللوحة، ولا يُترك المريض لنموذج." : "Severe pain, bleeding and swelling raise a red alert in the dashboard immediately. The patient is not left with a model." },
            ]} />
          </div>
        </div>
      </section>

      <SplitList
        tag={ar ? "القنوات" : "Channels"}
        title={ar ? "حيث يراسلك المريض أصلاً" : "Where your patients already are"}
        lede={ar
          ? "لا تطبيق جديد على المريض أن يُنزّله. نفس الوكيل ونفس السياق على كل قناة."
          : "No new app for a patient to install. The same agent and the same context on every channel."}
        points={ar
          ? ["واتساب — على رقم عيادتك نفسه، لا على رقم جديد يُربك مرضاك",
             "إنستغرام — الرسائل المباشرة على حساب العيادة",
             "الرسائل الصوتية — تُفرَّغ نصاً وتُجاب",
             "لوحة العيادة — نفس الوكيل يجيب فريقك عن أرقامه"]
          : ["WhatsApp — on your clinic's own number, not a new one that confuses your patients",
             "Instagram — direct messages on the clinic account",
             "Voice notes — transcribed and answered",
             "The clinic dashboard — the same agent answers your team's questions about their own numbers"]}
      />

      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <Head
            tag={ar ? "ما وراء الردّ" : "Beyond replying"}
            title={ar ? "الذكاء يعمل حين لا يراسلك أحد" : "The intelligence works when nobody is messaging"}
            lede={ar
              ? "الردّ هو الجزء الظاهر. الجزء الذي يُغيّر الدخل يعمل في الخلفية."
              : "Replying is the visible part. The part that changes revenue runs in the background."}
          />
          <div style={{ marginTop: "2.2rem" }}>
            <CardGrid cols={3} items={[
              { i: Repeat,
                t: ar ? "قائمة الانتظار تملأ الإلغاء" : "The waitlist fills a cancellation",
                d: ar ? "حين يُلغى موعد، يُعرض على من ينتظر نفس الخدمة تلقائياً. الساعة الفارغة تُباع قبل أن يلاحظها أحد." : "When an appointment is cancelled, it is offered automatically to whoever is waiting for the same service. The empty hour is filled before anyone notices it." },
              { i: Users,
                t: ar ? "استرجاع المتغيّبين" : "Bringing back who stopped coming",
                d: ar ? "المريض الذي لم يعد منذ أشهر يُراسل برسالة تخصّه، لا برسالة جماعية." : "A patient who has not returned in months is messaged about their own case, not with a broadcast." },
              { i: AtSign,
                t: ar ? "التذكير قبل الموعد" : "The reminder before the visit",
                d: ar ? "تذكير يصل في الوقت الصحيح ويقبل التأكيد أو الإلغاء بردّ واحد — وهو أرخص علاج لعدم الحضور." : "A reminder that arrives at the right time and accepts a confirm or a cancel in one reply — the cheapest cure for a no-show there is." },
            ]} />
          </div>
        </div>
      </section>

      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <Head tag={ar ? "التشغيل" : "Getting live"} title={ar ? "من التوقيع إلى أول ردّ" : "From signing to the first reply"} />
          <div style={{ marginTop: "2.2rem" }}>
            <Steps steps={[
              { n: "01", t: ar ? "نربط رقمك" : "We connect your number",
                d: ar ? "رقم واتساب عيادتك الحالي، لا رقم جديد. نتحقّق من ميتا أنه لك قبل حفظ أي شيء." : "Your clinic's existing WhatsApp number, not a new one. We verify with Meta that it is yours before saving anything." },
              { n: "02", t: ar ? "نُعلّمها عيادتك" : "We teach it your clinic",
                d: ar ? "خدماتك وأسعارك وأطباؤك ودوامهم وسياستك في الإلغاء. تعرف عيادتك أنت، لا عيادة عامة." : "Your services, prices, doctors, rotas and cancellation policy. It knows your clinic, not a generic one." },
              { n: "03", t: ar ? "نجرّب على حالات حقيقية" : "We test on real cases",
                d: ar ? "نمرّر عليها الأسئلة التي يسألها مرضاك فعلاً، ونضبط ما يحتاج ضبطاً قبل أن تُفتح." : "We run the questions your patients actually ask, and tune what needs tuning before it opens." },
              { n: "04", t: ar ? "تفتح، وتراقب" : "It opens, and you watch",
                d: ar ? "كل محادثة ظاهرة في لوحتك. تستطيع التدخّل في أي لحظة، وتستطيع إيقافها بزرّ واحد." : "Every conversation is visible in your dashboard. You can step in at any moment, and switch it off with one button." },
            ]} />
          </div>

          <Reveal className="card" style={{ marginTop: "2.2rem", maxWidth: "70ch" }}>
            <h3 className="card__t">{ar ? "ما لا تفعله سُرى" : "What Sura will not do"}</h3>
            <p className="card__d">
              {ar
                ? "لا تشخّص، ولا تصف دواءً، ولا تعد بنتيجة علاج، ولا تخترع سعراً غير موجود عندك. حين يُسأل ما لا تعرفه، تقول إنها ستحوّل السؤال للعيادة — وتحوّله فعلاً."
                : "It does not diagnose, prescribe, promise a treatment outcome, or invent a price you do not have. When asked something it does not know, it says it will pass the question to the clinic — and it does."}
            </p>
            <Link href="/ai" className="btn btn--out btn--sm" style={{ marginTop: "1.2rem" }}>
              {ar ? "الحدود بالتفصيل" : "The boundaries in full"}
            </Link>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title={ar ? "شغّلها على رقمك" : "Run it on your own number"}
        lede={ar
          ? "نربط رقم عيادتك الحالي ونُعلّمها خدماتك. لا رقم جديد يُربك مرضاك."
          : "We connect your existing clinic number and teach it your services. No new number to confuse your patients."}
      />
    </>
  );
}
