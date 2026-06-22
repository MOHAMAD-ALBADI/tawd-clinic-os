"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "teal" | "gold" | "success" | "danger" | "slate";

interface KPICardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  variant?: Variant;
  isLive?: boolean;
}

const V: Record<Variant, {
  glow: string;
  border: string;
  topBar: string;
  valueColor: string;
  iconBg: string;
  liveColor: string;
  badge: string;
}> = {
  teal: {
    glow:       "rgba(20,184,166,0.18)",
    border:     "rgba(20,184,166,0.25)",
    topBar:     "linear-gradient(90deg, #0d9488, #14b8a6)",
    valueColor: "#5dd9cb",
    iconBg:     "rgba(20,184,166,0.15)",
    liveColor:  "#5dd9cb",
    badge:      "rgba(20,184,166,0.2)",
  },
  gold: {
    glow:       "rgba(20,184,166,0.15)",
    border:     "rgba(20,184,166,0.2)",
    topBar:     "linear-gradient(90deg, #0f766e, #14b8a6)",
    valueColor: "#2dd4bf",
    iconBg:     "rgba(20,184,166,0.12)",
    liveColor:  "#14b8a6",
    badge:      "rgba(20,184,166,0.15)",
  },
  success: {
    glow:       "rgba(16,185,129,0.15)",
    border:     "rgba(16,185,129,0.22)",
    topBar:     "linear-gradient(90deg, #059669, #10B981)",
    valueColor: "#34D399",
    iconBg:     "rgba(16,185,129,0.12)",
    liveColor:  "#34D399",
    badge:      "rgba(16,185,129,0.15)",
  },
  danger: {
    glow:       "rgba(239,68,68,0.15)",
    border:     "rgba(239,68,68,0.22)",
    topBar:     "linear-gradient(90deg, #B91C1C, #EF4444)",
    valueColor: "#F87171",
    iconBg:     "rgba(239,68,68,0.12)",
    liveColor:  "#F87171",
    badge:      "rgba(239,68,68,0.15)",
  },
  slate: {
    glow:       "rgba(100,116,139,0.12)",
    border:     "rgba(100,116,139,0.18)",
    topBar:     "linear-gradient(90deg, #334155, #64748B)",
    valueColor: "#94A3B8",
    iconBg:     "rgba(100,116,139,0.12)",
    liveColor:  "#64748B",
    badge:      "rgba(100,116,139,0.12)",
  },
};

export function KPICard({
  label,
  value,
  subLabel,
  change,
  changeLabel,
  icon,
  variant = "teal",
  isLive,
}: KPICardProps) {
  const v = V[variant];
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 group"
      style={{
        background: "rgba(8,18,36,0.8)",
        border: `1px solid ${v.border}`,
        boxShadow: `0 0 0 0 ${v.glow}, 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
        backdropFilter: "blur(20px)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 30px ${v.glow}, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 0 ${v.glow}, 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`;
      }}
    >
      {/* Color accent line */}
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: v.topBar }} />

      <div className="p-5 pt-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4 gap-2">
          <p className="text-[13px] font-medium leading-tight" style={{ color: "rgba(148,163,184,0.85)" }}>
            {label}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {isLive && (
              <span
                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: v.badge, color: v.liveColor }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse-slow"
                  style={{ background: v.liveColor }}
                />
                مباشر
              </span>
            )}
            {icon && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: v.iconBg, border: `1px solid ${v.border}` }}
              >
                {icon}
              </div>
            )}
          </div>
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-2">
          <span
            className="text-[2.4rem] font-extrabold ltr-nums leading-none tracking-tight"
            style={{ color: v.valueColor }}
          >
            {value}
          </span>
          {subLabel && (
            <span className="text-sm font-medium" style={{ color: "rgba(148,163,184,0.6)" }}>
              {subLabel}
            </span>
          )}
        </div>

        {/* Change */}
        {change !== undefined && (
          <div
            className="flex items-center gap-1.5 mt-3 text-[12px] font-medium"
            style={{ color: isPositive ? "#34D399" : "#F87171" }}
          >
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span className="ltr-nums">{Math.abs(change)}%</span>
            {changeLabel && (
              <span className="font-normal" style={{ color: "rgba(148,163,184,0.5)" }}>
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
