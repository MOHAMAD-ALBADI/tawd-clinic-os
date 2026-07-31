"use client";

import { useEffect, useRef, useState } from "react";

/* Sections arrive as you reach them.

   IntersectionObserver rather than a scroll listener: the browser does the
   work off the main thread, so a long page does not jank. Each element is
   unobserved once it has appeared — a reveal that re-fires when you scroll back
   up reads as a glitch, not a flourish.

   Anything still hidden when JS has not run would be unreadable, so the hidden
   state is applied by the component itself after mount rather than in CSS. */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: "div" | "section" | "li";
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setTimeout(() => setShown(true), delay);
        io.unobserve(e.target);
      },
      /* Fires a little before the element is fully on screen, so the motion has
         finished by the time the reader's eye arrives. */
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  const P = Tag as React.ElementType;
  return (
    <P
      ref={ref as React.Ref<HTMLElement>}
      className={`rev ${className}`}
      data-in={shown}
      style={style}
    >
      {children}
    </P>
  );
}
