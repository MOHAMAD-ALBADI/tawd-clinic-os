import { redirect } from "next/navigation";

/* Payroll moved into the finance hub. Kept so old links and bookmarks land on
   the right tab instead of a 404. */
export default function MovedPayrollPage() {
  redirect("/clinic-admin/finance/payroll");
}
