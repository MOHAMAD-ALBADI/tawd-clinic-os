"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dict, type Lang, type Dict } from "@/lib/site/dict";

/* Language is client state, not a route.

   /ar and /en would double every URL and, on a six-page site, buy nothing —
   there is no per-language SEO strategy to protect yet, and a visitor who
   switches would lose their place on the page. The toggle keeps them exactly
   where they were reading.

   The choice is remembered, because a clinic that reads in English should not
   have to say so on every visit. */

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: "ar", t: dict.ar, setLang: () => {} });

const KEY = "tawd-site-lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  /* Arabic first, always — the default has to be right for the majority of
     Omani clinics rather than for whatever the browser happens to report. */
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (saved === "en" || saved === "ar") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try { window.localStorage.setItem(KEY, l); } catch { /* private mode */ }
  }

  const t = dict[lang] as unknown as Dict;

  return (
    <LangCtx.Provider value={{ lang, t, setLang }}>
      {/* dir lives here rather than on <html>: the dashboard owns that element
          and is permanently RTL. */}
      <div dir={t.dir} lang={lang} className={`site-root site-${lang}`}>
        {/* One light source behind everything, drifting, plus fine grain over
            it — without the grain a large flat gradient bands visibly. */}
        <span className="s-aurora" aria-hidden />
        <span className="s-grain" aria-hidden />
        {children}
      </div>
    </LangCtx.Provider>
  );
}

export const useSite = () => useContext(LangCtx);
