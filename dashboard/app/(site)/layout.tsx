import type { Metadata } from "next";
import { LangProvider } from "@/components/site/lang";
import { SiteHeader, SiteFooter } from "@/components/site/chrome";
import { siteFontVars } from "@/lib/site/fonts";
import "./site.css";

/* The company site. Separate shell from the product on purpose — the dashboard
   is permanently Arabic and RTL, and this has to switch. */

export const metadata: Metadata = {
  title: {
    default: "طَود — نظام تشغيل العيادات",
    template: "%s | طَود",
  },
  description:
    "سُرى تردّ على مرضى عيادتك في واتساب وتحجز لهم موعداً حقيقياً — ونظام تشغيل عيادة كامل تحتها. من سلطنة عُمان.",
  openGraph: {
    title: "طَود — نظام تشغيل العيادات",
    description:
      "مساعد ذكي يردّ على مرضاك في واتساب ويحجز لهم فعلياً، ونظام عيادة كامل تحته.",
    type: "website",
    locale: "ar_OM",
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={siteFontVars}>
      {/* The reveal animation hides sections until they scroll into view. If the
          script never runs, every section below the hero would stay invisible
          forever — a page that looks empty rather than one that looks static.
          This is the only correct place to undo it. */}
      <noscript>
        <style>{`.rev { opacity: 1 !important; translate: none !important; }`}</style>
      </noscript>
      <LangProvider>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </LangProvider>
    </div>
  );
}
