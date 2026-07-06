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
  allRoles?: Role[];
  userName: string;
  clinicName?: string;
}

export function AppSidebar({ role, allRoles, userName, clinicName }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  /* one account may hold several roles (front-desk PC = reception + accounting):
     the nav is the union of its roles' menus */
  const roles = [...new Set([role, ...(allRoles ?? [])])];
  const seen = new Set<string>();
  const navItems = roles.flatMap((r) => NAV_ITEMS[r] ?? []).filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

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
        background: "#0c0c0d",
        borderInlineStart: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Brand ── */}
      <div
        className="flex items-center gap-3 px-4 h-[68px] shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <TawdLogoMark className="w-[24px] h-[24px]" />
        </div>

        <div className="min-w-0">
          <div
            className="font-bold leading-none text-white"
            style={{ fontSize: 19, letterSpacing: "-0.02em" }}
          >
            طود
          </div>
          {clinicName ? (
            <div
              className="text-[10.5px] mt-[3px] truncate max-w-[130px] font-medium"
              style={{ color: "var(--text-3)" }}
            >
              {clinicName}
            </div>
          ) : (
            <div
              className="text-[9px] mt-[3px] font-bold tracking-[0.18em] uppercase"
              style={{ color: "var(--text-4)" }}
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
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-all duration-150 group",
                  isActive
                    ? "text-white font-semibold"
                    : "font-medium hover:text-white"
                )}
                style={
                  isActive
                    ? { background: "rgba(255,255,255,0.07)" }
                    : { color: "var(--text-3)" }
                }
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.035)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                {/* active signal: thin accent bar on the reading edge */}
                {isActive && (
                  <span
                    className="absolute inset-y-2 start-0 w-[3px] rounded-full"
                    style={{
                      background: "var(--accent-1)",
                      boxShadow: "0 0 8px rgba(45,212,191,0.6)",
                    }}
                  />
                )}
                <item.icon
                  className="w-[17px] h-[17px] shrink-0 transition-colors"
                  style={{ color: isActive ? "#ffffff" : undefined }}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ltr-nums"
                    style={{ background: "rgba(45,212,191,0.14)", color: "#5dd9cb" }}
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
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#ffffff",
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[13px] font-semibold truncate">{userName}</div>
            <div className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
              {roles.map((r) => ROLE_LABELS[r]).join(" + ")}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs w-full py-1.5 px-2 rounded-lg transition-all"
          style={{ color: "var(--text-4)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#fda4b4";
            e.currentTarget.style.background = "rgba(244,63,94,0.07)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-4)";
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
