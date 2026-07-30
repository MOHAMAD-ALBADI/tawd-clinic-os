"use client";

import { useEffect, useRef, useState } from "react";

/* A figure that counts up the first time you reach it.

   Static numbers on a landing page are read as decoration. A number that moves
   is read as a reading — which is what these are. It counts once and stops;
   re-running on every scroll past would turn proof into a toy.

   The value is parsed out of the display string so the suffix and decimals
   survive ("85.6%" counts to 85.6 and keeps the %, "500+" keeps the +). */
export function Counter({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [text, setText] = useState(value);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const m = value.match(/^([^\d]*)([\d.]+)(.*)$/);
    if (!m) return;
    const [, pre, numStr, post] = m;
    const target = parseFloat(numStr);
    const decimals = (numStr.split(".")[1] ?? "").length;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setText(`${pre}${(0).toFixed(decimals)}${post}`);

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done.current) return;
      done.current = true;
      io.disconnect();

      const DUR = 1400;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / DUR);
        /* Ease-out: fast at first, settling at the end — a number that
           decelerates onto its value reads as arriving, not as spinning. */
        const eased = 1 - Math.pow(1 - p, 3);
        setText(`${pre}${(target * eased).toFixed(decimals)}${post}`);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });

    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref}>{text}</span>;
}
