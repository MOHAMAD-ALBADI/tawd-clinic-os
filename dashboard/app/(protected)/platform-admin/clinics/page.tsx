import { redirect } from "next/navigation";

/** The platform overview IS the clinics list — keep one source of truth. */
export default function ClinicsPage() {
  redirect("/platform-admin");
}
