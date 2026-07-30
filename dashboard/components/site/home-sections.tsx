"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Signature } from "@/components/site/signature";

/* An arrow that points the way the language reads. A left arrow on an Arabic
   page points back, not forward. */
function Arrow() {
  const { lang } = useSite();
  const I = lang === "ar" ? ArrowLeft : ArrowRight;
  return <I size={16} />;
}

export function Hero() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-hero">
      <span className="s-bloom" aria-hidden />
      <div className="s-wrap s-hero__grid">
        <div>
          <span className="s-eyebrow">{h.eyebrow}</span>
          <h1>
            {h.title1}
            <span className="s-hero__accent">{h.title2}</span>
          </h1>
          <p className="s-lede">{h.lede}</p>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginTop: "2rem" }}>
            <Link href="/contact" className="s-btn s-btn--primary">
              {h.ctaPrimary} <Arrow />
            </Link>
            <Link href="/product" className="s-btn s-btn--ghost">{h.ctaSecondary}</Link>
          </div>
        </div>

        <Signature />
      </div>
    </section>
  );
}

export function ProblemStrip() {
  const { t } = useSite();
  return (
    <section className="s-section--tight" style={{ borderBlock: "1px solid var(--s-line)", background: "var(--s-bg-2)" }}>
      <div className="s-wrap" style={{ paddingBlock: "2.6rem" }}>
        <h2 className="s-display" style={{ fontSize: "clamp(1.3rem, 3vw, 1.9rem)", maxWidth: "24ch" }}>
          {t.home.stripTitle}
        </h2>
        <p className="s-lede" style={{ marginTop: "0.9rem" }}>{t.home.stripBody}</p>
      </div>
    </section>
  );
}

export function Flow() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section">
      <div className="s-wrap" style={{ marginBottom: "2.8rem" }}>
        <span className="s-eyebrow">01 — 04</span>
        <h2 className="s-h2">{h.flowTitle}</h2>
        <p className="s-lede">{h.flowLede}</p>
      </div>
      {/* Numbered because it genuinely is a sequence: each step can only happen
          after the one before it. */}
      <div className="s-flow">
        {h.flow.map((s) => (
          <div key={s.n} className="s-flow__step">
            <span className="s-flow__n s-num">{s.n}</span>
            <h3 className="s-flow__t">{s.t}</h3>
            <p className="s-flow__d">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Proof() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section">
      <div className="s-wrap">
        <span className="s-eyebrow">{h.proofTitle}</span>
        <p className="s-lede" style={{ marginBottom: "2rem" }}>{h.proofLede}</p>

        <div className="s-stats">
          {h.proof.map((p) => (
            <div key={p.l} className="s-stat">
              <p className="s-stat__v s-num">{p.v}</p>
              <p className="s-stat__l">{p.l}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "0.78rem", color: "var(--s-text-4)", marginTop: "1rem", lineHeight: 1.7 }}>
          {h.proofNote}
        </p>
      </div>
    </section>
  );
}

export function Depth() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section" style={{ background: "var(--s-bg-2)", borderBlock: "1px solid var(--s-line)" }}>
      <div className="s-wrap">
        <h2 className="s-h2">{h.depthTitle}</h2>
        <p className="s-lede" style={{ marginBottom: "2.5rem" }}>{h.depthLede}</p>
        <div className="s-grid s-grid--2 s-grid--3">
          {h.depth.map((d) => (
            <div key={d.t} className="s-card">
              <h3 className="s-card__t">{d.t}</h3>
              <p className="s-card__d">{d.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section" style={{ position: "relative", overflow: "hidden" }}>
      <span className="s-bloom" style={{ insetBlockStart: "-60%", opacity: 0.7 }} aria-hidden />
      <div className="s-wrap" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <h2 className="s-h2" style={{ maxWidth: "20ch", marginInline: "auto" }}>{h.ctaTitle}</h2>
        <p className="s-lede" style={{ marginInline: "auto" }}>{h.ctaBody}</p>
        <Link href="/contact" className="s-btn s-btn--primary" style={{ marginTop: "2rem" }}>
          {h.ctaButton} <Arrow />
        </Link>
      </div>
    </section>
  );
}
