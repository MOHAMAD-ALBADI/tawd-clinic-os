"use client";

import Link from "next/link";
import { useState } from "react";
import { useSite } from "@/components/site/lang";

/* The company, then its leadership.

   Order matters here. A clinic is choosing a supplier it will depend on daily,
   so it wants to know there is a team behind the system before it wants to know
   who runs it. The disciplines are named; individuals other than the founder
   are not — naming people invites a search, and the point of the section is the
   capability, not a roster. */
export default function AboutPage() {
  const { t } = useSite();
  const a = t.about;
  /* The portrait is dropped in later. Until the file exists, the initials stand
     in rather than a broken image or a stock photograph of someone else. */
  const [portraitOk, setPortraitOk] = useState(true);

  return (
    <>
      <section className="sec" style={{ position: "relative" }}>
        <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
          <span className="pill">{a.eyebrow}</span>
          <h1 style={{ fontSize: "clamp(2.6rem, 8vw, 5rem)", marginBlock: "0.8rem 0.6rem" }}>{a.title}</h1>
          <p className="mono" style={{ fontSize: "0.85rem", color: "var(--tx-3)" }}>{a.meaning}</p>
          <p className="lede">{a.lede}</p>
        </div>
      </section>

      <section className="sec--tight" style={{ borderBlock: "1px solid var(--line)", background: "var(--bg-2)" }}>
        <div className="wrap" style={{ paddingBlock: "3.4rem", maxWidth: 780 }}>
          <h2 className="h2" style={{ fontSize: "clamp(1.5rem, 3.4vw, 2.1rem)", marginBottom: "1.6rem" }}>
            {a.storyTitle}
          </h2>
          <div style={{ display: "grid", gap: "1.3rem" }}>
            {a.story.map((para) => (
              <p key={para.slice(0, 24)} style={{ fontSize: "1rem", lineHeight: 2, color: "var(--tx-2)" }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* The team, before the founder.

          A company page that opens with one person reads as one person. The
          disciplines come first — that is what a clinic is actually buying
          into — and leadership follows them. */}
      <section className="sec">
        <div className="wrap">
          <span className="pill">{a.teamTitle}</span>
          <h2 className="h2" style={{ marginBlock: "1.2rem 1rem", maxWidth: "24ch" }}>{a.teamLede}</h2>
          <div className="grid3" style={{ marginTop: "2.2rem" }}>
            {a.teamCards.map((c) => (
              <div key={c.t} className="card card--lift">
                <h3 className="card__t">{c.t}</h3>
                <p className="card__d">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <span className="pill">{a.founderTitle}</span>
          <div
            style={{
              display: "grid", gap: "2rem", marginTop: "1.6rem", alignItems: "start",
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
            className="founder"
          >
            <div
              style={{
                width: 168, height: 168, borderRadius: 20, overflow: "hidden",
                border: "1px solid var(--line-2)", background: "var(--bg-3)",
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
                <span className="disp" style={{ fontSize: "2.4rem", color: "var(--tx-3)" }}>م ب</span>
              )}
            </div>

            <div style={{ maxWidth: "60ch" }}>
              <h2 className="card__t" style={{ fontSize: "1.3rem" }}>{a.founderName}</h2>
              <p className="mono" style={{ fontSize: "0.78rem", color: "var(--blue-lit)", marginBottom: "1rem" }}>
                {a.founderRole}
              </p>
              <p style={{ fontSize: "0.96rem", lineHeight: 2, color: "var(--tx-2)" }}>{a.founderBio}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <h2 className="h2" style={{ marginBottom: "2.2rem" }}>{a.principlesTitle}</h2>
          <div className="grid4">
            {a.principles.map((p) => (
              <div key={p.t} className="card">
                <h3 className="card__t">{p.t}</h3>
                <p className="card__d">{p.d}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "2.6rem" }}>
            <Link href="/contact" className="btn btn--pri">{t.home.ctaButton}</Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (min-width: 720px) {
          .founder { grid-template-columns: auto minmax(0, 1fr) !important; }
        }
      `}</style>
    </>
  );
}
