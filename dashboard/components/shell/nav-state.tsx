"use client";

import { createContext, useContext, useEffect, useState } from "react";

/* Whether the navigation drawer is open.
 *
 * The sidebar was `fixed … w-64` with no breakpoint at all, so on a 390px
 * phone it took 256 of them and left the clinic 134 pixels to work in.
 * Nothing overflowed and nothing errored — it was simply unusable, which
 * is the kind of broken that survives a desktop review.
 *
 * The state lives here because two components need it: the drawer that
 * slides, and the button in the top bar that opens it.
 */

type NavState = { open: boolean; setOpen: (v: boolean) => void };

const Ctx = createContext<NavState>({ open: false, setOpen: () => {} });

export const useNav = () => useContext(Ctx);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  /* Closing happens where the tap happens — on the link itself — rather
     than in an effect watching the path. Same result, one render fewer,
     and no setState cascading out of a route change. */

  useEffect(() => {
    if (!open) return;

    /* The page behind must not scroll under the drawer — on a phone that
       reads as the app losing your place. */
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}
