import { guardModule } from "@/lib/guard-module";
import { MarketingChrome } from "@/components/marketing/marketing-chrome";

/* The tab bar is a client component, so the guard cannot live inside it. This
   layout is the server half: check the contract first, and only then render the
   chrome that invites the manager to click into a module they do not have. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const locked = await guardModule("marketing");
  if (locked) return locked;
  return <MarketingChrome>{children}</MarketingChrome>;
}
