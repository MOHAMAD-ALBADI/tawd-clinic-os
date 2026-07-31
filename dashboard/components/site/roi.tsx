"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { useSite } from "@/components/site/lang";

/* What the after-hours messages are costing, worked out with the clinic's own
   numbers.

   This is the one place on the site a visitor does something rather than reads
   something, and it is built on arithmetic they can check rather than a
   flattering multiplier: messages a week that go unanswered × the share that
   would have booked × what a visit is worth. Every input is theirs and every
   assumption is on screen, because a calculator whose maths is hidden is a
   sales trick and gets treated as one.

   The recovery rate tops out well under half on purpose. Sura answers the
   message; it does not conjure demand that was never there. */
const T = {
  ar: {
    tag: "احسبها بنفسك",
    title: "كم تكلّفك الرسائل التي لا يردّ عليها أحد؟",
    lede: "حرّك الأرقام على مقاس عيادتك — الحساب أمامك، لا صندوق أسود.",
    msgs: "رسالة تصل بعد الدوام أسبوعياً",
    value: "متوسط قيمة الزيارة (ر.ع)",
    rate: "منهم كانوا سيحجزون لو رُدّ عليهم",
    resultLabel: "إيراد ضائع سنوياً — تقديراً",
    per: "شهرياً",
    note:
      "الحساب: الرسائل الأسبوعية × نسبة من كان سيحجز × قيمة الزيارة × ٥٢ أسبوعاً. تقدير لا وعد — والأرقام أرقامك.",
    cta: "أرِنا عيادتك",
  },
  en: {
    tag: "Work it out",
    title: "What do unanswered messages cost you?",
    lede: "Move the numbers to your clinic's size — the arithmetic is on screen, not in a black box.",
    msgs: "After-hours messages per week",
    value: "Average value of a visit (OMR)",
    rate: "Share who would have booked if answered",
    resultLabel: "Estimated revenue lost per year",
    per: "per month",
    note:
      "The maths: weekly messages × the share who would have booked × visit value × 52 weeks. An estimate, not a promise — and the numbers are yours.",
    cta: "Show us your clinic",
  },
};

export function RoiCalculator() {
  const { lang } = useSite();
  const c = T[lang];

  const [msgs, setMsgs] = useState(25);
  const [value, setValue] = useState(35);
  const [rate, setRate] = useState(30);

  const { year, month } = useMemo(() => {
    const y = msgs * (rate / 100) * value * 52;
    return { year: Math.round(y), month: Math.round(y / 12) };
  }, [msgs, value, rate]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(lang === "ar" ? "ar-OM" : "en-GB", { maximumFractionDigits: 0 }).format(n);

  const rows = [
    { label: c.msgs, v: msgs, set: setMsgs, min: 5, max: 200, step: 5, suffix: "" },
    { label: c.value, v: value, set: setValue, min: 5, max: 200, step: 5, suffix: " ر.ع" },
    { label: c.rate, v: rate, set: setRate, min: 5, max: 60, step: 5, suffix: "%" },
  ];

  return (
    <section className="sec">
      <div className="wrap">
        <div className="roi">
          <div>
            <span className="pill"><TrendingUp size={12} /> {c.tag}</span>
            <h2 className="h2">{c.title}</h2>
            <p className="lede">{c.lede}</p>

            <div className="roi__ctl">
              {rows.map((r) => (
                <div key={r.label} className="roi__ctl">
                  <label htmlFor={r.label}>
                    {r.label}
                    <b className="mono">
                      {lang === "ar" ? fmt(r.v) : r.v}
                      {r.suffix === " ر.ع" ? (lang === "ar" ? " ر.ع" : " OMR") : r.suffix}
                    </b>
                  </label>
                  <input
                    id={r.label}
                    type="range"
                    min={r.min} max={r.max} step={r.step}
                    value={r.v}
                    onChange={(e) => r.set(Number(e.target.value))}
                    className="range"
                  />
                </div>
              ))}
            </div>
          </div>

          <motion.div
            className="roi__out"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          >
            <span className="roi__lab">{c.resultLabel}</span>
            {/* Keyed on the value so the figure re-animates as the sliders move,
                which is what makes the tool feel like it is responding. */}
            <motion.p
              key={year}
              className="roi__big mono"
              initial={{ opacity: 0.35, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.35 }}
            >
              {fmt(year)}
              <em>{lang === "ar" ? "ر.ع" : "OMR"}</em>
            </motion.p>
            <p className="roi__sub mono">
              ≈ {fmt(month)} {lang === "ar" ? "ر.ع" : "OMR"} · {c.per}
            </p>
            <p className="roi__note">{c.note}</p>
            <a href="/contact" className="btn btn--pri" style={{ marginTop: "1.4rem" }}>
              {c.cta}
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
