"use client";

import { Check, Users, Clock, MessageSquare, Wrench } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CardGrid, Steps, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";

/* Early access, in place of a Customers page.

   Every reference site has a wall of logos and three testimonials. TAWD has no
   customers, and inventing them is the single claim on this whole site that one
   phone call would disprove — which would then put every true claim in doubt.

   Saying "we are choosing our first clinics" is not a weaker page. It is the
   only page a founder-led company at this stage can put up without lying, and
   scarcity framed honestly converts better than a fabricated crowd. It also
   becomes a real Customers page the moment there is one real customer. */
const C = {
  ar: {
    tag: "الوصول المبكر",
    h1: "نختار أول خمس عيادات",
    lede: "طَود يعمل، ومُختبَر على بيئة تشغيل كاملة. لكنه لم يُشغَّل بعد في عيادة تستقبل مرضى — ونحن نفضّل أن نقول ذلك بدل أن نعرض شعارات لا نملكها.",
    getT: "ما تحصل عليه",
    get: [
      { t: "تشغيل بيدنا", d: "نُعدّ عيادتك بأنفسنا: الخدمات، الأطباء، الدوام، وربط واتساب. في يوم عمل واحد.", i: Wrench },
      { t: "خطّ مباشر مع المؤسّس", d: "لا تذكرة دعم ولا فريق وسيط. تكتب، ويردّ من كتب النظام.", i: MessageSquare },
      { t: "سعر مؤسّس ثابت", d: "السعر الذي تبدأ به يبقى لك، مهما ارتفع لاحقاً.", i: Clock },
      { t: "أولوية في ما يُبنى", d: "ما ينقصك يدخل خارطة الطريق قبل غيره.", i: Users },
    ],
    wantT: "ما نطلبه في المقابل",
    want: [
      { n: "٠١", t: "أن تستخدمه فعلاً", d: "لا تجربة على الورق. عيادة تعمل، ومرضى حقيقيون، ورسائل حقيقية." },
      { n: "٠٢", t: "أن تخبرنا حين يزعجك", d: "أسرع طريق لنظام جيّد هو أحد يقول لنا ما هو سيّئ فيه، مبكراً وبصراحة." },
      { n: "٠٣", t: "أن نذكر اسمك حين ترضى", d: "وفقط حين ترضى. لا شعار ولا اقتباس قبل إذنك المكتوب." },
    ],
    fitT: "لمن يناسب هذا",
    fit: [
      "عيادة تستقبل مرضى اليوم، لا مشروع لم يفتح بعد",
      "صاحب قرار يستطيع أن يقول نعم بنفسه",
      "استعداد لتغيير طريقة العمل، لا لنسخ الدفتر القديم إلى شاشة",
      "صبر على أسبوع أول فيه ملاحظات وتعديلات",
    ],
    cta: "قدّم عيادتك",
    ctaD: "أخبرنا عن عيادتك، ونردّ بصراحة — حتى لو كان الردّ أنها ليست الوقت المناسب.",
  },
  en: {
    tag: "Early access",
    h1: "We are choosing our first five clinics",
    lede: "TAWD works, and is tested against a full operating environment. But it has not yet run in a clinic seeing patients — and we would rather say so than show logos we do not have.",
    getT: "What you get",
    get: [
      { t: "We set it up ourselves", d: "Services, doctors, hours and the WhatsApp connection, configured by us. Within one working day.", i: Wrench },
      { t: "A direct line to the founder", d: "No ticket queue, no support tier. You write, and the person who built it answers.", i: MessageSquare },
      { t: "Founding price, locked", d: "The price you start on stays yours, however it moves later.", i: Clock },
      { t: "Priority on what gets built", d: "What you are missing goes to the front of the roadmap.", i: Users },
    ],
    wantT: "What we ask in return",
    want: [
      { n: "01", t: "That you actually use it", d: "Not a paper trial. A working clinic, real patients, real messages." },
      { n: "02", t: "That you tell us when it annoys you", d: "The fastest route to a good system is someone saying what is bad about it, early and bluntly." },
      { n: "03", t: "That we may name you when you are happy", d: "And only then. No logo and no quote without your written permission." },
    ],
    fitT: "Who this suits",
    fit: [
      "A clinic seeing patients today, not a practice that has not opened",
      "A decision-maker who can say yes themselves",
      "Willingness to change how you work, not to copy the old diary onto a screen",
      "Patience for a first week of notes and adjustments",
    ],
    cta: "Put your clinic forward",
    ctaD: "Tell us about your clinic and we'll answer straight — even if the answer is that now is not the time.",
  },
} as const;

export default function EarlyAccessPage() {
  const { lang } = useSite();
  const c = C[lang];
  return (
    <>
      <PageHero
        tag={c.tag} title={c.h1} lede={c.lede}
        cta={{ href: "/contact", label: c.cta }}
        cta2={{ href: "/products/clinic", label: lang === "ar" ? "شوف المنتج" : "See the product" }}
      />

      <section className="sec">
        <div className="wrap">
          <Head title={c.getT} />
          <CardGrid cols={2} items={c.get} />
        </div>
      </section>

      <section className="sec" style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,.012)" }}>
        <div className="wrap">
          <Head title={c.wantT} />
          <Steps steps={c.want} />
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <Head title={c.fitT} />
          <Reveal className="card" style={{ maxWidth: "72ch", padding: "2rem" }}>
            <ul className="list">
              {c.fit.map((f) => <li key={f}><Check size={16} />{f}</li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      <CtaBand title={c.cta} lede={c.ctaD} />
    </>
  );
}
