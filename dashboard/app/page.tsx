import { redirect } from "next/navigation";

// Root redirects to login — middleware handles role redirect after auth
export default function RootPage() {
  redirect("/login");
}
