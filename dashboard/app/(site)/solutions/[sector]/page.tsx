"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CardGrid, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";
import { bySlug, SECTORS } from "@/lib/site/content/solutions";

/* Seven sector pages from one file.

   Adding an eighth practice type is an entry in solutions.ts — no route, no
   component, no layout decision. That was the test the component kit had to
   pass, and this is where it is paid off. */
export default function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = use(params);
  const { lang } = useSite();
  const s = bySlug(sector);
  if (!s) notFound();

  const c = s[lang];
  const others = SECTORS.filter((x) => x.slug !== sector).slice(0, 3);

  return (
    <>
      <PageHero
        tag={c.name}
        title={c.h1}
        lede={c.lede}
        cta={{ href: "/contact", label: c.close }}
        cta2={{ href: "/pricing", label: lang === "ar" ? "الأسعار" : "Pricing" }}
      />

      {/* The pains first. A page that opens with features asks the reader to
          recognise themselves in a feature list; opening with the problem lets
          them recognise themselves in a sentence. */}
      <section className="sec">
        <div className="wrap">
          <Head
            tag={lang === "ar" ? "المألوف" : "Sound familiar"}
            title={lang === "ar" ? "ثلاثة أشياء تعرفها" : "Three things you already know"}
          />
          <div className="grid3">
            {c.pains.map((p, i) => (
              <Reveal key={p} delay={i * 70} className="card">
                <span className="ico" style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,.28)", background: "rgba(245,158,11,.1)" }}>
                  <AlertCircle size={20} />
                </span>
                <p className="card__d" style={{ color: "var(--tx-1)", fontSize: "0.92rem" }}>{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,0.012)" }}>
        <div className="wrap">
          <Head
            tag={lang === "ar" ? "ما يتغيّر" : "What changes"}
            title={lang === "ar" ? `طَود في ${c.name}` : `TAWD for ${c.name.toLowerCase()}`}
          />
          <div className="grid2">
            {c.gains.map((g, i) => (
              <Reveal key={g.t} delay={i * 60} className="card card--lift">
                <span className="ico"><Check size={20} /></span>
                <h3 className="card__t">{g.t}</h3>
                <p className="card__d">{g.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <Head title={lang === "ar" ? "تخصّصات أخرى" : "Other practices"} />
          <CardGrid
            items={others.map((o) => ({
              t: o[lang].name,
              d: o[lang].lede,
              href: `/solutions/${o.slug}`,
            }))}
          />
        </div>
      </section>

      <CtaBand title={c.close} />
    </>
  );
}
