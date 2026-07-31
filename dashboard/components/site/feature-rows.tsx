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
          <section key={f.shot} className={`s-section ${i % 2 === 1 ? "s-lit" : ""}`}>
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

/* A fragment of the real interface inside each card.

   Six boxes of prose is a list of claims. A card that shows the actual row,
   bar or badge the module produces is the claim and its evidence in the same
   object — which is what the reference sites do and what mine did not. */
function Fragment({ i, lang }: { i: number; lang: "ar" | "en" }) {
  const ar = lang === "ar";
  switch (i) {
    case 0: return (
      <div className="s-frag">
        <div className="s-frag__row">{ar ? "٠٩:٠٠ · تنظيف" : "09:00 · Cleaning"}<span className="s-frag__pill">{ar ? "مؤكّد" : "Confirmed"}</span></div>
        <div className="s-frag__row">{ar ? "٠٩:٣٥ · حشوة" : "09:35 · Filling"}<b>د. سارة</b></div>
      </div>
    );
    case 1: return (
      <div className="s-frag">
        <div className="s-frag__row">{ar ? "المجموع" : "Subtotal"}<b>35.000</b></div>
        <div className="s-frag__row">{ar ? "ضريبة ٥٪" : "VAT 5%"}<b>1.750</b></div>
        <div className="s-frag__row" style={{ borderColor: "rgba(91,147,255,0.3)" }}>{ar ? "الإجمالي" : "Total"}<b style={{ color: "var(--s-blue-lit)" }}>36.750</b></div>
      </div>
    );
    case 2: return (
      <div className="s-frag">
        <div className="s-frag__row">{ar ? "قفازات" : "Gloves"}<b>14</b></div>
        <div className="s-frag__bar"><i style={{ width: "22%" }} /></div>
        <div className="s-frag__row" style={{ borderColor: "rgba(251,191,36,0.28)", color: "#fbbf24" }}>{ar ? "تنتهي خلال ١٨ يوم" : "Expires in 18 days"}</div>
      </div>
    );
    case 3: return (
      <div className="s-frag">
        <div className="s-frag__row">{ar ? "إيراد" : "Revenue"}<b>7,582</b></div>
        <div className="s-frag__bar"><i style={{ width: "100%" }} /></div>
        <div className="s-frag__row">{ar ? "مصروف" : "Expenses"}<b>4,423</b></div>
        <div className="s-frag__bar"><i style={{ width: "58%", background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} /></div>
      </div>
    );
    case 4: return (
      <div className="s-frag">
        <div className="s-frag__row">{ar ? "مطالبة #١٠٤" : "Claim #104"}<span className="s-frag__pill">{ar ? "مقبولة" : "Approved"}</span></div>
        <div className="s-frag__row">{ar ? "تغطية" : "Covered"}<b>80%</b></div>
      </div>
    );
    default: return (
      <div className="s-frag">
        <div className="s-frag__row">{ar ? "خطة علاج — ٥ زيارات" : "Plan — 5 visits"}<b>2/5</b></div>
        <div className="s-frag__bar"><i style={{ width: "40%" }} /></div>
      </div>
    );
  }
}

export function Modules() {
  const { t, lang } = useSite();
  const h = t.home;
  return (
    <section className="s-section s-lit">
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
                <span className="s-mods__i"><I size={20} /></span>
                <h3 className="s-card__t">{d.t}</h3>
                <p className="s-card__d">{d.d}</p>
                <Fragment i={i} lang={lang} />
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
