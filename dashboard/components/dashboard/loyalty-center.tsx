"use client";

import { useState, useTransition, type ElementType } from "react";
import { useRouter } from "next/navigation";
import { Star, Radio, MessageSquare, Settings2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { updateLoyaltySettings } from "@/app/actions/loyalty";

export type LoyaltySettings = {
  points_per_visit: number;
  points_per_referral: number;
  redemption_rate: number;
  is_active: boolean;
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
  running:   { label: "يُرسَل",   color: "#7dd3fc" },
  completed: { label: "مكتمل",    color: "#6ee7b7" },
  cancelled: { label: "ملغي",     color: "#fda4b4" },
};

const INPUT: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(226,232,240,0.9)",
  borderRadius: "0.625rem",
  padding: "0.5rem 0.75rem",
  fontSize: "13px",
  outline: "none",
  width: "100%",
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
  const router            = useRouter();
  const [tab, setTab]     = useState<Tab>("loyalty");
  const [editing, setEditing] = useState(false);
  const [saving, startSave]   = useTransition();
  const [form, setForm]   = useState({
    points_per_visit:    loyaltySettings?.points_per_visit    ?? 10,
    points_per_referral: loyaltySettings?.points_per_referral ?? 50,
    redemption_rate:     loyaltySettings?.redemption_rate     ?? 0.1,
    is_active:           loyaltySettings?.is_active           ?? true,
  });

  function handleSave() {
    startSave(async () => {
      try {
        await updateLoyaltySettings({
          points_per_visit:    Number(form.points_per_visit),
          points_per_referral: Number(form.points_per_referral),
          redemption_rate:     Number(form.redemption_rate),
          is_active:           form.is_active,
        });
        setEditing(false);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

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
                  نقاط الولاء والإحالة
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: form.is_active
                      ? "rgba(74,222,128,0.08)"
                      : "rgba(107,114,128,0.08)",
                    color: form.is_active ? "#4ADE80" : "#6B7280",
                    border: `1px solid ${
                      form.is_active
                        ? "rgba(74,222,128,0.18)"
                        : "rgba(107,114,128,0.18)"
                    }`,
                  }}
                >
                  {form.is_active ? "نشط" : "معطّل"}
                </span>
              </div>
              <button
                onClick={() => setEditing(!editing)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{
                  background: "rgba(20,184,166,0.08)",
                  color: "#5dd9cb",
                  border: "1px solid rgba(20,184,166,0.18)",
                }}
              >
                <Settings2 className="w-3 h-3" />
                {editing ? "إلغاء" : "تعديل"}
              </button>
            </div>

            {editing ? (
              <div className="space-y-3">
                {[
                  { key: "points_per_visit",    label: "نقاط لكل زيارة",           step: "1"     },
                  { key: "points_per_referral", label: "نقاط لكل إحالة",           step: "1"     },
                  { key: "redemption_rate",     label: "قيمة النقطة (ريال عُماني)", step: "0.001" },
                ].map((f) => (
                  <div key={f.key}>
                    <label
                      className="text-[11px] font-semibold block mb-1"
                      style={{ color: "var(--text-3)" }}
                    >
                      {f.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={f.step}
                      value={(form as Record<string, number>)[f.key]}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          [f.key]: parseFloat(e.target.value) || 0,
                        }))
                      }
                      style={{ ...INPUT, direction: "ltr", textAlign: "left" }}
                    />
                  </div>
                ))}

                <button
                  onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg w-full"
                  style={{
                    background: form.is_active
                      ? "rgba(74,222,128,0.06)"
                      : "rgba(107,114,128,0.06)",
                    color: form.is_active ? "#4ADE80" : "#6B7280",
                    border: `1px solid ${
                      form.is_active
                        ? "rgba(74,222,128,0.15)"
                        : "rgba(107,114,128,0.15)"
                    }`,
                  }}
                >
                  {form.is_active ? "✓ النظام نشط — انقر لتعطيله" : "○ النظام معطّل — انقر لتفعيله"}
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #0d9488, #0f766e)",
                    color: "white",
                  }}
                >
                  {saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "نقاط الزيارة", value: `${form.points_per_visit} نقطة` },
                  { label: "نقاط الإحالة", value: `${form.points_per_referral} نقطة` },
                  { label: "قيمة النقطة",  value: `${Number(form.redemption_rate).toFixed(3)} ر.ع` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>
                      {stat.label}
                    </span>
                    <span className="text-sm font-bold ltr-nums text-white">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                    style={{ background: t.is_active ? "#4ADE80" : "var(--text-4)" }}
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
