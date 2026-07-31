"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Phone } from "lucide-react";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { useSite } from "@/components/site/lang";

/* Header and footer.

   Two actions at the end of the bar rather than one, matching how enterprise
   sites split intent: the outlined one is for "I want to talk to someone", the
   solid one is for "show me". A single button forces both intents down one path
   and loses the visitor who is not ready to buy. */

const LINKS = [
  { href: "/product", k: "product" },
  { href: "/pricing", k: "pricing" },
  { href: "/faq", k: "faq" },
  { href: "/about", k: "about" },
] as const;

export function SiteHeader() {
  const { t, lang, setLang } = useSite();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = t.nav as unknown as Record<string, string>;
  const demo = lang === "ar" ? "احجز عرضاً" : "Book a demo";
  const talk = lang === "ar" ? "تواصل معنا" : "Contact";

  return (
    <header className="nav">
      <div className="wrap nav__in">
        <Link href="/" className="nav__logo" onClick={() => setOpen(false)}>
          <TawdBarsGlyph size={22} />
          <span className="disp">{t.brand}</span>
        </Link>

        <nav className="nav__links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} data-on={path === l.href}>{nav[l.k]}</Link>
          ))}
        </nav>

        <div className="nav__act">
          <div className="lang" role="group" aria-label="Language">
            <button onClick={() => setLang("ar")} data-on={lang === "ar"} aria-pressed={lang === "ar"}>ع</button>
            <button onClick={() => setLang("en")} data-on={lang === "en"} aria-pressed={lang === "en"}>EN</button>
          </div>

          <Link href="/contact" className="btn btn--out btn--sm" style={{ display: "none" }} data-wide>
            <Phone size={13} /> {talk}
          </Link>
          <Link href="/contact" className="btn btn--pri btn--sm">{demo}</Link>

          <button className="burger" onClick={() => setOpen(!open)} aria-expanded={open}
            aria-label={open ? t.nav.close : t.nav.menu}>
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="mobnav">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{nav[l.k]}</Link>
          ))}
          <Link href="/contact" onClick={() => setOpen(false)}>{nav.contact}</Link>
          <Link href="/login" onClick={() => setOpen(false)}>{nav.login}</Link>
        </nav>
      )}

      <style jsx>{`
        @media (min-width: 1120px) { :global(.nav__act [data-wide]) { display: inline-flex !important; } }
      `}</style>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useSite();
  const year = new Date().getFullYear();

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__g">
          <div>
            <div className="nav__logo" style={{ marginBottom: "0.9rem" }}>
              <TawdBarsGlyph size={20} />
              <span className="disp">{t.brand}</span>
            </div>
            <p style={{ fontSize: "0.86rem", color: "var(--tx-2)", maxWidth: "34ch", lineHeight: 1.9 }}>
              {t.footer.tagline}
            </p>
          </div>

          <div>
            <p className="foot__h">{t.footer.product}</p>
            <div className="foot__l">
              <Link href="/product">{t.nav.product}</Link>
              <Link href="/pricing">{t.nav.pricing}</Link>
              <Link href="/faq">{t.nav.faq}</Link>
            </div>
          </div>

          <div>
            <p className="foot__h">{t.footer.company}</p>
            <div className="foot__l">
              <Link href="/about">{t.nav.about}</Link>
              <Link href="/contact">{t.nav.contact}</Link>
              <Link href="/login">{t.nav.login}</Link>
            </div>
          </div>

          <div>
            <p className="foot__h">{t.footer.legalT}</p>
            <div className="foot__l">
              <Link href="/legal/privacy">{t.footer.privacy}</Link>
              <Link href="/legal/terms">{t.footer.terms}</Link>
              <Link href="/legal/data-deletion">{t.footer.deletion}</Link>
            </div>
          </div>
        </div>

        <div className="foot__b">
          <span className="mono">© {year} {t.brand} — {t.footer.rights}</span>
          <span>{t.footer.built} 🇴🇲</span>
        </div>
      </div>
    </footer>
  );
}
