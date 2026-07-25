"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PieChart, CreditCard, Receipt, Wallet, Percent, Smartphone } from "lucide-react";

/* One money hub, six views. Invoicing, expenses, payroll, commissions and the
   online gateway were five separate sidebar entries that all answered the same
   question — "where is the clinic's money?" — so they live together now and the
   sidebar carries a single "المالية". */

const TABS = [
  { href: "/clinic-admin/finance",             label: "نظرة عامة",  Icon: PieChart,   exact: true },
  { href: "/clinic-admin/finance/invoices",    label: "الفواتير",   Icon: CreditCard },
  { href: "/clinic-admin/finance/expenses",    label: "المصروفات",  Icon: Receipt },
  { href: "/clinic-admin/finance/payroll",     label: "الرواتب",    Icon: Wallet },
  { href: "/clinic-admin/finance/commissions", label: "العمولات",   Icon: Percent },
  { href: "/clinic-admin/finance/online",      label: "ثواني",      Icon: Smartphone },
];

export function FinanceTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-1.5 shrink-0 text-[12.5px] font-bold px-3.5 py-2 rounded-xl transition-colors"
            style={{
              background: active ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.025)",
              border: `1px solid ${active ? "rgba(45,212,191,0.32)" : "var(--hairline)"}`,
              color: active ? "var(--accent-1)" : "var(--text-3)",
            }}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
