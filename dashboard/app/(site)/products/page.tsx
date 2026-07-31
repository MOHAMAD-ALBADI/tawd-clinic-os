"use client";

import Link from "next/link";
import { useSite } from "@/components/site/lang";
import { PageHero, CtaBand, StatRow } from "@/components/site/kit";
import { ObjLayers, ObjShield, ObjCards } from "@/components/site/objects";
import { Reveal } from "@/components/site/reveal";

/* The system overview.

   This page used to list three sub-brands — ClinicOS, TAWD AI, TAWD Analytics
   — which made one system look like a product line a buyer has to assemble,
   and pushed the company's own name into third place. There is one product. It
   is called طَود. What follows are its three halves, not three things to buy.

   The isometric objects stay, because a page of three text cards is the thing
   the whole visual direction was rebuilt to avoid. */
const P = {
  ar: [
    {
      t: "إدارة العيادة", s: "التشغيل", href: "/products/clinic", A: ObjLayers,
      d: "المواعيد والملفات الطبية والفوترة الضريبية والمخزون والرواتب والتأمين والخطط العلاجية — في نظام واحد، بالعربية، وعلى ضريبة عُمان.",
      go: "استكشف",
    },
    {
      t: "سُرى", s: "الذكاء", href: "/ai", A: ObjShield,
      d: "تردّ على مرضاك في واتساب وإنستغرام بالعربية والإنجليزية، تقرأ جدول الطبيب وتحجز فيه، وتُصعّد الحالة الطارئة لفريقك في ثوانٍ.",
      go: "شوف كيف تعمل",
    },
    {
      t: "التقارير والأرقام", s: "القرار", href: "/products/clinic#reports", A: ObjCards,
      d: "نسبة التحصيل، وعدم الحضور بالريال، وإنتاجية كل طبيب، والربح الشهري — محسوبة من عملك الفعلي لا من تقدير على ورقة.",
      go: "شوف التقارير",
    },
  ],
  en: [
    {
      t: "Clinic management", s: "Operations", href: "/products/clinic", A: ObjLayers,
      d: "Appointments, clinical records, VAT invoicing, stock, payroll, insurance and treatment plans — in one system, in Arabic, on Omani VAT.",
      go: "Explore",
    },
    {
      t: "Sura", s: "Intelligence", href: "/ai", A: ObjShield,
      d: "Answers your patients on WhatsApp and Instagram in Arabic and English, reads the doctor's schedule and books into it, and escalates an emergency to your team in seconds.",
      go: "See how it works",
    },
    {
      t: "Reporting", s: "Decisions", href: "/products/clinic#reports", A: ObjCards,
      d: "Collection rate, no-shows in riyals, productivity per doctor and monthly profit — computed from your actual work rather than estimated on a sheet.",
      go: "See the reports",
    },
  ],
} as const;

export default function ProductsOverview() {
  const { lang } = useSite();
  const ar = lang === "ar";
  const items = P[lang];

  return (
    <>
      <PageHero
        tag={ar ? "النظام" : "The system"}
        title={ar ? "نظام واحد يُدير العيادة من أول رسالة إلى إقفال اليوم" : "One system that runs the clinic from the first message to the daily close"}
        lede={ar
          ? "لا مجموعة أدوات تربطها بنفسك. التشغيل والذكاء والأرقام في مكان واحد، وكل ما يحدث في أحدها يظهر فوراً في الآخر."
          : "Not a set of tools you wire together yourself. Operations, intelligence and reporting in one place, where anything that happens in one appears immediately in the others."}
        cta={{ href: "/contact", label: ar ? "احجز عرضاً مباشراً" : "Book a live demo" }}
        cta2={{ href: "/pricing", label: ar ? "شوف الأسعار" : "See pricing" }}
      />

      <section className="sec">
        <div className="wrap tri">
          {items.map((p, i) => (
            <Reveal key={p.t} delay={i * 90} className="fcard">
              <div>
                <span className="pill" style={{ marginBottom: "1rem" }}>{p.s}</span>
                <h3 className="fcard__t">{p.t}</h3>
                <p className="fcard__d">{p.d}</p>
                <Link href={p.href} className="btn btn--out btn--sm" style={{ marginTop: "1.3rem" }}>
                  {p.go}
                </Link>
              </div>
              <div className="fcard__art"><p.A /></div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <StatRow items={ar
            ? [
                { v: "١٢+", l: "وحدة تشغيل داخل النظام" },
                { v: "٢٤/٧", l: "ردّ على المريض بلا انقطاع" },
                { v: "لغتان", l: "عربي وإنجليزي بلا إعداد" },
                { v: "١٠٠٪", l: "عزل بيانات كل عيادة" },
              ]
            : [
                { v: "12+", l: "operational modules in one system" },
                { v: "24/7", l: "patients answered without a gap" },
                { v: "2", l: "languages, with no setup" },
                { v: "100%", l: "isolation between clinics" },
              ]} />
        </div>
      </section>

      <CtaBand
        title={ar ? "شوفه على عيادتك أنت" : "See it on your own clinic"}
        lede={ar
          ? "عرض مباشر على بياناتك ونوع تخصّصك — لا شرائح عرض."
          : "A live demo on your data and your speciality — not a slide deck."}
      />
    </>
  );
}
