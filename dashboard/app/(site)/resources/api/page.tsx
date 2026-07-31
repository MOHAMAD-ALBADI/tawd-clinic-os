"use client";

import { useSite } from "@/components/site/lang";
import { PageHero, Head, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";

/* The API reference.

   Scoped to the four endpoints that exist. Publishing a reference for routes we
   have not built would be the same lie as a fake customer logo, wearing a
   developer's clothes — and developers check. */
const EP = [
  {
    m: "POST", p: "/api/instagram/webhook",
    ar: "استقبال رسائل إنستغرام", en: "Receive Instagram messages",
    arD: "نقطة استقبال ويبهوك ميتا. توقيع الطلب يُتحقّق منه على الجسم الخام قبل التحليل، والطلب غير الموقّع يُرفض.",
    enD: "Meta's webhook endpoint. The signature is verified against the raw body before parsing, and an unsigned request is refused.",
    auth: "X-Hub-Signature-256",
  },
  {
    m: "GET", p: "/api/instagram/webhook",
    ar: "تحقّق الاشتراك", en: "Subscription handshake",
    arD: "المصافحة التي تجريها ميتا مرّة عند الاشتراك، وتُعيد التحدّي كما هو إن طابق الرمز.",
    enD: "The one-off handshake Meta performs on subscribe; echoes the challenge verbatim when the token matches.",
    auth: "hub.verify_token",
  },
  {
    m: "POST", p: "/api/sura/ask",
    ar: "سؤال سُرى من اللوحة", en: "Ask Sura from the dashboard",
    arD: "يحوّل سؤالاً بلغة طبيعية إلى خطة استعلام مقيّدة على جداول محدّدة، ويعيد النتيجة. لا SQL حرّ.",
    enD: "Turns a natural-language question into a whitelisted query plan over specific tables and returns the result. No free-form SQL.",
    auth: "Session · clinic-scoped",
  },
  {
    m: "POST", p: "/api/thawani/subscription",
    ar: "إنشاء رابط دفع اشتراك", en: "Create a subscription payment link",
    arD: "ينشئ جلسة دفع لدى ثواني ويعيد رابطها. لا تمرّ بيانات بطاقة عبر خوادمنا.",
    enD: "Creates a Thawani checkout session and returns its link. No card data passes through our servers.",
    auth: "Session · platform",
  },
] as const;

export default function ApiPage() {
  const { lang } = useSite();
  const ar = lang === "ar";

  return (
    <>
      <PageHero
        tag={ar ? "واجهة البرمجة" : "API"}
        title={ar ? "نقاط النهاية المتاحة اليوم" : "The endpoints available today"}
        lede={ar
          ? "هذه كل الواجهات التي يعرضها النظام حالياً. واجهة عامة موثّقة للربط بأنظمتك قيد البناء — ونقول ذلك بدل أن نوثّق ما لم يُبنَ."
          : "This is every interface the system currently exposes. A documented public API for connecting your own systems is in development — and we say so rather than documenting what does not exist."}
      />

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <Head title={ar ? "المتاح" : "Available"} />
          {EP.map((e, i) => (
            <Reveal key={e.p + e.m} delay={i * 60} className="ep">
              <div className="ep__top">
                <span className={`ep__m ep__m--${e.m.toLowerCase()}`}>{e.m}</span>
                <code className="ep__p mono">{e.p}</code>
              </div>
              <b className="ep__t">{ar ? e.ar : e.en}</b>
              <p className="ep__d">{ar ? e.arD : e.enD}</p>
              <p className="ep__a mono">{ar ? "المصادقة" : "Auth"}: {e.auth}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand
        title={ar ? "تحتاج ربطاً برمجياً؟" : "Need a programmatic integration?"}
        lede={ar
          ? "قل لنا ماذا تريد أن تربط، ونقول لك بصراحة إن كان ممكناً اليوم أو متى سيكون."
          : "Tell us what you want to connect and we'll say honestly whether it is possible today, or when it will be."}
      />
    </>
  );
}
