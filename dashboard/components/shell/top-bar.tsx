"use client";

import { Bell, X, AlertTriangle, Info, CheckCircle2, ChevronLeft, Menu } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { GlobalSearch } from "./global-search";
import { useNav } from "./nav-state";

interface TopBarProps {
  title?: string;
  searchPlaceholder?: string;
}

type NotifItem = {
  id: string;
  title: string;
  sub?: string;
  href: string;
  severity: "bad" | "warn" | "info";
};

const SEV: Record<string, { color: string; Icon: typeof Info }> = {
  bad:  { color: "#fda4b4", Icon: AlertTriangle },
  warn: { color: "#fcd34d", Icon: AlertTriangle },
  info: { color: "var(--accent-1)", Icon: Info },
};

export function TopBar({ title, searchPlaceholder }: TopBarProps) {
  const { setOpen: setNavOpen } = useNav();
  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[] | null>(null);
  const [count, setCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setItems(j.items ?? []);
      setCount(j.count ?? 0);
    } catch { /* silent */ }
  }, []);

  /* badge count on mount + refresh every 90s */
  useEffect(() => {
    load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  return (
    <header
      className="h-14 flex items-center px-5 gap-4 sticky top-0 z-30"
      style={{
        background: "rgba(10,10,11,0.9)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* The only way into the menu on a phone. Forty-four square, which
          is the smallest target a thumb finds reliably. */}
      <button
        onClick={() => setNavOpen(true)}
        className="lg:hidden -ms-1.5 w-11 h-11 shrink-0 rounded-xl flex items-center justify-center"
        style={{ color: "var(--text-2)" }}
        aria-label="فتح القائمة"
      >
        <Menu className="w-5 h-5" />
      </button>

      {title ? (
        <h1 className="text-base font-semibold flex-1 truncate text-white">{title}</h1>
      ) : (
        <span className="flex-1" />
      )}

      <GlobalSearch placeholder={searchPlaceholder} />

      {/* live notifications */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) load(); }}
          className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{
            color: notifOpen ? "#ffffff" : "var(--text-3)",
            background: notifOpen ? "rgba(255,255,255,0.07)" : "transparent",
          }}
          aria-label="الإشعارات"
        >
          <Bell className="w-[17px] h-[17px]" />
          {count > 0 && (
            <span
              className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold ltr-nums"
              style={{ background: "#f43f5e", color: "#fff" }}
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>

        {notifOpen && (
          /* Anchored to the bell rather than to a coordinate.
           *
           * It used to be fixed at left: 17rem — the desktop gap beside
           * the sidebar — which put it off-screen on a phone. Making it
           * responsive with start-* was worse: `start` under dir=rtl is
           * the RIGHT edge, and the bell sits on the left, so the panel
           * opened across the page away from the button that opened it.
           *
           * A popover belongs to its trigger. end-0 aligns it with the
           * bell (left, in Arabic) and it grows inward from there, so it
           * is correct at every width without naming one. */
          <div
            className="absolute top-full mt-2 end-0 rounded-2xl overflow-hidden"
            style={{
              width: "min(340px, calc(100vw - 1.5rem))",
              zIndex: 60,
              background: "#0e0e10",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.9)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
                <span className="text-sm font-bold text-white">الإشعارات</span>
                <span className="flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold badge-brand">
                  <span className="live-dot" style={{ width: 4, height: 4 }} />
                  حيّة
                </span>
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-4)" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2.5 max-h-[380px] overflow-y-auto">
              {items === null ? (
                <p className="text-[12px] text-center py-6" style={{ color: "var(--text-4)" }}>جارٍ التحميل…</p>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <CheckCircle2 className="w-7 h-7" style={{ color: "rgb(var(--accent-1-rgb) / 0.5)" }} />
                  <p className="text-[12px] font-semibold" style={{ color: "var(--accent-1)" }}>كل شيء تحت السيطرة</p>
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>لا يوجد ما يحتاج انتباهك الآن</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((n) => {
                    const s = SEV[n.severity] ?? SEV.info;
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
                        style={{ background: "rgba(255,255,255,0.02)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      >
                        <s.Icon className="w-4 h-4 shrink-0" style={{ color: s.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-white leading-snug">{n.title}</p>
                          {n.sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>{n.sub}</p>}
                        </div>
                        <ChevronLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "var(--accent-1)" }} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
