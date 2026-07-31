"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check, Plus, ArrowLeft, ArrowRight,
  CalendarClock, Receipt, Boxes, Wallet, FileHeart, ClipboardList,
} from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Reveal } from "@/components/site/reveal";
import { FEATURES } from "@/lib/site/features";

function Arrow() {
  const { lang } = useSite();
  const I = lang === "ar" ? ArrowLeft : ArrowRight;
  return <I size={16} />;
}

/** The four-step sequence, on the new system. */
export function Flow() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal style={{ marginBottom: "2.6rem", maxWidth: "58ch" }}>
          <span className="pill">01 — 04</span>
          <h2 className="h2" style={{ marginTop: "1.1rem" }}>{h.flowTitle}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{h.flowLede}</p>
        </Reveal>

        <div className="grid3" style={{ gridTemplateColumns: undefined }}>
          {h.flow.map((s, i) => (
            <Reveal key={s.n} delay={i * 80} className="card card--lift">
              <span className="mono" style={{
                color: "var(--blue-lit)", fontSize: "0.72rem", letterSpacing: ".2em",
                display: "block", paddingBottom: "0.8rem", marginBottom: "0.9rem",
                borderBottom: "1px solid var(--line)",
              }}>{s.n}</span>
              <h3 className="card__t">{s.t}</h3>
              <p className="card__d">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Alternating product rows — one large screen per claim. */
export function FeatureRows() {
  const { lang } = useSite();
  return (
    <>
      {FEATURES.map((f, i) => {
        const c = f[lang];
        return (
          <section key={f.shot} className="sec">
            <div className="wrap">
              <div className="frow" data-flip={i % 2 === 1}>
                <Reveal className="frow__copy">
                  <span className="pill">{c.tag}</span>
                  <h2 className="h2" style={{ marginTop: "1.1rem" }}>{c.title}</h2>
                  <p className="lede" style={{ marginTop: "1rem" }}>{c.body}</p>
                  <ul className="list" style={{ marginTop: "1.7rem" }}>
                    {c.points.map((p) => <li key={p}><Check size={16} />{p}</li>)}
                  </ul>
                </Reveal>

                <Reveal delay={110} className="frow__shot">
                  <figure className="shot" style={{ margin: 0 }}>
                    <div className="shot__bar">
                      <i /><i /><i />
                      <span className="shot__u">tawd.om</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.shot} alt={c.title} width={1440} height={1000} loading="lazy" decoding="async" />
                    <figcaption className="shot__c">{c.cap}</figcaption>
                  </figure>
                </Reveal>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}

const MOD_ICONS = [CalendarClock, Receipt, Boxes, Wallet, FileHeart, ClipboardList];

export function Modules() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal style={{ marginBottom: "2.6rem", maxWidth: "58ch" }}>
          <h2 className="h2">{h.depthTitle}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{h.depthLede}</p>
        </Reveal>
        <div className="grid3">
          {h.depth.map((d, i) => {
            const I = MOD_ICONS[i] ?? ClipboardList;
            return (
              <Reveal key={d.t} delay={i * 60} className="card card--lift">
                <span className="ico"><I size={21} /></span>
                <h3 className="card__t">{d.t}</h3>
                <p className="card__d">{d.d}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ProblemStrip() {
  const { t } = useSite();
  return (
    <section className="sec--tight">
      <div className="wrap">
        <Reveal className="card" style={{ padding: "clamp(2rem, 4.5vw, 3.2rem)" }}>
          <h2 className="disp" style={{ fontSize: "clamp(1.4rem, 3vw, 2.1rem)", maxWidth: "28ch" }}>
            {t.home.stripTitle}
          </h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{t.home.stripBody}</p>
        </Reveal>
      </div>
    </section>
  );
}

export function FaqPreview() {
  const { t } = useSite();
  const f = t.faq;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="sec">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <Reveal style={{ marginBottom: "2rem" }}>
          <span className="pill">{f.eyebrow}</span>
          <h2 className="h2" style={{ marginTop: "1.1rem" }}>{f.title}</h2>
        </Reveal>
        {f.items.slice(0, 5).map((item, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={item.q} delay={i * 50} className="acc" style={{ ["--x" as string]: isOpen }}>
              <div data-open={isOpen}>
                <button className="acc__q" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  {item.q}
                  <Plus size={17} className="acc__i" style={{ rotate: isOpen ? "45deg" : "0deg", color: isOpen ? "var(--blue-lit)" : undefined }} />
                </button>
                {isOpen && <div className="acc__a">{item.a}</div>}
              </div>
            </Reveal>
          );
        })}
        <Reveal delay={260} style={{ marginTop: "1.6rem" }}>
          <Link href="/faq" className="btn btn--out">{f.moreTitle}</Link>
        </Reveal>
      </div>
    </section>
  );
}

export function ClosingCta() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal className="cta">
          <h2 className="h2" style={{ maxWidth: "20ch", marginInline: "auto" }}>{h.ctaTitle}</h2>
          <p className="lede" style={{ marginInline: "auto", marginTop: "1rem" }}>{h.ctaBody}</p>
          <Link href="/contact" className="btn btn--pri" style={{ marginTop: "2.2rem" }}>
            {h.ctaButton} <Arrow />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
