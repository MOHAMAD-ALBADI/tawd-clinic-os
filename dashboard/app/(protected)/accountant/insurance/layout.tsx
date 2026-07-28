import { guardModule } from "@/lib/guard-module";

/* Same module as the manager's insurance screens — a clinic that did not buy it
   does not get a second door into it from the finance side. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  return (await guardModule("insurance")) ?? <>{children}</>;
}
