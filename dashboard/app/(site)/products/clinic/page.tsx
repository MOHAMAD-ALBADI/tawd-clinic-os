"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Reveal } from "@/components/site/reveal";
import { FeatureRows, Modules, ClosingCta } from "@/components/site/sections";

/* The product page.

   It used to end with a Screens block that repeated the same three captures the
   feature rows already show, one after another with no argument attached. The
   rows do that job properly — each screen beside the claim it proves — so the
   duplicate is gone rather than restyled. */
export default function ProductPage() {
  const { t } = useSite();
  const p = t.product;

  return (
    <>
      <section className="sec">
        <div className="wrap" style={{ maxWidth: "60ch" }}>
          <Reveal>
            <span className="pill">{p.eyebrow}</span>
            <h1 className="h2" style={{ marginTop: "1.2rem", fontSize: "clamp(2rem, 4.4vw, 3.2rem)" }}>
              {p.title}
            </h1>
            <p className="lede" style={{ marginTop: "1.2rem" }}>{p.lede}</p>
          </Reveal>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <Reveal style={{ marginBottom: "2.6rem", maxWidth: "58ch" }}>
            <h2 className="h2">{p.suraTitle}</h2>
            <p className="lede" style={{ marginTop: "1rem" }}>{p.suraLede}</p>
          </Reveal>

          <div className="grid3">
            {p.suraPoints.map((s, i) => (
              <Reveal key={s.t} delay={i * 60} className="card card--lift">
                <span className="ico"><Check size={20} /></span>
                <h3 className="card__t">{s.t}</h3>
                <p className="card__d">{s.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <FeatureRows />
      <Modules />
      <ClosingCta />

      <section className="sec--tight" style={{ paddingBottom: "3rem", textAlign: "center" }}>
        <div className="wrap">
          <Link href="/pricing" className="btn btn--out">{t.nav.pricing}</Link>
        </div>
      </section>
    </>
  );
}
