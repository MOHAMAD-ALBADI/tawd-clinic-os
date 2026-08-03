"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";
import { TawdLogoMark } from "./tawd-logo";
import { ROLE_LABELS } from "@/lib/auth/role-redirect";
import { createClient } from "@/lib/supabase/client";
import { useNav } from "./nav-state";
import type { Role } from "@/types/tawd";

interface AppSidebarProps {
  role: Role;
  allRoles?: Role[];
  userName: string;
  clinicName?: string;
  avatarUrl?: string | null;
  /** Modules the clinic's contract includes. Undefined = do not filter, which is
      what the platform operator gets — they are not bound by a clinic's plan. */
  modules?: string[];
}

export function AppSidebar({ role, allRoles, userName, clinicName, avatarUrl, modules }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useNav();
  const supabase = createClient();

  /* one account may hold several roles (front-desk PC = reception + accounting):
     the nav is the union of its roles' menus */
  const roles = [...new Set([role, ...(allRoles ?? [])])];
  const seen = new Set<string>();
  /* `section` marks the START of a group and the items after it inherit the
     heading implicitly. Hiding an unsold module could therefore delete a heading
     its surviving neighbours still need, so the heading is resolved for every
     item first and re-derived after filtering. */
  let carried: string | undefined;
  const navItems = roles
    .flatMap((r) => NAV_ITEMS[r] ?? [])
    .map((item) => {
      if (item.section) carried = item.section;
      return { ...item, group: carried };
    })
    .filter((item) => {
      if (seen.has(item.href)) return false;
      // items tied to a module the clinic did not buy simply are not there
      if (item.module && modules && !modules.includes(item.module)) return false;
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
    <>
      {/* The page behind the drawer, dimmed and tappable to dismiss.
          Below lg only — on a desktop the sidebar is furniture, not a
          layer over the work. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ background: "rgba(0,0,0,0.6)" }}
      />

      <aside
        className={cn(
          "fixed inset-y-0 end-0 w-64 flex flex-col z-50",
          "transition-transform duration-250 ease-out lg:transition-none",
          /* Parked off-screen until asked for.
             `end-0` under dir=rtl resolves to the LEFT edge — measured,
             not assumed — and a CSS translate is not direction-aware.
             So the way out is negative X. Positive pushed the drawer
             into the middle of the page instead of off it. */
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
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
          {navItems.map((item, i) => {
            /* print a group heading the first time a section appears — keeps a long
               menu scannable; menus without sections stay flat */
            const heading =
              item.group && item.group !== navItems[i - 1]?.group ? item.group : null;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href + "/"));

            return (
              <div key={item.href}>
                {heading && (
                  <p
                    className="text-[9.5px] font-bold tracking-[0.16em] uppercase px-3 pt-4 pb-1.5"
                    style={{ color: "var(--text-4)" }}
                  >
                    {heading}
                  </p>
                )}
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
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
                      boxShadow: "0 0 8px rgb(var(--accent-1-rgb) / 0.6)",
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
                    style={{ background: "rgb(var(--accent-1-rgb) / 0.14)", color: "var(--accent-1)" }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── User footer ── */}
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* The whole identity block is the way into the profile — that is where
            people already look for their own account, so it needs no extra
            nav item. */}
        <Link
          href="/profile"
          className="flex items-center gap-3 mb-3 w-full rounded-xl p-1.5 -m-1.5 transition-colors"
          style={{ background: pathname === "/profile" ? "rgba(255,255,255,0.05)" : "transparent" }}
        >
          <div
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#ffffff",
            }}
          >
            {avatarUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : initial}
          </div>
          <div className="flex-1 min-w-0 text-start">
            <div className="text-white text-[13px] font-semibold truncate">{userName}</div>
            <div className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
              {roles.map((r) => ROLE_LABELS[r]).join(" + ")}
            </div>
          </div>
          <UserCog className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-4)" }} />
        </Link>
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
    </>
  );
}
