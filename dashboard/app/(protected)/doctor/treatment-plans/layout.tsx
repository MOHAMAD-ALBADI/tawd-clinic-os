import { guardModule } from "@/lib/guard-module";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (await guardModule("treatment_plans")) ?? <>{children}</>;
}
