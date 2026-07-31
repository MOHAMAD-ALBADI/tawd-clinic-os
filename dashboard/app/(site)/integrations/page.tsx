"use client";

import { MessageCircle, AtSign, Globe, CreditCard, Mail, CalendarDays, Workflow, Database, Server, Braces, Receipt } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";

/* Integrations, split by whether they are live.

   The reference site lists six logos with no state on any of them. A prospect
   who signs up because "Calendar" was in the row and then finds it is not built
   is a refund and a bad word. State on every row costs one label.

   The groups here are also the anchor targets the nav links to, so "Payments"
   in the menu lands on payments rather than near it. */
const C = {
  ar: {
    tag: "التكاملات",
    h1: "يتّصل بما تستخدمه العيادة أصلاً",
    lede: "قنوات المرضى، والدفع، والبنية التي يعمل عليها النظام. كل بند هنا مكتوب بحالته الحقيقية.",
    chanT: "قنوات المرضى",
    chanD: "حيث يراسلك المريض اليوم. لا تطبيق جديد عليه أن يُنزّله.",
    payT: "المدفوعات والمستندات",
    payD: "كيف يدفع المريض، وكيف يستلم ما يُثبت أنه دفع.",
    soonT: "قيد البناء",
    soonD: "مذكورة هنا لأنها ستأتي، ومُعلَّمة لأنها لم تأتِ بعد.",
    stackT: "البنية التي نعمل عليها",
    stackD: "لسنا نستضيف بياناتك على خادم تحت مكتب. هذه هي الطبقة تحت النظام.",
    live: "يعمل",
    soonTag: "قيد البناء",
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
    soonList: [
      { n: "الرسائل النصية (SMS)", d: "قناة احتياطية لمن لا يستخدم واتساب.", i: MessageCircle },
      { n: "تقويم Google", d: "مزامنة جدول الطبيب مع تقويمه الشخصي.", i: CalendarDays },
      { n: "واجهة برمجة عامة", d: "REST موثّقة للربط مع أنظمتك الخاصة.", i: Braces },
    ],
    stack: [
      { n: "Supabase", d: "Postgres مُدار، أمان على مستوى الصفّ، ونسخ احتياطية يومية.", i: Database },
      { n: "Vercel", d: "استضافة على شبكة حافّة عالمية.", i: Server },
      { n: "n8n", d: "محرّك الأتمتة خلف التذكير والمتابعة وقوائم الانتظار.", i: Workflow },
    ],
    ask: "تحتاج ربطاً غير مذكور؟",
    askD: "قل لنا ماذا تستخدم اليوم، ونقول لك بصراحة إن كان ممكناً ومتى.",
  },
  en: {
    tag: "Integrations",
    h1: "It connects to what the clinic already uses",
    lede: "Patient channels, payments, and the infrastructure the system runs on. Every entry here carries its real state.",
    chanT: "Patient channels",
    chanD: "Where your patients already are. Nothing new for them to install.",
    payT: "Payments and documents",
    payD: "How a patient pays, and how they receive the proof that they did.",
    soonT: "In development",
    soonD: "Listed because they are coming, and labelled because they have not arrived.",
    stackT: "What we run on",
    stackD: "Your data is not on a server under a desk. This is the layer beneath the system.",
    live: "Live",
    soonTag: "In development",
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
    soonList: [
      { n: "SMS", d: "A fallback channel for patients who do not use WhatsApp.", i: MessageCircle },
      { n: "Google Calendar", d: "Syncing a doctor's clinic schedule to their own calendar.", i: CalendarDays },
      { n: "Public API", d: "A documented REST surface for connecting your own systems.", i: Braces },
    ],
    stack: [
      { n: "Supabase", d: "Managed Postgres, row-level security, and daily backups.", i: Database },
      { n: "Vercel", d: "Hosting on a global edge network.", i: Server },
      { n: "n8n", d: "The automation engine behind reminders, follow-ups and waitlists.", i: Workflow },
    ],
    ask: "Need something that is not listed?",
    askD: "Tell us what you use today and we'll tell you honestly whether it is possible, and when.",
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

      <section className="sec" id="development" style={{ scrollMarginTop: 90 }}>
        <div className="wrap">
          <Head title={c.soonT} lede={c.soonD} />
          <Rows items={c.soonList} state={c.soonTag} />
        </div>
      </section>

      <section
        className="sec" id="stack"
        style={{ borderTop: "1px solid var(--line)", scrollMarginTop: 90 }}
      >
        <div className="wrap">
          <Head title={c.stackT} lede={c.stackD} />
          <Rows items={c.stack} />
        </div>
      </section>

      <CtaBand title={c.ask} lede={c.askD} />
    </>
  );
}
