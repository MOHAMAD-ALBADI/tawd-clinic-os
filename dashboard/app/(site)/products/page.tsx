"use client";

import Link from "next/link";
import { useSite } from "@/components/site/lang";
import { PageHero, CtaBand } from "@/components/site/kit";
import { ObjLayers, ObjShield, ObjCards } from "@/components/site/objects";
import { Reveal } from "@/components/site/reveal";

/* The system, in three parts.

   These were three sub-brands — ClinicOS, TAWD AI, TAWD Analytics — which made
   one product read as a catalogue a buyer has to assemble, and put the
   company's own name third. There is one company, طَود, and one system. What
   follows are its parts, named for what they do rather than branded. */
const P = {
  ar: [
    { t: "إدارة العيادة", s: "التشغيل", href: "/products/clinic", A: ObjLayers,
      d: "المواعيد والملفات الطبية والفوترة الضريبية والمخزون والرواتب والتأمين والخطط العلاجية — في نظام واحد بالعربية وعلى ضريبة عُمان." },
    { t: "سُرى", s: "الذكاء", href: "/products/ai", A: ObjShield,
      d: "تردّ على مرضاك في واتساب وإنستغرام بالعربية والإنجليزية، تقرأ جدول الطبيب وتحجز فيه، وتُصعّد الحالة الطارئة لفريقك في ثوانٍ." },
    { t: "التقارير والأرقام", s: "القرار", href: "/products/analytics", A: ObjCards,
      d: "نسبة التحصيل، وعدم الحضور بالريال، وإنتاجية كل طبيب، والربح الشهري — محسوبة من عملك الفعلي لا من تقدير على ورقة." },
  ],
  en: [
    { t: "Clinic management", s: "Operations", href: "/products/clinic", A: ObjLayers,
      d: "Appointments, clinical records, VAT invoicing, stock, payroll, insurance and treatment plans — in one system, in Arabic, on Omani VAT." },
    { t: "Sura", s: "Intelligence", href: "/products/ai", A: ObjShield,
      d: "Answers your patients on WhatsApp and Instagram in Arabic and English, reads the doctor's schedule and books into it, and escalates an emergency to your team in seconds." },
    { t: "Reporting", s: "Decisions", href: "/products/analytics", A: ObjCards,
      d: "Collection rate, no-shows in riyals, productivity per doctor and monthly profit — computed from your actual work rather than estimated on a sheet." },
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
        title={ar
          ? "نظام واحد يُدير العيادة من أول رسالة إلى إقفال اليوم"
          : "One system that runs the clinic from the first message to the daily close"}
        lede={ar
          ? "لا مجموعة أدوات تربطها بنفسك. التشغيل والذكاء والأرقام في مكان واحد، وما يحدث في أحدها يظهر فوراً في الآخر."
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
                  {ar ? "استكشف" : "Explore"}
                </Link>
              </div>
              <div className="fcard__art"><p.A /></div>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand
        title={ar ? "شوفه على عيادتك أنت" : "See it on your own clinic"}
        lede={ar
          ? "عرض مباشر على تخصّص عيادتك وحجمها — لا شرائح عرض."
          : "A live demo on your speciality and your size — not a slide deck."}
      />
    </>
  );
}
