import { Noto_Kufi_Arabic, Almarai, Space_Grotesk, Karla, IBM_Plex_Mono } from "next/font/google";

/* Type for the company site.

   Deliberately NOT the dashboard's faces. The product is an instrument and is
   set in one neutral family so nothing competes with the data. A company site
   has the opposite job: it has to have a voice.

   Kufi carries the name. طَود means a mountain that does not move, and Noto
   Kufi's flat terminals and heavy verticals are architectural in a way no
   humanist Arabic face is — the display face argues the brand's claim before a
   word is read. Almarai sets the body because it is quiet enough to read a
   paragraph in and shares Kufi's squared rhythm.

   Plex Mono is the one carry-over from the product, and only for numbers. The
   same face that totals a clinic's invoices prints the figures here, so the
   proof on this page and the ledger it came from are visibly the same system. */

export const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
  variable: "--site-display-ar",
  display: "swap",
});

export const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700"],
  variable: "--site-body-ar",
  display: "swap",
});

export const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--site-display-en",
  display: "swap",
});

export const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--site-body-en",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--site-mono",
  display: "swap",
});

export const siteFontVars = [
  kufi.variable,
  almarai.variable,
  grotesk.variable,
  karla.variable,
  mono.variable,
].join(" ");
