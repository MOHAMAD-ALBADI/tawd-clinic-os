"use client";

import { Bell, Calendar, ArrowLeft, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { GlobalSearch } from "./global-search";

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
        background: "rgba(7,11,20,0.92)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(24px)",
      }}
    >
      {title ? (
        <h1 className="text-base font-semibold flex-1 truncate text-white">{title}</h1>
      ) : (
        <span className="flex-1" />
      )}

      {/* Quick search — wired to real data */}
      <GlobalSearch />

      {/* Notifications */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{
            color: notifOpen ? "#2dd4bf" : "rgba(148,163,184,0.5)",
            background: notifOpen ? "rgba(45,212,191,0.1)" : "transparent",
          }}
          onMouseEnter={(e) => { if (!notifOpen) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={(e) => { if (!notifOpen) e.currentTarget.style.background = "transparent"; }}
          aria-label="الإشعارات"
        >
          <Bell className="w-[17px] h-[17px]" />
          <span
            className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full"
            style={{ background: "#2dd4bf", boxShadow: "0 0 6px rgba(45,212,191,0.9)" }}
          />
        </button>

        {notifOpen && (
          <div
            className="fixed w-80 rounded-2xl overflow-hidden"
            style={{
              top: "3.75rem", left: "17rem", zIndex: 60,
              background: "rgba(8,6,3,0.97)",
              border: "1px solid rgba(45,212,191,0.12)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(45,212,191,0.06)",
              backdropFilter: "blur(24px)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: "1px solid rgba(45,212,191,0.08)" }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: "#2dd4bf" }} />
                <span className="text-sm font-bold text-white">الإشعارات</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(45,212,191,0.15)", color: "#5dd9cb" }}
                >
                  مباشر
                </span>
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ color: "rgba(148,163,184,0.4)" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-1.5">
              <p className="text-[11px] font-semibold px-2 mb-2" style={{ color: "rgba(148,163,184,0.35)" }}>
                الوصول السريع
              </p>
              {[
                { label: "مواعيد اليوم",    sub: "عرض جدول اليوم",     href: "/clinic-admin/appointments", color: "#2dd4bf" },
                { label: "إضافة موعد جديد", sub: "حجز موعد من الخدمات", href: "/clinic-admin/appointments", color: "#38bdf8" },
                { label: "الخدمات المفعّلة", sub: "إدارة الخدمات",       href: "/clinic-admin/services",     color: "#5dd9cb" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setNotifOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(45,212,191,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${item.color}18`, border: `1px solid ${item.color}28` }}
                  >
                    <Calendar className="w-3.5 h-3.5" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.45)" }}>{item.sub}</p>
                  </div>
                  <ArrowLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#2dd4bf" }} />
                </Link>
              ))}
            </div>

            <div
              className="px-4 py-3"
              style={{ borderTop: "1px solid rgba(45,212,191,0.06)", background: "rgba(45,212,191,0.02)" }}
            >
              <p className="text-[11px] text-center" style={{ color: "rgba(148,163,184,0.25)" }}>
                الإشعارات الآنية قيد التطوير
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
