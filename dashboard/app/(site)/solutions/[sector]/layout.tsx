import type { Metadata } from "next";
import { bySlug, SECTORS } from "@/lib/site/content/solutions";

/* Seven sector pages share one route, so their titles come from the same
   content file the pages render from — one place to edit, and a new sector
   arrives with its own title rather than inheriting a generic one. */
export async function generateMetadata(
  { params }: { params: Promise<{ sector: string }> },
): Promise<Metadata> {
  const { sector } = await params;
  const s = bySlug(sector);
  if (!s) return { title: { absolute: "الحلول | طَود" } };

  return {
    title: { absolute: `${s.ar.name} | طَود` },
    description: s.ar.lede,
    openGraph: { title: `${s.ar.name} | طَود`, description: s.ar.lede, type: "website", locale: "ar_OM" },
    alternates: { canonical: `/solutions/${sector}` },
  };
}

/* Pre-rendered rather than resolved per request: seven pages, all known at
   build time, and a marketing page that waits on a lookup is a slow first
   impression for no gain. */
export function generateStaticParams() {
  return SECTORS.map((s) => ({ sector: s.slug }));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
