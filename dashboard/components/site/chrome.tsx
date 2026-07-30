"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { useSite } from "@/components/site/lang";

const LINKS = [
  { href: "/product", k: "product" },
  { href: "/pricing", k: "pricing" },
  { href: "/faq", k: "faq" },
  { href: "/about", k: "about" },
  { href: "/contact", k: "contact" },
] as const;

export function SiteHeader() {
  const { t, lang, setLang } = useSite();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = t.nav as unknown as Record<string, string>;

  return (
    <header className="s-head">
      <div className="s-wrap s-head__in">
        <Link href="/" className="s-head__brand" onClick={() => setOpen(false)}>
          <TawdBarsGlyph size={18} />
          <span className="s-display">{t.brand}</span>
        </Link>

        <nav className="s-head__nav">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} data-active={path === l.href}>
              {nav[l.k]}
            </Link>
          ))}
        </nav>

        <div className="s-head__side">
          {/* Labelled in each language's own script, so neither is the other's
              translation — a reader finds their own word, not a flag. */}
          <div className="s-lang" role="group" aria-label="Language">
            <button onClick={() => setLang("ar")} data-on={lang === "ar"} aria-pressed={lang === "ar"}>ع</button>
            <button onClick={() => setLang("en")} data-on={lang === "en"} aria-pressed={lang === "en"}>EN</button>
          </div>

          <Link href="/login" className="s-btn s-btn--ghost" style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>
            {t.nav.login}
          </Link>

          <button className="s-burger" onClick={() => setOpen(!open)} aria-expanded={open}
            aria-label={open ? t.nav.close : t.nav.menu}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="s-mobnav">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{nav[l.k]}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useSite();
  const year = new Date().getFullYear();

  return (
    <footer className="s-foot">
      <div className="s-wrap">
        <div className="s-foot__grid">
          <div>
            <div className="s-head__brand" style={{ marginBottom: "0.7rem" }}>
              <TawdBarsGlyph size={18} />
              <span className="s-display">{t.brand}</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--s-text-3)", maxWidth: "34ch", lineHeight: 1.7 }}>
              {t.footer.tagline}
            </p>
          </div>

          <div>
            <p className="s-foot__h">{t.footer.product}</p>
            <div className="s-foot__l">
              <Link href="/product">{t.nav.product}</Link>
              <Link href="/pricing">{t.nav.pricing}</Link>
              <Link href="/faq">{t.nav.faq}</Link>
            </div>
          </div>

          <div>
            <p className="s-foot__h">{t.footer.company}</p>
            <div className="s-foot__l">
              <Link href="/about">{t.nav.about}</Link>
              <Link href="/contact">{t.nav.contact}</Link>
              <Link href="/login">{t.nav.login}</Link>
            </div>
          </div>

          <div>
            <p className="s-foot__h">{t.footer.legalT}</p>
            <div className="s-foot__l">
              <Link href="/legal/privacy">{t.footer.privacy}</Link>
              <Link href="/legal/terms">{t.footer.terms}</Link>
              <Link href="/legal/data-deletion">{t.footer.deletion}</Link>
            </div>
          </div>
        </div>

        <div className="s-foot__bar">
          <span className="s-num">© {year} {t.brand} — {t.footer.rights}</span>
          <span>{t.footer.built} 🇴🇲</span>
        </div>
      </div>
    </footer>
  );
}
