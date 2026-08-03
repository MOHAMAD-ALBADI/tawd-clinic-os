"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, Sparkles } from "lucide-react";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { useSite } from "@/components/site/lang";
import { NAV, FOOTER } from "@/lib/site/nav";

/* Header with mega panels, and the enterprise footer.

   A flat link bar tops out at about six items; this site has thirty pages. The
   panels are what make depth reachable in one hover instead of three clicks,
   and they are the single clearest signal that a site belongs to a company
   rather than to a product. */

export function SiteHeader() {
  const { t, lang, setLang } = useSite();
  const path = usePathname();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const demo = lang === "ar" ? "احجز عرضاً" : "Book a demo";
  const signin = lang === "ar" ? "دخول" : "Sign in";

  /* A short grace period on leaving. Without it the panel snaps shut in the gap
     between the trigger and the panel itself, and the menu becomes unusable
     with a mouse. */
  const open = (k: string) => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpenKey(k); };
  const close = () => { closeTimer.current = setTimeout(() => setOpenKey(null), 140); };

  useEffect(() => { setOpenKey(null); setMobile(false); }, [path]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpenKey(null); setMobile(false); } };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <header className="nav" onMouseLeave={close}>
      <div className="wrap nav__in">
        <Link href="/" className="nav__logo">
          <TawdBarsGlyph size={22} />
          <span className="disp">{t.brand}</span>
        </Link>

        <nav className="nav__links">
          {NAV.map((n) =>
            n.href ? (
              <Link key={n.key} href={n.href} data-on={path === n.href} onMouseEnter={() => open("")}>
                {lang === "ar" ? n.ar : n.en}
              </Link>
            ) : (
              <button
                key={n.key}
                className="nav__trig"
                data-on={openKey === n.key}
                onMouseEnter={() => open(n.key)}
                onClick={() => setOpenKey(openKey === n.key ? null : n.key)}
                aria-expanded={openKey === n.key}
              >
                {lang === "ar" ? n.ar : n.en}
                <ChevronDown size={13} />
              </button>
            )
          )}
        </nav>

        <div className="nav__act">
          <div className="lang" role="group" aria-label="Language">
            <button onClick={() => setLang("ar")} data-on={lang === "ar"} aria-pressed={lang === "ar"}>ع</button>
            <button onClick={() => setLang("en")} data-on={lang === "en"} aria-pressed={lang === "en"}>EN</button>
          </div>
          <Link href="/login" className="nav__signin">{signin}</Link>
          <Link href="/contact" className="btn btn--pri btn--sm">{demo}</Link>
          <button className="burger" onClick={() => setMobile(!mobile)} aria-expanded={mobile}
            aria-label={mobile ? t.nav.close : t.nav.menu}>
            {mobile ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* Dims the page behind an open panel. z-index -1 keeps it under the
          panel but over everything else, and clicking it closes the menu. */}
      {openKey && <div className="scrim" aria-hidden onClick={() => setOpenKey(null)} />}

      {/* mega panel */}
      {NAV.filter((n) => n.groups).map((n) =>
        openKey === n.key ? (
          <div key={n.key} className="mega" onMouseEnter={() => open(n.key)}>
            <div className="wrap mega__in">
              {n.groups!.map((g) => (
                <div key={g.ar} className="mega__col">
                  <p className="mega__h">{lang === "ar" ? g.ar : g.en}</p>
                  {g.items.map((it) => (
                    <Link key={it.href} href={it.href} className="mega__i">
                      <b>{lang === "ar" ? it.ar : it.en}</b>
                      {(it.arD || it.enD) && <em>{lang === "ar" ? it.arD : it.enD}</em>}
                    </Link>
                  ))}
                </div>
              ))}

              {n.feature && (
                <Link href={n.feature.href} className="mega__feat">
                  <span className="mega__featic"><Sparkles size={20} /></span>
                  <b>{lang === "ar" ? n.feature.ar : n.feature.en}</b>
                  <em>{lang === "ar" ? n.feature.arD : n.feature.enD}</em>
                </Link>
              )}
            </div>
          </div>
        ) : null
      )}

      {mobile && (
        <nav className="mobnav">
          {NAV.map((n) => (
            <div key={n.key}>
              {n.href ? (
                <Link href={n.href}>{lang === "ar" ? n.ar : n.en}</Link>
              ) : (
                <>
                  <p className="mobnav__h">{lang === "ar" ? n.ar : n.en}</p>
                  {n.groups!.flatMap((g) => g.items).map((it) => (
                    <Link key={it.href} href={it.href} className="mobnav__sub">
                      {lang === "ar" ? it.ar : it.en}
                    </Link>
                  ))}
                </>
              )}
            </div>
          ))}
          <Link href="/login">{signin}</Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { t, lang } = useSite();
  const year = new Date().getFullYear();

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__g">
          <div className="foot__brand">
            <div className="nav__logo" style={{ marginBottom: "1rem" }}>
              <TawdBarsGlyph size={20} />
              <span className="disp">{t.brand}</span>
            </div>
            <p style={{ fontSize: "0.86rem", color: "var(--tx-2)", maxWidth: "32ch", lineHeight: 1.9 }}>
              {lang === "ar"
                ? "نبني أنظمة ذكية تُدير العيادات وتردّ على مرضاها — من سلطنة عُمان."
                : "Building intelligent systems that run clinics and answer their patients — from Oman."}
            </p>
          </div>

          {FOOTER.map((g) => (
            <div key={g.en}>
              <p className="foot__h">{lang === "ar" ? g.ar : g.en}</p>
              <div className="foot__l">
                {g.items.map((it) => (
                  <Link key={it.href} href={it.href}>{lang === "ar" ? it.ar : it.en}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="foot__b">
          <span className="mono">© {year} {t.brand} — {t.footer.rights}</span>
          <span>{lang === "ar" ? "مسقط، سلطنة عُمان" : "Muscat, Oman"} 🇴🇲</span>
        </div>
      </div>
    </footer>
  );
}
