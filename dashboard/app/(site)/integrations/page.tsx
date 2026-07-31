"use client";

import { MessageCircle, AtSign, Globe, CreditCard, Mail, Receipt } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";

/* Integrations.

   Only what a clinic connects to: the channels its patients already use, and
   how money and documents move. The platform TAWD itself runs on is not a
   selling point to a clinic owner and is not published — a supplier list is
   the first thing a competitor reads and the last thing a buyer cares about.

   The groups are also the anchor targets the nav links to, so "Payments" in
   the menu lands on payments rather than near it. */
const C = {
  ar: {
    tag: "التكاملات",
    h1: "يتّصل بما تستخدمه العيادة أصلاً",
    lede: "يعمل مع ما تستخدمه عيادتك اليوم — قناة المريض، وطريقة الدفع، والمستند الذي يستلمه. بلا تطبيق جديد على أحد.",
    chanT: "قنوات المرضى",
    chanD: "حيث يراسلك المريض اليوم. لا تطبيق جديد عليه أن يُنزّله.",
    payT: "المدفوعات والمستندات",
    payD: "كيف يدفع المريض، وكيف يستلم ما يُثبت أنه دفع.",
    live: "يعمل",
    chan: [
      { n: "WhatsApp Business", d: "قناة سُرى الأساسية: استقبال، ردّ، رسائل صوتية، تذكير المواعيد، والحملات — على رقم عيادتك نفسه.", i: MessageCircle },
      { n: "Instagram", d: "رسائل إنستغرام المباشرة، بنفس الوكيل ونفس السياق.", i: AtSign },
      { n: "المحادثة على الموقع", d: "ودجت محادثة تضعها في موقع عيادتك، تصل لنفس صندوق الوارد.", i: Globe },
    ],
    pay: [
      { n: "ثواني (Thawani)", d: "الدفع الإلكتروني في عُمان — روابط دفع للمريض، واشتراك العيادة نفسها. لا تمرّ بيانات بطاقة عبر خوادمنا.", i: CreditCard },
      { n: "الفوترة الضريبية العُمانية", d: "ضريبة القيمة المضافة ٥٪ محسوبة على الفاتورة، ورقم ضريبي على المستند.", i: Receipt },
      { n: "البريد الإلكتروني", d: "الفواتير والإيصالات وكشوف الحساب، من هوية عيادتك لا من هويتنا.", i: Mail },
    ],
    ask: "تحتاج ربطاً غير مذكور؟",
    askD: "قل لنا ما تستخدمه اليوم ونرتّب لك الربط.",
  },
  en: {
    tag: "Integrations",
    h1: "It connects to what the clinic already uses",
    lede: "It works with what your clinic uses today — the channel your patient writes on, how they pay, and the document they receive. Nothing new for anyone to install.",
    chanT: "Patient channels",
    chanD: "Where your patients already are. Nothing new for them to install.",
    payT: "Payments and documents",
    payD: "How a patient pays, and how they receive the proof that they did.",
    live: "Live",
    chan: [
      { n: "WhatsApp Business", d: "Sura's primary channel: receiving, replying, voice notes, reminders and campaigns — on your clinic's own number.", i: MessageCircle },
      { n: "Instagram", d: "Direct messages, same agent and same context.", i: AtSign },
      { n: "Web chat", d: "A chat widget on your clinic's site, landing in the same inbox.", i: Globe },
    ],
    pay: [
      { n: "Thawani", d: "Online payments in Oman — payment links for patients, and the clinic's own subscription. No card data passes through our servers.", i: CreditCard },
      { n: "Omani VAT invoicing", d: "5% VAT computed on the invoice, with the tax number on the document.", i: Receipt },
      { n: "Email", d: "Invoices, receipts and statements, sent from your clinic's identity rather than ours.", i: Mail },
    ],
    ask: "Need something that is not listed?",
    askD: "Tell us what you use today and we will arrange the connection.",
  },
} as const;

type Row = { n: string; d: string; i: typeof MessageCircle };

function Rows({ items, state }: { items: readonly Row[]; state?: string }) {
  return (
    <div className="intg">
      {items.map((x, i) => (
        <Reveal key={x.n} delay={i * 50} className="intg__row">
          <span className="intg__ic"><x.i size={20} /></span>
          <div className="intg__body">
            <b>{x.n}</b>
            <p>{x.d}</p>
          </div>
          {state && <span className="intg__state">{state}</span>}
        </Reveal>
      ))}
    </div>
  );
}

export default function IntegrationsPage() {
  const { lang } = useSite();
  const c = C[lang];
  return (
    <>
      <PageHero tag={c.tag} title={c.h1} lede={c.lede} />

      <section className="sec" id="channels" style={{ scrollMarginTop: 90 }}>
        <div className="wrap">
          <Head title={c.chanT} lede={c.chanD} />
          <Rows items={c.chan} state={c.live} />
        </div>
      </section>

      <section
        className="sec" id="payments"
        style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,.012)", scrollMarginTop: 90 }}
      >
        <div className="wrap">
          <Head title={c.payT} lede={c.payD} />
          <Rows items={c.pay} state={c.live} />
        </div>
      </section>

      <CtaBand title={c.ask} lede={c.askD} />
    </>
  );
}
