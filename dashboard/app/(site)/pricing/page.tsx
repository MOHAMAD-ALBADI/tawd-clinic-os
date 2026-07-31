"use client";

import Link from "next/link";
import { Check, Minus, Sparkles, ShieldCheck, Headphones, Download } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CtaBand, Arrow } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";
import { PLANS, MATRIX, type Tier } from "@/lib/site/content/plans";

/* Pricing without prices.

   Every reference site puts three numbers here. TAWD's price genuinely
   depends on doctor count, which modules are on, and message volume —
   printing three figures would invent a model the company does not have, and
   the first real quote would contradict its own website.

   So the page spends its space on the thing a buyer actually wants and rarely
   gets: the complete list of what the system does, and exactly which of it
   each plan includes. Sixty capabilities in one table is a harder argument
   than a number, and it is one a competitor cannot match with a discount. */
export default function PricingPage() {
  const { lang } = useSite();
  const ar = lang === "ar";

  return (
    <>
      <PageHero
        tag={ar ? "الباقات" : "Plans"}
        title={ar ? "باقة تُبنى على عيادتك، لا على متوسّط السوق" : "A plan built around your clinic, not the market average"}
        lede={ar
          ? "عدد الأطباء، والوحدات التي تحتاجها فعلاً، وحجم الرسائل — ثلاثة أشياء تختلف من عيادة لأخرى. نتحدّث معك مرّة، ونعطيك رقماً واضحاً بلا مفاجآت ولا رسوم مخفيّة."
          : "The number of doctors, the modules you actually need, and message volume — three things that differ from clinic to clinic. One conversation, then a clear number with no surprises and no hidden fees."}
        cta={{ href: "/contact", label: ar ? "اطلب عرض سعر" : "Request a quote" }}
        cta2={{ href: "/products/clinic", label: ar ? "شوف النظام" : "See the system" }}
      />

      {/* ── the three plans ── */}
      <section className="sec" style={{ paddingTop: "clamp(2.4rem, 4vw, 3.6rem)" }}>
        <div className="wrap">
          <div className="plans">
            {PLANS.map((p, i) => {
              const t = ar ? p.ar : p.en;
              return (
                <Reveal key={p.id} delay={i * 90} className={`plan${p.hot ? " plan--hot" : ""}`}>
                  {p.hot && (
                    <span className="plan__badge">
                      <Sparkles size={12} /> {ar ? "الأكثر طلباً" : "Most chosen"}
                    </span>
                  )}
                  <h3 className="plan__name">{t.n}</h3>
                  <p className="plan__for">{t.for}</p>
                  <p className="plan__d">{t.d}</p>

                  <div className="plan__q">
                    <span className="plan__qv">{ar ? "تواصل معنا" : "Talk to us"}</span>
                    <span className="plan__qs">
                      {ar ? "سعر يُحسب على حجم عيادتك" : "Priced on the size of your clinic"}
                    </span>
                  </div>

                  <Link href="/contact" className={`btn ${p.hot ? "btn--pri" : "btn--out"} plan__cta`}>
                    {ar ? "اطلب عرض سعر" : "Request a quote"} <Arrow />
                  </Link>

                  <ul className="plan__list">
                    {countFor(p.id).map((line) => (
                      <li key={line}><Check size={14} />{line}</li>
                    ))}
                  </ul>
                </Reveal>
              );

              function countFor(tier: Tier) {
                const n = MATRIX.reduce(
                  (acc, g) => acc + g.rows.filter((r) => (r.in as readonly Tier[]).includes(tier)).length,
                  0,
                );
                const groups = MATRIX.filter((g) =>
                  g.rows.some((r) => (r.in as readonly Tier[]).includes(tier)),
                ).length;
                return ar
                  ? [`${n} إمكانية داخل النظام`, `${groups} أقسام تشغيلية`, "تدريب وربط وتشغيل كامل", "تحديثات مستمرّة بلا رسوم"]
                  : [`${n} capabilities included`, `${groups} operational areas`, "Setup, connection and training", "Continuous updates at no extra cost"];
              }
            })}
          </div>
        </div>
      </section>

      {/* ── everything, and who gets what ── */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <Head
            tag={ar ? "المقارنة الكاملة" : "The full comparison"}
            title={ar ? "كل ما يفعله النظام، وأين تجده" : "Everything the system does, and where to find it"}
            lede={ar
              ? "كل بند هنا مبنيّ ويعمل. لا خارطة طريق ولا نجمة صغيرة في الأسفل."
              : "Every line here is built and running. No roadmap, and no small print at the bottom."}
          />

          <div className="ftable">
            <div className="ftable__head">
              <span>{ar ? "الإمكانية" : "Capability"}</span>
              {PLANS.map((p) => (
                <span key={p.id} className={p.hot ? "is-hot" : undefined}>{ar ? p.ar.n : p.en.n}</span>
              ))}
            </div>

            {MATRIX.map((g) => (
              <div key={g.en} className="ftable__group">
                <p className="ftable__gh">{ar ? g.ar : g.en}</p>
                {g.rows.map((r) => (
                  <div key={r.en} className="ftable__row">
                    <span className="ftable__lab">{ar ? r.ar : r.en}</span>
                    {PLANS.map((p) => {
                      const on = (r.in as readonly Tier[]).includes(p.id);
                      return (
                        <span
                          key={p.id}
                          className={`ftable__c${p.hot ? " is-hot" : ""}`}
                          data-on={on}
                          /* The plan name repeats per cell on a narrow screen,
                             where the header row has scrolled out of sight. */
                          data-plan={ar ? p.ar.n : p.en.n}
                        >
                          {on ? <Check size={15} /> : <Minus size={13} />}
                          <em className="sr-only">
                            {on ? (ar ? "متاح" : "included") : (ar ? "غير متاح" : "not included")}
                          </em>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── the three promises that are not features ── */}
      <section className="sec" style={{ borderTop: "1px solid var(--line)", background: "rgba(255,255,255,.012)" }}>
        <div className="wrap">
          <div className="grid3">
            {(ar
              ? [
                  { i: ShieldCheck, t: "بلا عقد يحبسك", d: "لا التزام طويل ولا غرامة خروج. تبقى معنا لأن النظام يستحقّ، لا لأن ورقة تمنعك." },
                  { i: Download, t: "بياناتك تخرج معك", d: "نسخة كاملة من كل ما أدخلته متى طلبتها، بصيغة تفتحها في أي مكان." },
                  { i: Headphones, t: "التشغيل والتدريب مشمولان", d: "الربط وإدخال خدماتك وتدريب فريقك جزء من الاشتراك، لا بند إضافي على الفاتورة." },
                ]
              : [
                  { i: ShieldCheck, t: "No contract holding you", d: "No long commitment and no exit penalty. You stay because the system earns it, not because paperwork stops you." },
                  { i: Download, t: "Your data leaves with you", d: "A full export of everything you entered, whenever you ask, in a format you can open anywhere." },
                  { i: Headphones, t: "Setup and training included", d: "Connection, loading your services and training your team are part of the subscription, not a line item." },
                ]
            ).map((x, i) => (
              <Reveal key={x.t} delay={i * 70} className="card card--lift">
                <span className="ico"><x.i size={21} /></span>
                <h3 className="card__t">{x.t}</h3>
                <p className="card__d">{x.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title={ar ? "خلّنا نحسبها لعيادتك" : "Let us work it out for your clinic"}
        lede={ar
          ? "محادثة قصيرة عن حجم عيادتك وما ترغب بتشغيله، ونرجع لك برقم واضح."
          : "A short conversation about your size and what you want switched on, and we come back with a clear number."}
        btn={ar ? "اطلب عرض سعر" : "Request a quote"}
        btn2={ar ? "شوف النظام" : "See the system"}
        href2="/products/clinic"
      />
    </>
  );
}
