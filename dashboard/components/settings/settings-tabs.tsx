"use client";

import { useState, type ReactNode } from "react";
import { Building2, Receipt, Share2, ShieldCheck } from "lucide-react";

/* Settings was one long scroll of six unrelated forms — clinic details, opening
   hours, a VAT number, two links and a security notice — with no way to tell
   where one ended and the next began.

   The tabs are client-side rather than routes because every section is fed by
   the same single page query. Sub-routes would have meant re-fetching the same
   four tables on each tab for no benefit. Sections are only mounted when
   selected, so nothing hidden is doing work. */

type TabId = "clinic" | "billing" | "channels" | "security";

const TABS: { id: TabId; label: string; Icon: typeof Building2 }[] = [
  { id: "clinic",   label: "العيادة",        Icon: Building2 },
  { id: "billing",  label: "الفوترة والباقة", Icon: Receipt },
  { id: "channels", label: "الروابط والقنوات", Icon: Share2 },
  { id: "security", label: "الأمان",          Icon: ShieldCheck },
];

export function SettingsTabs({
  clinic, billing, channels, security,
}: Record<TabId, ReactNode>) {
  const [tab, setTab] = useState<TabId>("clinic");
  const panes: Record<TabId, ReactNode> = { clinic, billing, channels, security };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-1.5 shrink-0 text-[12.5px] font-bold px-3.5 py-2 rounded-xl transition-colors"
              style={{
                background: active ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${active ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                color: active ? "var(--accent-1)" : "var(--text-3)",
              }}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-5">{panes[tab]}</div>
    </div>
  );
}
