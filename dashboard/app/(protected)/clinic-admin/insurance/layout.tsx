import { guardModule } from "@/lib/guard-module";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (await guardModule("insurance")) ?? <>{children}</>;
}
