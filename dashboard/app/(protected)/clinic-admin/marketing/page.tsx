import { redirect } from "next/navigation";

/* /marketing has no content of its own — it lands on the first tab, which carries
   its own role guard. Kept as a redirect so the nav item and any old links resolve. */
export default function MarketingRootPage() {
  redirect("/clinic-admin/marketing/loyalty");
}
