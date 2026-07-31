"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, Lock, Eye, Download, Stethoscope, Sparkle, Building2, Network, Activity, HeartPulse } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Reveal } from "@/components/site/reveal";
import { Counter } from "@/components/site/counter";
import { homeContent } from "@/lib/site/content/home";

function Arrow() {
  const { lang } = useSite();
  const I = lang === "ar" ? ArrowLeft : ArrowRight;
  return <I size={16} />;
}

/** 3 — the cost of silence, in three figures. */
export function Problem() {
  const { lang } = useSite();
  const c = homeContent[lang].problem;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal style={{ maxWidth: "56ch", marginBottom: "2.6rem" }}>
          <span className="pill">{c.tag}</span>
          <h2 className="h2" style={{ marginTop: "1.1rem" }}>{c.title}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{c.lede}</p>
        </Reveal>

        <div className="grid3">
          {c.points.map((p, i) => (
            <Reveal key={p.l} delay={i * 80} className="card">
              <p className="mono" style={{ fontSize: "clamp(2rem, 4vw, 2.9rem)", fontWeight: 700, color: "var(--blue-lit)" }}>
                {p.v}
              </p>
              <p className="card__d" style={{ marginTop: "0.6rem" }}>{p.l}</p>
            </Reveal>
          ))}
        </div>

        {/* A claim borrowed from the sector is still a borrowed claim. Saying so
            costs one line and buys the reader's trust in every other number. */}
        <Reveal delay={220}>
          <p style={{ fontSize: "0.75rem", color: "var(--tx-3)", marginTop: "1.2rem", lineHeight: 1.8, maxWidth: "70ch" }}>
            {c.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const SECTOR_ICONS = [Stethoscope, Sparkle, Building2, Network, Activity, HeartPulse];

/** 12 — who it is for. */
export function Sectors() {
  const { lang } = useSite();
  const c = homeContent[lang].sectors;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal style={{ maxWidth: "58ch", marginBottom: "2.6rem" }}>
          <span className="pill">{c.tag}</span>
          <h2 className="h2" style={{ marginTop: "1.1rem" }}>{c.title}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{c.lede}</p>
        </Reveal>

        <div className="grid3">
          {c.items.map((s, i) => {
            const I = SECTOR_ICONS[i] ?? Stethoscope;
            return (
              <Reveal key={s.t} delay={i * 60} className="card card--lift">
                <span className="ico"><I size={21} /></span>
                <h3 className="card__t">{s.t}</h3>
                <p className="card__d">{s.d}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const SEC_ICONS = [Lock, ShieldCheck, Eye, Download];

/** 13 — why the security claim is checkable. */
export function Security() {
  const { lang } = useSite();
  const c = homeContent[lang].security;
  return (
    <section className="sec" style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,0.012)" }}>
      <div className="wrap">
        <div className="frow">
          <Reveal className="frow__copy">
            <span className="pill"><ShieldCheck size={13} /> {c.tag}</span>
            <h2 className="h2" style={{ marginTop: "1.1rem" }}>{c.title}</h2>
            <p className="lede" style={{ marginTop: "1rem" }}>{c.lede}</p>
            <Link href="/legal/privacy" className="btn btn--out" style={{ marginTop: "1.8rem" }}>
              {c.link} <Arrow />
            </Link>
          </Reveal>

          <Reveal delay={110} className="frow__shot">
            <div className="grid2">
              {c.items.map((s, i) => {
                const I = SEC_ICONS[i] ?? Lock;
                return (
                  <div key={s.t} className="card">
                    <span className="ico" style={{ width: 38, height: 38, marginBottom: "0.85rem" }}>
                      <I size={17} />
                    </span>
                    <h3 className="card__t" style={{ fontSize: "0.95rem" }}>{s.t}</h3>
                    <p className="card__d" style={{ fontSize: "0.8rem" }}>{s.d}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** 15 — the ask. */
export function Closing() {
  const { lang } = useSite();
  const c = homeContent[lang].cta;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal className="cta">
          <h2 className="h2" style={{ maxWidth: "22ch", marginInline: "auto" }}>{c.title}</h2>
          <p className="lede" style={{ marginInline: "auto", marginTop: "1rem" }}>{c.lede}</p>
          <div style={{ display: "flex", gap: "0.8rem", justifyContent: "center", flexWrap: "wrap", marginTop: "2.2rem" }}>
            <Link href="/contact" className="btn btn--pri">{c.btn} <Arrow /></Link>
            <Link href="/pricing" className="btn btn--out">{c.btn2}</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** 5 — the sequence, restyled with the numbers as anchors. */
export function Flow() {
  const { lang } = useSite();
  const c = homeContent[lang].flow;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal style={{ maxWidth: "56ch", marginBottom: "2.6rem" }}>
          <span className="pill">{c.tag}</span>
          <h2 className="h2" style={{ marginTop: "1.1rem" }}>{c.title}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{c.lede}</p>
        </Reveal>

        <div className="flowgrid">
          {c.steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 80} className="card card--lift">
              <span className="flown mono">{s.n}</span>
              <h3 className="card__t">{s.t}</h3>
              <p className="card__d">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 11 — the modules, at ten. */
export function Modules() {
  const { lang, t } = useSite();
  const c = homeContent[lang].modules;
  const mods = t.home.depth;
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal style={{ maxWidth: "56ch", marginBottom: "2.6rem" }}>
          <span className="pill">{c.tag}</span>
          <h2 className="h2" style={{ marginTop: "1.1rem" }}>{c.title}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{c.lede}</p>
        </Reveal>
        <div className="grid3">
          {mods.map((d, i) => (
            <Reveal key={d.t} delay={i * 50} className="card card--lift">
              <h3 className="card__t">{d.t}</h3>
              <p className="card__d">{d.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
