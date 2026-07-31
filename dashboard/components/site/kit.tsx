"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, type LucideIcon } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Reveal } from "@/components/site/reveal";

/* Section primitives.

   Thirty pages cannot each invent a layout — they diverge within a week and the
   site stops looking like one company. Every page composes from these, and the
   test the set has to pass is that a new Solutions sector needs one content
   object and zero new components. */

export function Arrow() {
  const { lang } = useSite();
  const I = lang === "ar" ? ArrowLeft : ArrowRight;
  return <I size={16} />;
}

/** The top of every inner page. */
export function PageHero({
  tag, title, lede, cta, cta2, children,
}: {
  tag?: string; title: string; lede?: string;
  cta?: { href: string; label: string };
  cta2?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="sec phero">
      <div className="wrap">
        <Reveal style={{ maxWidth: "62ch" }}>
          {tag && <span className="pill">{tag}</span>}
          <h1 className="phero__h" style={{ marginTop: tag ? "1.2rem" : 0 }}>{title}</h1>
          {lede && <p className="lede" style={{ marginTop: "1.2rem" }}>{lede}</p>}
          {(cta || cta2) && (
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "2.2rem" }}>
              {cta && <Link href={cta.href} className="btn btn--pri">{cta.label} <Arrow /></Link>}
              {cta2 && <Link href={cta2.href} className="btn btn--out">{cta2.label}</Link>}
            </div>
          )}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

/** A section heading block. */
export function Head({ tag, title, lede, center }: { tag?: string; title: string; lede?: string; center?: boolean }) {
  return (
    <Reveal style={{ maxWidth: center ? "62ch" : "58ch", marginInline: center ? "auto" : undefined, textAlign: center ? "center" : undefined, marginBottom: "2.6rem" }}>
      {tag && <span className="pill">{tag}</span>}
      <h2 className="h2" style={{ marginTop: tag ? "1.1rem" : 0 }}>{title}</h2>
      {lede && <p className="lede" style={{ marginTop: "1rem", marginInline: center ? "auto" : undefined }}>{lede}</p>}
    </Reveal>
  );
}

export type Item = { t: string; d: string; i?: LucideIcon; href?: string };

/** Icon + title + body, 2/3/4 up. */
export function CardGrid({ items, cols = 3 }: { items: Item[]; cols?: 2 | 3 | 4 }) {
  const cls = cols === 2 ? "grid2" : cols === 4 ? "grid4" : "grid3";
  return (
    <div className={cls}>
      {items.map((x, i) => {
        const Inner = (
          <>
            {x.i && <span className="ico"><x.i size={21} /></span>}
            <h3 className="card__t">{x.t}</h3>
            <p className="card__d">{x.d}</p>
            {x.href && <span className="card__go">→</span>}
          </>
        );
        return x.href ? (
          <Reveal key={x.t} delay={i * 55} className="card card--lift" as="div">
            <Link href={x.href} style={{ display: "block" }}>{Inner}</Link>
          </Reveal>
        ) : (
          <Reveal key={x.t} delay={i * 55} className="card card--lift">{Inner}</Reveal>
        );
      })}
    </div>
  );
}

/** Copy one side, a checklist the other. */
export function SplitList({
  tag, title, lede, points, flip, aside,
}: {
  tag?: string; title: string; lede?: string; points?: string[]; flip?: boolean; aside?: React.ReactNode;
}) {
  return (
    <section className="sec">
      <div className="wrap">
        <div className="frow" data-flip={flip}>
          <Reveal className="frow__copy">
            {tag && <span className="pill">{tag}</span>}
            <h2 className="h2" style={{ marginTop: tag ? "1.1rem" : 0 }}>{title}</h2>
            {lede && <p className="lede" style={{ marginTop: "1rem" }}>{lede}</p>}
          </Reveal>
          <Reveal delay={110} className="frow__shot">
            {aside ?? (
              <ul className="list">
                {(points ?? []).map((p) => <li key={p}><Check size={16} />{p}</li>)}
              </ul>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Numbered steps. */
export function Steps({ steps }: { steps: { n: string; t: string; d: string }[] }) {
  return (
    <div className="flowgrid">
      {steps.map((s, i) => (
        <Reveal key={s.n} delay={i * 70} className="card card--lift">
          <span className="flown mono">{s.n}</span>
          <h3 className="card__t">{s.t}</h3>
          <p className="card__d">{s.d}</p>
        </Reveal>
      ))}
    </div>
  );
}

/** A closing band. Every page ends with one — a page with no next step is a
    dead end, and on a company site that is a lost enquiry. */
export function CtaBand({ title, lede, btn, btn2 }: { title: string; lede?: string; btn?: string; btn2?: string }) {
  const { lang } = useSite();
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal className="cta">
          <h2 className="h2" style={{ maxWidth: "22ch", marginInline: "auto" }}>{title}</h2>
          {lede && <p className="lede" style={{ marginInline: "auto", marginTop: "1rem" }}>{lede}</p>}
          <div style={{ display: "flex", gap: "0.8rem", justifyContent: "center", flexWrap: "wrap", marginTop: "2.2rem" }}>
            <Link href="/contact" className="btn btn--pri">
              {btn ?? (lang === "ar" ? "احجز عرضاً توضيحياً" : "Book a demo")} <Arrow />
            </Link>
            <Link href="/pricing" className="btn btn--out">
              {btn2 ?? (lang === "ar" ? "شوف الأسعار" : "See pricing")}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** A row of figures. */
export function StatRow({ items }: { items: { v: string; l: string }[] }) {
  return (
    <Reveal className="stats">
      {items.map((s) => (
        <div key={s.l} className="stat">
          <span className="stat__v mono">{s.v}</span>
          <span className="stat__l">{s.l}</span>
        </div>
      ))}
    </Reveal>
  );
}
