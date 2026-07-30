"use client";

import Link from "next/link";
/* AtSign, not Instagram — this lucide build has no Instagram glyph, the same
   trap hit when the Instagram panel was built. */
import {
  Check, MessageCircle, AtSign, Globe, Shield, Zap, HeartHandshake,
  CalendarClock, Receipt, Boxes, Wallet, FileHeart, ClipboardList, Plus,
} from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Reveal } from "@/components/site/reveal";
import { FEATURES, CHANNELS, TRUST } from "@/lib/site/features";

/* A screen inside browser chrome.

   The screenshots were floating naked before, and a bare rectangle of UI reads
   as a crop, not as a product. The chrome tells you what you are looking at
   without a caption having to. */
function Framed({ src, alt, cap }: { src: string; alt: string; cap: string }) {
  return (
    <figure className="s-frame">
      <div className="s-frame__bar">
        <span /><span /><span />
        <em className="s-frame__url">tawd.om</em>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={1440} height={1000} loading="lazy" decoding="async" />
      <figcaption className="s-frame__cap">{cap}</figcaption>
    </figure>
  );
}

/** The channel strip — real, named, and only what is actually live. */
export function Channels() {
  const { t, lang } = useSite();
  const c = CHANNELS[lang];
  const icons = [MessageCircle, AtSign, Globe];
  const trust = TRUST[lang];

  return (
    <section className="s-section--tight">
      <div className="s-wrap">
        <Reveal className="s-channels">
          <span className="s-channels__label">{c.label}</span>
          <div className="s-channels__row">
            {c.items.map((item, i) => {
              const I = icons[i];
              return (
                <span key={item} className="s-chip">
                  <I size={15} /> {item}
                </span>
              );
            })}
          </div>
          <div className="s-trust">
            {trust.map((x, i) => {
              const I = [Zap, Shield, HeartHandshake][i];
              return (
                <span key={x} className="s-trust__i">
                  <I size={13} /> {x}
                </span>
              );
            })}
          </div>
        </Reveal>
      </div>
      <span className="sr-only">{t.brand}</span>
    </section>
  );
}

/** The spine: one large readable screen per claim, sides alternating. */
export function FeatureRows() {
  const { lang } = useSite();

  return (
    <>
      {FEATURES.map((f, i) => {
        const c = f[lang];
        return (
          <section key={f.shot} className="s-section">
            <div className="s-wrap">
              <div className="s-featrow" data-flip={i % 2 === 1}>
                <Reveal className="s-featrow__copy">
                  <span className="s-eyebrow">{c.tag}</span>
                  <h2 className="s-h2">{c.title}</h2>
                  <p className="s-lede">{c.body}</p>
                  <ul className="s-list" style={{ marginTop: "1.6rem" }}>
                    {c.points.map((p) => (
                      <li key={p}><Check size={16} />{p}</li>
                    ))}
                  </ul>
                </Reveal>

                <Reveal delay={120} className="s-featrow__shot">
                  <Framed src={f.shot} alt={c.title} cap={c.cap} />
                </Reveal>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}

/* Icons, because six unadorned text boxes is what made the first version read
   as unfinished. Each maps to the module it names. */
const MODULE_ICONS = [CalendarClock, Receipt, Boxes, Wallet, FileHeart, ClipboardList];

export function Modules() {
  const { t } = useSite();
  const h = t.home;
  return (
    <section className="s-section">
      <div className="s-wrap">
        <Reveal style={{ marginBottom: "2.4rem" }}>
          <h2 className="s-h2">{h.depthTitle}</h2>
          <p className="s-lede">{h.depthLede}</p>
        </Reveal>
        <div className="s-mods">
          {h.depth.map((d, i) => {
            const I = MODULE_ICONS[i] ?? ClipboardList;
            return (
              <Reveal key={d.t} delay={i * 60} className="s-card s-card--lift">
                <span className="s-mods__i"><I size={18} /></span>
                <h3 className="s-card__t">{d.t}</h3>
                <p className="s-card__d">{d.d}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Four of the seven questions, answered here so nobody has to go looking. */
export function FaqPreview() {
  const { t } = useSite();
  const f = t.faq;
  return (
    <section className="s-section">
      <div className="s-wrap" style={{ maxWidth: 880 }}>
        <Reveal style={{ marginBottom: "2rem" }}>
          <span className="s-eyebrow">{f.eyebrow}</span>
          <h2 className="s-h2">{f.title}</h2>
        </Reveal>
        <div>
          {f.items.slice(0, 4).map((item, i) => (
            <Reveal key={item.q} delay={i * 60} className="s-qa">
              <h3 className="s-qa__q"><Plus size={15} />{item.q}</h3>
              <p className="s-qa__a">{item.a}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={240} style={{ marginTop: "1.6rem" }}>
          <Link href="/faq" className="s-btn s-btn--ghost">{f.moreTitle}</Link>
        </Reveal>
      </div>
    </section>
  );
}
