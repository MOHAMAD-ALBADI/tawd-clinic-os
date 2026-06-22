"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";
import { TawdLogoMark } from "./tawd-logo";
import { ROLE_LABELS } from "@/lib/auth/role-redirect";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/types/tawd";

interface AppSidebarProps {
  role: Role;
  userName: string;
  clinicName?: string;
}

export function AppSidebar({ role, userName, clinicName }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const navItems = NAV_ITEMS[role] ?? [];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = userName.charAt(0).toUpperCase();

  return (
    <aside
      className="fixed inset-y-0 end-0 w-64 flex flex-col z-40"
      style={{
        background: "linear-gradient(180deg, #070B14 0%, #090E1A 60%, #070B14 100%)",
        borderInlineStart: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-4 h-[68px] shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Logo mark container with hover interaction */}
        <div
          className="relative shrink-0"
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.transform = "scale(1.08)";
            el.style.boxShadow = "0 0 24px rgba(45,212,191,0.3), 0 0 48px rgba(45,212,191,0.1), inset 0 0 0 1px rgba(45,212,191,0.35)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.transform = "scale(1)";
            el.style.boxShadow = "0 0 12px rgba(45,212,191,0.1), inset 0 0 0 1px rgba(45,212,191,0.18)";
          }}
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(145deg, rgba(20,184,166,0.1) 0%, rgba(10,13,22,0.7) 100%)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 0 12px rgba(45,212,191,0.1), inset 0 0 0 1px rgba(45,212,191,0.18)",
            transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease",
            cursor: "default",
          }}
        >
          {/* Ambient inner glow disk */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 13,
              background: "radial-gradient(ellipse at 50% 20%, rgba(45,212,191,0.14) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <TawdLogoMark className="w-[26px] h-[28px] relative z-10" />
        </div>

        {/* Brand text */}
        <div className="min-w-0">
          <div
            className="font-black leading-none"
            style={{
              fontSize: 19,
              letterSpacing: "-0.04em",
              background: "linear-gradient(135deg, #cbf6ef 0%, #2dd4bf 40%, #0d9488 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            طود
          </div>
          {clinicName ? (
            <div
              className="text-[10.5px] mt-[3px] truncate max-w-[120px] font-medium"
              style={{ color: "rgba(148,163,184,0.35)", letterSpacing: "0.01em" }}
            >
              {clinicName}
            </div>
          ) : (
            <div
              className="text-[9px] mt-[3px] font-bold tracking-[0.14em] uppercase"
              style={{ color: "rgba(45,212,191,0.3)" }}
            >
              TAWD OS
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 group",
                  isActive
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-200"
                )}
                style={
                  isActive
                    ? {
                        background: "linear-gradient(135deg, rgba(20,184,166,0.16) 0%, rgba(20,184,166,0.05) 100%)",
                        border: "1px solid rgba(45,212,191,0.22)",
                        boxShadow: "0 2px 12px rgba(20,184,166,0.1)",
                      }
                    : {
                        border: "1px solid transparent",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <item.icon
                  className="w-[17px] h-[17px] shrink-0 transition-colors"
                  style={{ color: isActive ? "#2dd4bf" : undefined }}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "#2dd4bf", boxShadow: "0 0 6px #2dd4bf" }}
                  />
                )}
                {item.badge && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ltr-nums"
                    style={{ background: "rgba(45,212,191,0.15)", color: "#5dd9cb" }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── User footer ── */}
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
            style={{
              background: "linear-gradient(135deg, #14b8a6, #0d9488)",
              boxShadow: "0 0 12px rgba(20,184,166,0.3)",
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[13px] font-semibold truncate">{userName}</div>
            <div className="text-[11px]" style={{ color: "#4B5563" }}>
              {ROLE_LABELS[role]}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs w-full py-1.5 px-2 rounded-lg transition-all"
          style={{ color: "#4B5563" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#F87171";
            e.currentTarget.style.background = "rgba(239,68,68,0.07)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#4B5563";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
