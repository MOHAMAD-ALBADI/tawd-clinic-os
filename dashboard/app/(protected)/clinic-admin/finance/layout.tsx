import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { FinanceTabs } from "@/components/finance/finance-tabs";

/* Guarding here means every finance tab is behind the same check — a new tab
   cannot be added without it. */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">FINANCE</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">المالية</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          الفواتير والمصروفات والرواتب والعمولات والدفع الإلكتروني — في مكان واحد
        </p>
      </div>

      <FinanceTabs />
      {children}
    </div>
  );
}
