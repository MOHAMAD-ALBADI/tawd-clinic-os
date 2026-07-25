import { redirect } from "next/navigation";

/* Invoicing moved into the finance hub. Kept so old links and bookmarks land
   on the right tab instead of a 404. */
export default function MovedInvoicesPage() {
  redirect("/clinic-admin/finance/invoices");
}
