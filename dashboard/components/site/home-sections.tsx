"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Signature } from "@/components/site/signature";
import { Reveal } from "@/components/site/reveal";
import { Counter } from "@/components/site/counter";

/* An arrow that points the way the language reads. A left arrow on an Arabic
   page points backwards. */
function Arrow() {
  const { lang } = useSite();
  const I = lang === "ar" ? ArrowLeft : ArrowRight;
  return <I size={16} />;
}

export function Hero() {
  const { t } = useSite();
  const h = t.home;
  const stage = useRef<HTMLDivElement | null>(null);

  /* The panel turns toward the pointer. Written straight onto the element as
     custom properties and read by CSS transforms — no React state, so moving
     the mouse never triggers a render. */
  function track(e: React.MouseEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.style.setProperty("--mx", String(((e.clientX - r.left) / r.width - 0.5) * 2));
    el.style.setProperty("--my", String(((e.clientY - r.top) / r.height - 0.5) * -2));
  }
  function reset() {
    const el = stage.current;
    if (!el) return;
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  }

  return (
    <section className="s-hero" onMouseMove={track} onMouseLeave={reset} ref={stage}>
      <div className="s-wrap s-hero__grid">
        <Reveal>
          <span className="s-eyebrow"><Sparkles size={12} /> {h.eyebrow}</span>
          <h1>
            {h.title1}
            <span className="s-hero__accent">{h.title2}</span>
          </h1>
          <p className="s-lede">{h.lede}</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "2.2rem" }}>
            <Link href="/contact" className="s-btn s-btn--primary">
              {h.ctaPrimary} <Arrow />
            </Link>
            <Link href="/product" className="s-btn s-btn--ghost">{h.ctaSecondary}</Link>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <Signature />
        </Reveal>
      </div>
    </section>
  );
}

export function ProblemStrip() {
  const { t } = useSite();
  return (
    <section className="s-section--tight">
      <div className="s-wrap">
        <Reveal className="s-card" style={{ padding: "clamp(2rem, 5vw, 3.4rem)" }}>
          <h2 className="s-display" style={{ fontSize: "clamp(1.4rem, 3.2vw, 2.1rem)", maxWidth: "26ch" }}>
            {t.home.stripTitle}
          </h2>
          <p className="s-lede" style={{ marginTop: "1rem" }}>{t.home.stripBody}</p>
        </Reveal>
      </div>
    </section>
  );
}

export function Flow() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section">
      <div className="s-wrap">
        <Reveal style={{ marginBottom: "3rem" }}>
          <span className="s-eyebrow">01 — 04</span>
          <h2 className="s-h2">{h.flowTitle}</h2>
          <p className="s-lede">{h.flowLede}</p>
        </Reveal>

        {/* Numbered because it genuinely is a sequence: each step can only
            happen after the one before it. */}
        <div className="s-flow">
          {h.flow.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="s-card s-card--lift">
              <span className="s-flow__n">{s.n}</span>
              <h3 className="s-flow__t">{s.t}</h3>
              <p className="s-flow__d">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Proof() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section--tight">
      <div className="s-wrap">
        <Reveal style={{ marginBottom: "2.2rem" }}>
          <span className="s-eyebrow">{h.proofTitle}</span>
          <p className="s-lede">{h.proofLede}</p>
        </Reveal>

        <div className="s-stats">
          {h.proof.map((p, i) => (
            <Reveal key={p.l} delay={i * 80} className="s-card s-card--lift s-stat">
              <p className="s-stat__v s-num"><Counter value={p.v} /></p>
              <p className="s-stat__l">{p.l}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p style={{ fontSize: "0.78rem", color: "var(--s-text-4)", marginTop: "1.1rem", lineHeight: 1.7 }}>
            {h.proofNote}
          </p>
        </Reveal>
      </div>
    </section>
  );
}


export function ClosingCta() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section">
      <div className="s-wrap">
        <Reveal className="s-card" style={{ padding: "clamp(2.5rem, 6vw, 4.5rem)", textAlign: "center" }}>
          <h2 className="s-h2" style={{ maxWidth: "20ch", marginInline: "auto" }}>{h.ctaTitle}</h2>
          <p className="s-lede" style={{ marginInline: "auto" }}>{h.ctaBody}</p>
          <Link href="/contact" className="s-btn s-btn--primary" style={{ marginTop: "2.2rem" }}>
            {h.ctaButton} <Arrow />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
