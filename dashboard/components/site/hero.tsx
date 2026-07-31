"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Sparkles, MessageCircle, AtSign, Globe, CreditCard, Workflow, Database } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { ProductPanel } from "@/components/site/panel";
import { Reveal } from "@/components/site/reveal";

const COPY = {
  ar: {
    badge: "شركة ذكاء اصطناعي للقطاع الصحي",
    h1a: "نُعيد تعريف إدارة العيادات",
    h1b: "بالذكاء الاصطناعي",
    lede:
      "طَود شركة عُمانية تبني أنظمة ذكية تساعد مقدّمي الرعاية الصحية على خدمة أفضل، وكفاءة أعلى، ونمو يمكن قياسه.",
    cta1: "احجز عرضاً توضيحياً",
    cta2: "استكشف المنتج",
    stackT: "مبنيّ على بنية تحتية تعتمد عليها الشركات",
  },
  en: {
    badge: "An AI company for healthcare",
    h1a: "Redefining clinic operations",
    h1b: "with artificial intelligence",
    lede:
      "TAWD is an Omani company building intelligent systems that help healthcare providers deliver better care, run more efficiently, and grow measurably.",
    cta1: "Book a demo",
    cta2: "Explore the product",
    stackT: "Built on infrastructure enterprises rely on",
  },
} as const;

/* Named because they are real and verifiable — the channels Sura runs on and the
   platforms the product is built on.

   The reference has a row of six clinic logos under the hero. TAWD has no
   customers yet, and inventing six would be the one thing on this page a
   prospect could catch us out on. This slot earns its place with something
   true instead of leaving a hole where credibility should go. */
const STACK = [
  { n: "WhatsApp", s: "Business Platform", i: MessageCircle },
  { n: "Instagram", s: "Messaging API", i: AtSign },
  { n: "Supabase", s: "Postgres · RLS", i: Database },
  { n: "Vercel", s: "Edge Network", i: Globe },
  { n: "Thawani", s: "Payments · Oman", i: CreditCard },
  { n: "n8n", s: "Automation", i: Workflow },
] as const;

function Arrow() {
  const { lang } = useSite();
  const I = lang === "ar" ? ArrowLeft : ArrowRight;
  return <I size={16} />;
}

export function Hero() {
  const { lang } = useSite();
  const c = COPY[lang];

  return (
    <>
      <section className="hero">
        <div className="wrap hero__grid">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 78, damping: 20 }}
          >
            <span className="pill"><Sparkles size={13} /> {c.badge}</span>
            <h1>
              {c.h1a}
              <span className="hero__blue">{c.h1b}</span>
            </h1>
            <p className="hero__lede">{c.lede}</p>
            <div className="hero__btns">
              <Link href="/contact" className="btn btn--pri">{c.cta1} <Arrow /></Link>
              <Link href="/product" className="btn btn--out">{c.cta2}</Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 62, damping: 19, delay: 0.12 }}
          >
            <ProductPanel />
          </motion.div>
        </div>
      </section>

      <section className="logos sec--tight">
        <div className="wrap">
          <p className="logos__t">{c.stackT}</p>
          <div className="logos__row">
            {STACK.map((s) => (
              <span key={s.n} className="logos__i">
                <s.i size={19} />
                <span>{s.n}<em>{s.s}</em></span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* The three-object row. Each card carries one isometric object, matching the
   reference's composition without copying its shapes. */
import { ObjLayers, ObjShield, ObjCards } from "@/components/site/objects";

/* Each card carries a destination.

   They shipped with an arrow button that went nowhere: three cards on the
   homepage that look clickable, invite the click, and answer it with
   nothing. The arrow is the affordance, so the whole card is the link. */
const TRI = {
  ar: [
    { t: "أنظمة ذكية", href: "/ai", d: "ذكاء اصطناعي يردّ على مرضاك ويحجز لهم فعلياً — لا ردّ آلي، بل قرار داخل نظام العيادة.", A: ObjLayers },
    { t: "أمان موثوق", href: "/security", d: "عزل بين العيادات مفروض في قاعدة البيانات نفسها، وسجلّ عمليات لا يُعدَّل ولا يُحذف.", A: ObjShield },
    { t: "كل شيء في مكان واحد", href: "/products/clinic", d: "المواعيد والمرضى والفواتير والمخزون والرواتب والتأمين — من لوحة واحدة.", A: ObjCards },
  ],
  en: [
    { t: "Intelligent systems", href: "/ai", d: "An AI that answers your patients and actually books them — a decision inside the clinic's system, not a canned reply.", A: ObjLayers },
    { t: "Security you can check", href: "/security", d: "Isolation between clinics enforced by the database itself, and an audit log that cannot be edited or deleted.", A: ObjShield },
    { t: "Everything in one place", href: "/products/clinic", d: "Appointments, patients, invoicing, stock, payroll and insurance — from a single console.", A: ObjCards },
  ],
} as const;

export function TriCards() {
  const { lang } = useSite();
  const items = TRI[lang];
  return (
    <section className="sec">
      <div className="wrap tri">
        {items.map((x, i) => (
          <Reveal key={x.t} delay={i * 90} as="div">
            <Link href={x.href} className="fcard">
              <div>
                <h3 className="fcard__t">{x.t}</h3>
                <p className="fcard__d">{x.d}</p>
                <span className="fcard__go"><Arrow /></span>
              </div>
              <div className="fcard__art"><x.A /></div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
