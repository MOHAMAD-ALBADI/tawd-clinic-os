import { meta } from "@/lib/site/meta";

/* Titles live in one table so they can be read against each other.
   The page itself is a client component and cannot export metadata. */
export const metadata = meta("products/ai");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
