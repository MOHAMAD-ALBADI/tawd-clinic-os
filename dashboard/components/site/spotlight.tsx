"use client";

import { useEffect } from "react";

/* A light that follows the cursor across the whole page.

   Written as CSS custom properties on the root element and read by a fixed
   gradient layer, so the pointer never triggers a React render — at 60fps that
   would be 60 renders a second of the entire tree.

   rAF-throttled: mousemove fires far more often than the screen refreshes, and
   writing a style on every event is work the browser throws away.

   Pointer-only. On a touch screen there is no cursor to follow, and the layer
   would be a fixed gradient stuck wherever the last tap landed. */
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.querySelector(".site-root") as HTMLElement | null;
    if (!root) return;
    root.dataset.spotlight = "on";

    let x = 0, y = 0, queued = false;

    const write = () => {
      queued = false;
      root.style.setProperty("--cx", `${x}px`);
      root.style.setProperty("--cy", `${y}px`);
    };
    const onMove = (e: MouseEvent) => {
      x = e.clientX; y = e.clientY;
      if (!queued) { queued = true; requestAnimationFrame(write); }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      delete root.dataset.spotlight;
    };
  }, []);

  return <span className="s-spot" aria-hidden />;
}
