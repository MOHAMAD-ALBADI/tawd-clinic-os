"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Screens } from "@/components/site/screens";

export default function ProductPage() {
  const { t } = useSite();
  const p = t.product;
  const h = t.home;

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

      <section className="s-section--tight" style={{ borderBlock: "1px solid var(--s-line)", background: "var(--s-bg-2)" }}>
        <div className="s-wrap" style={{ paddingBlock: "3rem" }}>
          <h2 className="s-h2" style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.3rem)" }}>{p.suraTitle}</h2>
          <p className="s-lede" style={{ marginBottom: "2.4rem" }}>{p.suraLede}</p>
          <div className="s-grid s-grid--2 s-grid--3">
            {p.suraPoints.map((s) => (
              <div key={s.t} className="s-card">
                <h3 className="s-card__t">{s.t}</h3>
                <p className="s-card__d">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <h2 className="s-h2">{p.opsTitle}</h2>
          <p className="s-lede" style={{ marginBottom: "2.4rem" }}>{h.depthLede}</p>
          <ul className="s-grid s-grid--2">
            {h.depth.map((d) => (
              <li key={d.t} className="s-card" style={{ listStyle: "none" }}>
                <h3 className="s-card__t" style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <Check size={16} style={{ color: "var(--s-blue-lit)", flexShrink: 0 }} />
                  {d.t}
                </h3>
                <p className="s-card__d">{d.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Screens />

      <section className="s-section" style={{ borderTop: "1px solid var(--s-line)", textAlign: "center" }}>
        <div className="s-wrap">
          <h2 className="s-h2" style={{ maxWidth: "20ch", marginInline: "auto" }}>{h.ctaTitle}</h2>
          <Link href="/contact" className="s-btn s-btn--primary" style={{ marginTop: "1.6rem" }}>
            {h.ctaButton}
          </Link>
        </div>
      </section>
    </>
  );
}
