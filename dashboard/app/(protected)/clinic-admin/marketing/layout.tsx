"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, Radio, MessageSquare, Megaphone } from "lucide-react";

const TABS = [
  { href: "/clinic-admin/marketing/loyalty",   label: "الولاء",   Icon: Star          },
  { href: "/clinic-admin/marketing/campaigns", label: "الحملات",  Icon: Radio         },
  { href: "/clinic-admin/marketing/templates", label: "القوالب",  Icon: MessageSquare },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page header ── */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(20,184,166,0.06) 0%, rgba(13,13,15,0.95) 100%)",
          border: "1px solid rgba(20,184,166,0.1)",
          padding: "1.5rem 2rem",
        }}
      >
        {/* ambient glow */}
        <div className="absolute pointer-events-none" style={{ width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.05) 0%, transparent 65%)", top: -150, insetInlineEnd: -80 }} />

        <div className="relative flex items-center justify-between flex-wrap gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(20,184,166,0.2), rgba(13,148,136,0.1))",
                border: "1px solid rgba(20,184,166,0.25)",
                boxShadow: "0 0 20px rgba(20,184,166,0.1)",
              }}
            >
              <Megaphone className="w-5 h-5" style={{ color: "#14b8a6" }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight leading-none">
                التسويق والولاء
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(148,163,184,0.4)" }}>
                الحملات · قوالب الرسائل · نظام نقاط الولاء
              </p>
            </div>
          </div>

          {/* Tab bar — glass pill */}
          <div
            className="flex items-center p-1 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)",
            }}
          >
            {TABS.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={
                    active
                      ? {
                          background: "linear-gradient(135deg, rgba(20,184,166,0.18), rgba(20,184,166,0.08))",
                          color: "#5dd9cb",
                          border: "1px solid rgba(20,184,166,0.2)",
                          boxShadow: "0 0 16px rgba(20,184,166,0.08)",
                        }
                      : {
                          color: "rgba(148,163,184,0.5)",
                          border: "1px solid transparent",
                        }
                  }
                  onMouseEnter={(e: any) => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                  onMouseLeave={(e: any) => { if (!active) e.currentTarget.style.color = "rgba(148,163,184,0.5)"; }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
