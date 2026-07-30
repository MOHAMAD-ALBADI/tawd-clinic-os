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
      <LangProvider>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </LangProvider>
    </div>
  );
}
