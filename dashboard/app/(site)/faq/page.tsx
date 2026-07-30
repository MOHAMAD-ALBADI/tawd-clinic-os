"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useSite } from "@/components/site/lang";

export default function FaqPage() {
  const { t } = useSite();
  const f = t.faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <section className="s-section--tight" style={{ paddingBlock: "clamp(3rem, 8vw, 5rem)" }}>
        <div className="s-wrap">
          <span className="s-eyebrow">{f.eyebrow}</span>
          <h1 className="s-h2" style={{ fontSize: "clamp(2rem, 5.5vw, 3.2rem)" }}>{f.title}</h1>
        </div>
      </section>

      <section style={{ paddingBottom: "clamp(3rem, 8vw, 6rem)" }}>
        <div className="s-wrap" style={{ maxWidth: 860 }}>
          {f.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="s-acc" data-open={isOpen}>
                <h2 style={{ margin: 0 }}>
                  <button
                    className="s-acc__q"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                  >
                    {item.q}
                    <Plus size={18} className="s-acc__i" />
                  </button>
                </h2>
                {isOpen && <div className="s-acc__a" id={`faq-${i}`}>{item.a}</div>}
              </div>
            );
          })}

          <div style={{ marginTop: "3rem" }}>
            <h2 className="s-card__t" style={{ fontSize: "1.1rem" }}>{f.moreTitle}</h2>
            <p className="s-card__d" style={{ marginBottom: "1.2rem" }}>{f.moreBody}</p>
            <Link href="/contact" className="s-btn s-btn--ghost">{t.nav.contact}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
