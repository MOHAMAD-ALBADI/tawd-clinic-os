"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSite } from "@/components/site/lang";

/* One founder, stated plainly.

   The instinct is to write "we" and imply a team. A clinic owner in Oman can
   tell, and being caught inflating is worse than being small. So the page says
   who built it and shows him — which is also the stronger position: the person
   who wrote the software answers the phone. */
export default function AboutPage() {
  const { t } = useSite();
  const a = t.about;
  /* The portrait is dropped in later. Until the file exists, the initials stand
     in rather than a broken image or a stock photograph of someone else. */
  const [portraitOk, setPortraitOk] = useState(true);

  return (
    <>
      <section className="s-section" style={{ position: "relative" }}>
        <span className="s-bloom" aria-hidden />
        <div className="s-wrap" style={{ position: "relative", zIndex: 1 }}>
          <span className="s-eyebrow">{a.eyebrow}</span>
          <h1 style={{ fontSize: "clamp(2.6rem, 8vw, 5rem)", marginBlock: "0.8rem 0.6rem" }}>{a.title}</h1>
          <p className="s-num" style={{ fontSize: "0.85rem", color: "var(--s-text-3)" }}>{a.meaning}</p>
          <p className="s-lede">{a.lede}</p>
        </div>
      </section>

      <section className="s-section--tight" style={{ borderBlock: "1px solid var(--s-line)", background: "var(--s-bg-2)" }}>
        <div className="s-wrap" style={{ paddingBlock: "3.4rem", maxWidth: 780 }}>
          <h2 className="s-h2" style={{ fontSize: "clamp(1.5rem, 3.4vw, 2.1rem)", marginBottom: "1.6rem" }}>
            {a.storyTitle}
          </h2>
          <div style={{ display: "grid", gap: "1.3rem" }}>
            {a.story.map((para) => (
              <p key={para.slice(0, 24)} style={{ fontSize: "1rem", lineHeight: 2, color: "var(--s-text-2)" }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <span className="s-eyebrow">{a.founderTitle}</span>
          <div
            style={{
              display: "grid", gap: "2rem", marginTop: "1.6rem", alignItems: "start",
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
            className="s-founder"
          >
            <div
              style={{
                width: 168, height: 168, borderRadius: 20, overflow: "hidden",
                border: "1px solid var(--s-line-strong)", background: "var(--s-bg-3)",
                display: "grid", placeItems: "center", flexShrink: 0,
              }}
            >
              {portraitOk ? (
                /* A plain img, not next/image, on purpose: the optimiser answers
                   400 for a file that is not there yet and the portrait is
                   dropped in later. This way the fallback is quiet, and the day
                   public/founder.jpg exists it simply appears — no code change. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/founder.jpg"
                  alt={a.founderName}
                  width={168}
                  height={168}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  onError={() => setPortraitOk(false)}
                />
              ) : (
                <span className="s-display" style={{ fontSize: "2.4rem", color: "var(--s-text-4)" }}>م ب</span>
              )}
            </div>

            <div style={{ maxWidth: "60ch" }}>
              <h2 className="s-card__t" style={{ fontSize: "1.3rem" }}>{a.founderName}</h2>
              <p className="s-num" style={{ fontSize: "0.78rem", color: "var(--s-blue-lit)", marginBottom: "1rem" }}>
                {a.founderRole}
              </p>
              <p style={{ fontSize: "0.96rem", lineHeight: 2, color: "var(--s-text-2)" }}>{a.founderBio}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="s-section" style={{ borderTop: "1px solid var(--s-line)" }}>
        <div className="s-wrap">
          <h2 className="s-h2" style={{ marginBottom: "2.2rem" }}>{a.principlesTitle}</h2>
          <div className="s-grid s-grid--3">
            {a.principles.map((p) => (
              <div key={p.t} className="s-card">
                <h3 className="s-card__t">{p.t}</h3>
                <p className="s-card__d">{p.d}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "2.6rem" }}>
            <Link href="/contact" className="s-btn s-btn--primary">{t.home.ctaButton}</Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (min-width: 720px) {
          .s-founder { grid-template-columns: auto minmax(0, 1fr) !important; }
        }
      `}</style>
    </>
  );
}
