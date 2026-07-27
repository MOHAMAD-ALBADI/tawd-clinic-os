import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { ErrorTracker } from "@/components/system/error-tracker";
import { PostHogProvider } from "@/components/system/posthog-provider";
import { ArabicNumerals } from "@/components/system/arabic-numerals";
import "./globals.css";

/* Body + display: engineered Arabic — precise, clinical, excellent weights */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});

/* Numerals: tabular mono — the dashboard reads like a medical instrument */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  /* A template so every tab says what it is AND whose it is. Pages set their
     own title; without this they replaced the brand entirely. */
  title: { default: "طود — نظام إدارة العيادات", template: "%s | طود" },
  description: "منصة طود الذكية لإدارة العيادات الطبية",
  /* app/favicon.ico was a leftover from the Next starter and, being a
     file-convention icon, outranked this declaration — so the tab showed it no
     matter what was set here. It is deleted; the SVG is the mark. */
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
  applicationName: "طود",
};

/* themeColor moved out of metadata: Next treats it as a viewport field and warns
   during build if it is declared above. */
export const viewport: Viewport = {
  themeColor: "#0a0a09",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`dark ${plexArabic.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ErrorTracker />
        <ArabicNumerals />
        <PostHogProvider />
        {children}
      </body>
    </html>
  );
}
