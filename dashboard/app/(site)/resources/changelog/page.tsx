"use client";

import { useSite } from "@/components/site/lang";
import { PageHero } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";
import { CHANGELOG } from "@/lib/site/content/changelog";

/* A public changelog.

   Most companies at this stage have nothing to put on this page. TAWD has a
   hundred and fifty commits of real work, and a dated list of what actually
   shipped is a harder credential than any badge: it cannot be written in an
   afternoon and it is checkable against the product.

   Entries are curated rather than dumped from git — a commit log is written for
   engineers, and "fix: null guard in receivables" tells a clinic owner nothing.
   Each line here is a change a customer would notice. */
export default function ChangelogPage() {
  const { lang } = useSite();
  return (
    <>
      <PageHero
        tag={lang === "ar" ? "سجلّ التحديثات" : "Changelog"}
        title={lang === "ar" ? "كل ما شُحن، بتاريخه" : "Everything shipped, dated"}
        lede={lang === "ar"
          ? "طَود يُبنى ويُصان يومياً. هذه قائمة بما تغيّر فعلاً — لا وعود ولا خارطة طريق."
          : "TAWD is built and maintained daily. This is what actually changed — not promises, not a roadmap."}
      />

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          {CHANGELOG.map((month, mi) => (
            <div key={month.id} className="clog__month">
              <Reveal className="clog__mh">
                <span className="mono">{lang === "ar" ? month.ar : month.en}</span>
                <span className="clog__count mono">{month.items.length}</span>
              </Reveal>

              {month.items.map((it, i) => (
                <Reveal key={it.en} delay={Math.min(i * 40, 240)} className="clog__row">
                  <span className={`clog__tag clog__tag--${it.kind}`}>
                    {lang === "ar"
                      ? it.kind === "new" ? "جديد" : it.kind === "fix" ? "إصلاح" : "تحسين"
                      : it.kind === "new" ? "New" : it.kind === "fix" ? "Fix" : "Improved"}
                  </span>
                  <div>
                    <b>{lang === "ar" ? it.ar : it.en}</b>
                    {(it.arD || it.enD) && <p>{lang === "ar" ? it.arD : it.enD}</p>}
                  </div>
                </Reveal>
              ))}
              {mi < CHANGELOG.length - 1 && <div className="clog__rule" />}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
