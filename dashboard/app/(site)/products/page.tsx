"use client";

import Link from "next/link";
import { useSite } from "@/components/site/lang";
import { PageHero, CtaBand } from "@/components/site/kit";
import { ObjLayers, ObjShield, ObjCards } from "@/components/site/objects";
import { Reveal } from "@/components/site/reveal";

/* The portfolio.

   Two of the three are marked in development, plainly. A roadmap presented as a
   catalogue is the fastest way to lose a buyer who signs for something that does
   not exist yet — and the one product that IS finished carries more weight when
   it is not standing next to two implied ones. */
const P = {
  ar: [
    { t: "ClinicOS", s: "متاح الآن", live: true, href: "/products/clinic", A: ObjLayers,
      d: "نظام تشغيل العيادة الكامل: المواعيد والمرضى والفوترة والمخزون والرواتب والتأمين — ومعه سُرى." },
    { t: "TAWD AI", s: "قيد البناء", live: false, href: "/products/ai", A: ObjShield,
      d: "طبقة الذكاء تحت كل منتجات طَود: وكلاء يتعاملون مع المهام والمتابعة والتواصل مع المرضى." },
    { t: "TAWD Analytics", s: "قيد البناء", live: false, href: "/products/analytics", A: ObjCards,
      d: "تحليلات متقدّمة ورؤى تساعد على قرارات أذكى، عبر عيادة واحدة أو مجموعة." },
  ],
  en: [
    { t: "ClinicOS", s: "Available now", live: true, href: "/products/clinic", A: ObjLayers,
      d: "The full clinic operating system: scheduling, patients, invoicing, stock, payroll and insurance — with Sura on top." },
    { t: "TAWD AI", s: "In development", live: false, href: "/products/ai", A: ObjShield,
      d: "The intelligence layer beneath every TAWD product: agents handling tasks, follow-ups and patient communication." },
    { t: "TAWD Analytics", s: "In development", live: false, href: "/products/analytics", A: ObjCards,
      d: "Advanced analytics and insight for smarter decisions, across one clinic or a whole group." },
  ],
} as const;

export default function ProductsOverview() {
  const { lang } = useSite();
  const items = P[lang];
  return (
    <>
      <PageHero
        tag={lang === "ar" ? "المنتجات" : "Products"}
        title={lang === "ar" ? "منتجات مبنيّة لمستقبل الرعاية الصحية" : "Products built for the future of healthcare"}
        lede={lang === "ar"
          ? "حلول أصلها ذكاء اصطناعي، مصمّمة لتبسيط التشغيل وتحسين نتائج المرضى."
          : "AI-native solutions designed to streamline operations and improve patient outcomes."}
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
                  {p.live ? (lang === "ar" ? "استكشف" : "Explore") : (lang === "ar" ? "اعرف أكثر" : "Learn more")}
                </Link>
              </div>
              <div className="fcard__art"><p.A /></div>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand title={lang === "ar" ? "ابدأ بـ ClinicOS" : "Start with ClinicOS"} />
    </>
  );
}
