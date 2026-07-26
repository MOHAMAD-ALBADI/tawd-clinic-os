"use client";

import { useState, type ElementType } from "react";
import { Star, Radio, MessageSquare, Settings2, ChevronLeft } from "lucide-react";
import Link from "next/link";

/* Loyalty is summarised here, not edited here.

   This card used to carry a second, divergent copy of the loyalty form — one
   that listed a "نقاط لكل إحالة" rule no code reads while omitting settings the
   engine depends on. Two editors for one row of settings is how they drift.
   Editing lives at /clinic-admin/marketing/loyalty; this shows the rules in
   force and links there. */

export type LoyaltySettings = {
  redemption_rate: number;
  is_active: boolean;
  points_per_omr?: number;
  min_redeem_points?: number;
  max_redeem_pct?: number;
  expiry_months?: number;
} | null;

export type Campaign = {
  id: string;
  name: string;
  status: string;
  total_recipients: number | null;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type NotifTemplate = {
  id: string;
  name: string;
  template_type: string;
  channel: string;
  is_active: boolean;
};

type Tab = "loyalty" | "campaigns" | "templates";

const CAMPAIGN_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: "مسودة",    color: "#71717a" },
  scheduled: { label: "مجدول",    color: "#a1a1aa" },
  running:   { label: "يُرسَل",   color: "#2dd4bf" },
  completed: { label: "مكتمل",    color: "#5dd9cb" },
  cancelled: { label: "ملغي",     color: "#fda4b4" },
};

export function LoyaltyCenter({
  loyaltySettings,
  campaigns,
  templates,
}: {
  loyaltySettings: LoyaltySettings;
  campaigns: Campaign[];
  templates: NotifTemplate[];
}) {
  const [tab, setTab] = useState<Tab>("loyalty");

  // the rules in force, with the engine's own fallbacks so an unconfigured
  // clinic sees the behaviour it will actually get
  const rules = {
    is_active: loyaltySettings?.is_active ?? true,
    points_per_omr: Number(loyaltySettings?.points_per_omr ?? 1),
    redemption_rate: Number(loyaltySettings?.redemption_rate ?? 0.03),
    min_redeem_points: Number(loyaltySettings?.min_redeem_points ?? 100),
    max_redeem_pct: Number(loyaltySettings?.max_redeem_pct ?? 30),
    expiry_months: Number(loyaltySettings?.expiry_months ?? 6),
  };

  const runningCampaigns = campaigns.filter((c) => c.status === "running").length;

  const tabs: Array<{ id: Tab; label: string; badge?: number; Icon: ElementType }> = [
    { id: "loyalty",   label: "الولاء",    Icon: Star },
    { id: "campaigns", label: "الحملات",   badge: runningCampaigns, Icon: Radio },
    { id: "templates", label: "القوالب",   badge: templates.length, Icon: MessageSquare },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        minHeight: 420,
      }}
    >
      {/* ── tab bar ── */}
      <div
        className="flex shrink-0"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 relative flex items-center justify-center gap-1.5 py-3 text-[11px] font-semibold"
            style={{
              color: tab === t.id ? "#5dd9cb" : "var(--text-4)",
              transition: "color 0.15s",
            }}
          >
            <t.Icon className="w-3 h-3" />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full ltr-nums"
                style={{
                  background: "rgba(20,184,166,0.18)",
                  color: "#5dd9cb",
                }}
              >
                {t.badge}
              </span>
            )}
            {tab === t.id && (
              <span
                className="absolute bottom-0 inset-x-0 h-[2px] rounded-full"
                style={{ background: "#14b8a6" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* ════ LOYALTY ════ */}
        {tab === "loyalty" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                  قواعد نقاط الولاء
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: rules.is_active ? "rgba(45,212,191,0.08)" : "rgba(107,114,128,0.08)",
                    color: rules.is_active ? "#5dd9cb" : "#6B7280",
                    border: `1px solid ${rules.is_active ? "rgba(45,212,191,0.18)" : "rgba(107,114,128,0.18)"}`,
                  }}
                >
                  {rules.is_active ? "نشط" : "معطّل"}
                </span>
              </div>
              <Link
                href="/clinic-admin/marketing/loyalty"
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{
                  background: "rgba(20,184,166,0.08)",
                  color: "#5dd9cb",
                  border: "1px solid rgba(20,184,166,0.18)",
                }}
              >
                <Settings2 className="w-3 h-3" /> تعديل
              </Link>
            </div>

            <div className="space-y-2">
              {[
                { label: "الكسب", value: `${rules.points_per_omr} نقطة / 1 ر.ع` },
                { label: "قيمة النقطة", value: `${rules.redemption_rate.toFixed(3)} ر.ع` },
                { label: "الاستبدال", value: `من ${rules.min_redeem_points} نقطة · حتى ${rules.max_redeem_pct}٪ من الفاتورة` },
                { label: "الصلاحية", value: `${rules.expiry_months} أشهر بلا نشاط` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>{stat.label}</span>
                  <span className="text-sm font-bold ltr-nums text-white">{stat.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ CAMPAIGNS ════ */}
        {tab === "campaigns" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                {campaigns.length} حملة إجمالاً
              </p>
              <Link
                href="/clinic-admin/marketing/campaigns"
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: "#14b8a6" }}
              >
                إدارة الحملات <ChevronLeft className="w-3 h-3" />
              </Link>
            </div>

            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <Radio className="w-7 h-7" style={{ color: "rgba(255,255,255,0.08)" }} />
                <p className="text-xs" style={{ color: "var(--text-4)" }}>
                  لا توجد حملات مسجّلة
                </p>
              </div>
            ) : (
              campaigns.slice(0, 6).map((c) => {
                const st  = CAMPAIGN_STATUS[c.status] ?? { label: c.status, color: "#6B7280" };
                const pct =
                  c.total_recipients && c.total_recipients > 0
                    ? Math.round((c.sent_count / c.total_recipients) * 100)
                    : 0;

                return (
                  <div
                    key={c.id}
                    className="rounded-xl p-3"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs font-bold text-white leading-snug">
                        {c.name}
                      </p>
                      <span
                        className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${st.color}14`, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>

                    {c.total_recipients != null && c.total_recipients > 0 && (
                      <>
                        <div
                          className="flex justify-between text-[10px] mb-1"
                          style={{ color: "var(--text-4)" }}
                        >
                          <span className="ltr-nums">
                            {c.sent_count} / {c.total_recipients} رسالة
                          </span>
                          <span className="font-bold ltr-nums" style={{ color: st.color }}>
                            {pct}%
                          </span>
                        </div>
                        <div
                          className="h-1 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background:
                                c.status === "running"
                                  ? `linear-gradient(90deg, ${st.color}80, ${st.color})`
                                  : st.color,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                        {c.failed_count > 0 && (
                          <p className="text-[10px] mt-1" style={{ color: "#F87171" }}>
                            فشل: {c.failed_count}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ════ TEMPLATES ════ */}
        {tab === "templates" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                {templates.length} قالب نشط
              </p>
              <Link
                href="/clinic-admin/marketing/templates"
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: "#14b8a6" }}
              >
                إدارة القوالب <ChevronLeft className="w-3 h-3" />
              </Link>
            </div>

            {templates.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <MessageSquare
                  className="w-7 h-7"
                  style={{ color: "rgba(255,255,255,0.08)" }}
                />
                <p className="text-xs" style={{ color: "var(--text-4)" }}>
                  لا توجد قوالب رسائل
                </p>
              </div>
            ) : (
              templates.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: t.is_active ? "#5dd9cb" : "var(--text-4)" }}
                  />
                  <p
                    className="text-xs font-semibold text-white flex-1 truncate"
                  >
                    {t.name}
                  </p>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-3)" }}
                  >
                    {t.channel}
                  </span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
