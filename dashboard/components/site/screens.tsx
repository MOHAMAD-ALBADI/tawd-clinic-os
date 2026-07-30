"use client";

import Image from "next/image";
import { useSite } from "@/components/site/lang";

/* Real screens, not mockups.

   These are captures of TAWD running against the same clinic the numbers on
   this site come from — the figures in the image and the figures in the stats
   band are the same figures. A drawn mockup would have been easier to compose
   and would have been a picture of software that does not exist. */

const SHOTS = [
  {
    src: "/shots/finance.png",
    w: 1440, h: 1000,
    ar: "المالية — إيراد الشهر، المصروفات، صافي الربح، وطرق التحصيل",
    en: "Finance — monthly revenue, expenses, net profit, and how payments came in",
  },
  {
    src: "/shots/inventory.png",
    w: 1440, h: 1000,
    ar: "المخزون — الأصناف وحركة المخزون: من صرف، وكم، ولماذا",
    en: "Inventory — items and the movement ledger: who took what, how much, and why",
  },
] as const;

export function Screens() {
  const { t, lang } = useSite();
  const p = t.product;

  return (
    <section className="s-section" style={{ background: "var(--s-bg-2)", borderBlock: "1px solid var(--s-line)" }}>
      <div className="s-wrap">
        <span className="s-eyebrow">{p.screensTitle}</span>
        <p className="s-lede" style={{ marginBottom: "2.4rem" }}>{p.screensLede}</p>

        <div style={{ display: "grid", gap: "1.6rem" }}>
          {SHOTS.map((s) => (
            <figure key={s.src} className="s-shot" style={{ margin: 0 }}>
              <Image
                src={s.src}
                alt={lang === "ar" ? s.ar : s.en}
                width={s.w}
                height={s.h}
                sizes="(max-width: 900px) 100vw, 1100px"
                style={{ width: "100%", height: "auto" }}
              />
              <figcaption className="s-shot__cap">{lang === "ar" ? s.ar : s.en}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A single wide capture, used on the home page as visual proof under the fold. */
export function ScreenHighlight() {
  const { t, lang } = useSite();
  return (
    <section className="s-section--tight" style={{ paddingBottom: "clamp(3rem, 8vw, 5rem)" }}>
      <div className="s-wrap">
        <figure className="s-shot" style={{ margin: 0 }}>
          <Image
            src="/shots/finance.png"
            alt={lang === "ar" ? SHOTS[0].ar : SHOTS[0].en}
            width={1440}
            height={1000}
            priority
            sizes="(max-width: 900px) 100vw, 1100px"
            style={{ width: "100%", height: "auto" }}
          />
          <figcaption className="s-shot__cap">
            {lang === "ar" ? SHOTS[0].ar : SHOTS[0].en}
          </figcaption>
        </figure>
        <p style={{ fontSize: "0.78rem", color: "var(--s-text-4)", marginTop: "0.9rem" }}>
          {t.home.proofNote}
        </p>
      </div>
    </section>
  );
}
