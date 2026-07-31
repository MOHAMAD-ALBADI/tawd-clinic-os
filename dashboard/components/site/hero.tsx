"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Conversation } from "@/components/site/signature";

/* The hero, rebuilt.

   The 50/50 split — copy one side, a slightly tilted screenshot the other — is
   the layout every SaaS template ships with, and a picture rotated a few
   degrees reads as a rotated picture rather than an object with a position in
   space. Worse: a dark interface on a dark page has no edge, so the product
   sank into the background instead of sitting in front of it.

   This gives the headline the fold on its own, then lays the product back on a
   perspective floor beneath it — rim-lit so it separates from the page, with
   its own reflection, and the conversation hovering above it at a nearer depth.
   It rises toward the reader as it enters view, which is the moment the flat
   version never had. */

function Arrow() {
  const { lang } = useSite();
  const I = lang === "ar" ? ArrowLeft : ArrowRight;
  return <I size={16} />;
}

export function Hero() {
  const { t, lang } = useSite();
  const h = t.home;
  const deck = useRef<HTMLDivElement | null>(null);
  const [lifted, setLifted] = useState(false);

  /* The deck settles from steeply laid back to nearly upright once it is on
     screen. Done with a class rather than a scroll listener: one transition,
     no work on every frame of the scroll. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setLifted(true); return; }
    const id = setTimeout(() => setLifted(true), 420);
    return () => clearTimeout(id);
  }, []);

  const alt = lang === "ar"
    ? "لوحة المالية في طَود — إيراد الشهر والمصروفات وصافي الربح"
    : "TAWD's finance screen — monthly revenue, expenses and net profit";

  return (
    <section className="s-hero2">
      <div className="s-wrap s-hero2__inner">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        >
          <span className="s-eyebrow"><Sparkles size={12} /> {h.eyebrow}</span>
          <h1>
            {h.title1} <span className="s-hero__accent">{h.title2}</span>
          </h1>
          <p className="s-hero2__lede">{h.lede}</p>
          <div className="s-hero2__cta">
            <Link href="/contact" className="s-btn s-btn--primary">
              {h.ctaPrimary} <Arrow />
            </Link>
            <Link href="/product" className="s-btn s-btn--ghost">{h.ctaSecondary}</Link>
          </div>
        </motion.div>

        <div className="s-deck" ref={deck} data-lift={lifted}>
          <span className="s-deck__pool" aria-hidden />

          <div className="s-deck__panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/finance.png" alt={alt} width={1440} height={1000}
              loading="eager" decoding="async" />
          </div>

          {/* The floor. Purely decorative, and hidden from assistive tech —
              a screen reader announcing the same screenshot twice is noise. */}
          <div className="s-deck__mirror" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/finance.png" alt="" width={1440} height={1000} />
          </div>

          <div className="s-deck__chat">
            <Conversation />
          </div>
        </div>
      </div>
    </section>
  );
}
