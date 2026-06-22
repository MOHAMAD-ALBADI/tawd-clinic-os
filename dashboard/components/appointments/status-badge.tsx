import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types/tawd";

interface StatusConfig {
  label: string;
  className: string;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<AppointmentStatus, StatusConfig> = {
  scheduled:   { label: "مجدول",        className: "bg-slate-100  text-slate-600  dark:bg-slate-800/60  dark:text-slate-300" },
  confirmed:   { label: "مؤكد",         className: "bg-sky-100    text-sky-700    dark:bg-sky-950/60    dark:text-sky-300"  },
  checked_in:  { label: "وصل",          className: "bg-teal-100   text-teal-700   dark:bg-teal-950/60   dark:text-teal-300", pulse: true },
  in_progress: { label: "جارٍ الفحص",  className: "bg-teal-100   text-teal-700   dark:bg-teal-900/50   dark:text-teal-200", pulse: true },
  completed:   { label: "مكتمل",        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  cancelled:   { label: "ملغي",         className: "bg-slate-100  text-slate-500  dark:bg-slate-800/60  dark:text-slate-400" },
  no_show:     { label: "لم يحضر",     className: "bg-rose-100   text-rose-700   dark:bg-rose-950/60   dark:text-rose-300" },
};

const LATE_CONFIG: StatusConfig = {
  label: "متأخر",
  className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  pulse: true,
};

interface StatusBadgeProps {
  status: AppointmentStatus;
  isLate?: boolean;
  className?: string;
}

export function AppointmentStatusBadge({
  status,
  isLate,
  className,
}: StatusBadgeProps) {
  const config =
    isLate && status === "confirmed" ? LATE_CONFIG : STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        config.className,
        className
      )}
    >
      {config.pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow shrink-0" />
      )}
      {config.label}
    </span>
  );
}
