import Link from "next/link";
import {
  AlertTriangle, CalendarClock, ShieldCheck, Coins, TrendingUp, ArrowUpRight, CheckCircle2,
} from "lucide-react";

export type ActionSignals = {
  lowStock: number;        // items at/below reorder level
  expiringSoon: number;    // batches expiring within 60 days
  openClaims: number;      // insurance claims pending/submitted
  claimsValue: number;     // OMR owed by insurers
  pendingCommissions: number; // commissions awaiting approval
  monthProfit: number;     // revenue − expenses this month
  unbilledVisits: number;  // completed appointments with no invoice
};

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

/** What the manager must ACT on today, pulled from the operational modules
    (inventory / insurance / commissions / finance). Only real signals appear —
    a clean clinic shows a single "all clear" line instead of empty boxes. */
export function ActionCenter({ s }: { s: ActionSignals }) {
  const items = [
    s.unbilledVisits > 0 && {
      href: "/accountant", tone: "warn" as const, Icon: TrendingUp,
      label: "زيارات مكتملة بلا فاتورة", value: String(s.unbilledVisits), hint: "إيراد غير محصّل",
    },
    s.lowStock > 0 && {
      href: "/clinic-admin/inventory", tone: "warn" as const, Icon: AlertTriangle,
      label: "أصناف تحت حد الطلب", value: String(s.lowStock), hint: "اطلب قبل النفاد",
    },
    s.expiringSoon > 0 && {
      href: "/clinic-admin/inventory", tone: "warn" as const, Icon: CalendarClock,
      label: "دفعات تنتهي خلال ٦٠ يوم", value: String(s.expiringSoon), hint: "استخدمها أولاً",
    },
    s.openClaims > 0 && {
      href: "/clinic-admin/insurance", tone: "info" as const, Icon: ShieldCheck,
      label: "مطالبات تأمين قيد المعالجة", value: String(s.openClaims),
      hint: `${fmt(s.claimsValue)} ر.ع مستحقة`,
    },
    s.pendingCommissions > 0 && {
      href: "/clinic-admin/finance/payroll", tone: "info" as const, Icon: Coins,
      label: "عمولات تنتظر اعتمادك", value: String(s.pendingCommissions), hint: "اعتمد ثم اصرف",
    },
  ].filter(Boolean) as {
    href: string; tone: "warn" | "info"; Icon: typeof AlertTriangle;
    label: string; value: string; hint: string;
  }[];

  const profitColor = s.monthProfit >= 0 ? "var(--accent-1)" : "#fda4b4";

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="section-title">
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: items.length ? "#fbbf24" : "var(--text-3)" }} />
          <h2>يحتاج انتباهك</h2>
        </div>
        {/* month profit — always shown; it's the one number a manager wants daily */}
        <Link href="/clinic-admin/finance" className="flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--hairline)" }}>
          <span style={{ color: "var(--text-3)" }}>صافي ربح الشهر</span>
          <span className="font-black ltr-nums" style={{ color: profitColor }}>{fmt(s.monthProfit)}</span>
          <span className="text-[10px]" style={{ color: "var(--text-4)" }}>ر.ع</span>
          <ArrowUpRight className="w-3 h-3" style={{ color: "var(--text-4)" }} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" />
          لا شيء عاجل — المخزون والمطالبات والفوترة كلها منتظمة ✓
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {items.map((it) => {
            const c = it.tone === "warn" ? "#fbbf24" : "var(--accent-1)";
            return (
              <Link key={it.label} href={it.href}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl transition-colors"
                style={{ background: `${it.tone === "warn" ? "rgba(251,191,36,0.06)" : "rgb(var(--accent-1-rgb) / 0.05)"}`,
                         border: `1px solid ${it.tone === "warn" ? "rgba(251,191,36,0.2)" : "rgb(var(--accent-1-rgb) / 0.18)"}` }}>
                <it.Icon className="w-4 h-4 shrink-0" style={{ color: c }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold text-white truncate">{it.label}</p>
                  <p className="text-[10.5px] truncate" style={{ color: "var(--text-4)" }}>{it.hint}</p>
                </div>
                <span className="font-black ltr-nums text-lg shrink-0" style={{ color: c }}>{it.value}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
