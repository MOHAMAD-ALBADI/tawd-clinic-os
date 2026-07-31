"use client";

import { Activity, Headphones, FileText, Percent, ShieldCheck } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { Reveal } from "@/components/site/reveal";
import { Counter } from "@/components/site/counter";

/* The statistics bar.

   The reference shows "+10K active users" and "+50 clinics". TAWD has neither,
   and a prospect who asks one question would find that out — which costs more
   than the row is worth. These are the numbers that are true today: what the
   system has actually processed, what it actually collected, and two
   commitments that are ours to keep rather than claims about scale.

   The channel figure is deliberately "24/7" rather than a headcount: Sura
   really does answer at any hour, which is the whole product. */
const COPY = {
  ar: [
    { v: "312", l: "فاتورة عولجت", i: FileText },
    { v: "85.6%", l: "نسبة التحصيل", i: Percent },
    { v: "500", l: "موعد مُدار", i: Activity },
    { v: "24/7", l: "ردّ على المرضى", i: Headphones, raw: true },
    { v: "100%", l: "عزل بيانات كل عيادة", i: ShieldCheck },
  ],
  en: [
    { v: "312", l: "invoices processed", i: FileText },
    { v: "85.6%", l: "collection rate", i: Percent },
    { v: "500", l: "appointments handled", i: Activity },
    { v: "24/7", l: "patient response", i: Headphones, raw: true },
    { v: "100%", l: "per-clinic data isolation", i: ShieldCheck },
  ],
} as const;

export function StatsBar() {
  const { lang } = useSite();
  const items = COPY[lang];

  return (
    <section className="sec--tight">
      <div className="wrap">
        <Reveal className="stats">
          {items.map((s) => (
            <div key={s.l} className="stat">
              <span className="stat__ic"><s.i size={20} /></span>
              {/* 24/7 is not a quantity to count up to — animating it would turn
                  a commitment into a scoreboard. */}
              <span className="stat__v mono">
                {"raw" in s && s.raw ? s.v : <Counter value={s.v} />}
              </span>
              <span className="stat__l">{s.l}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
