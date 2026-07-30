"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useSite } from "@/components/site/lang";

/* No published tiers, and that is the honest answer rather than a coy one.

   Every reference site shows three price cards. TAWD's price genuinely depends
   on doctor count, modules and message volume — printing $49/$124/$299 would
   invent a model the company does not have, and the first quote would then
   contradict the site. */
export default function PricingPage() {
  const { t } = useSite();
  const p = t.pricing;

  return (
    <>
      <section className="s-section" style={{ position: "relative" }}>
        <span className="s-bloom" aria-hidden />
        <div className="s-wrap" style={{ position: "relative", zIndex: 1 }}>
          <span className="s-eyebrow">{p.eyebrow}</span>
          <h1 className="s-h2" style={{ fontSize: "clamp(2rem, 5.5vw, 3.4rem)" }}>{p.title}</h1>
          <p className="s-lede">{p.lede}</p>
        </div>
      </section>

      <section className="s-section--tight">
        <div className="s-wrap s-grid s-grid--2" style={{ paddingBottom: "2rem" }}>
          <div className="s-card" style={{ padding: "2rem" }}>
            <h2 className="s-card__t" style={{ fontSize: "1.15rem", marginBottom: "1.3rem" }}>{p.whatTitle}</h2>
            <ul className="s-list">
              {p.what.map((w) => (
                <li key={w}><Check size={15} />{w}</li>
              ))}
            </ul>
          </div>

          <div className="s-card" style={{ padding: "2rem" }}>
            <h2 className="s-card__t" style={{ fontSize: "1.15rem", marginBottom: "1.3rem" }}>{p.modulesTitle}</h2>
            <ul className="s-list">
              {p.modules.map((m) => (
                <li key={m}><Plus size={15} />{m}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="s-section" style={{ background: "var(--s-bg-2)", borderBlock: "1px solid var(--s-line)", textAlign: "center" }}>
        <div className="s-wrap">
          <h2 className="s-h2" style={{ maxWidth: "22ch", marginInline: "auto" }}>{p.ctaTitle}</h2>
          <p className="s-lede" style={{ marginInline: "auto" }}>{p.ctaBody}</p>
          <Link href="/contact" className="s-btn s-btn--primary" style={{ marginTop: "1.8rem" }}>
            {p.ctaButton}
          </Link>
          <p style={{ fontSize: "0.78rem", color: "var(--s-text-4)", marginTop: "1.2rem" }}>{p.note}</p>
        </div>
      </section>
    </>
  );
}
