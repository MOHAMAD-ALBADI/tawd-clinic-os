"use client";

import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid, CalendarDays, Users, Receipt, Scissors, BarChart3, Settings,
  LifeBuoy, LogOut, Menu, X, Wallet, UserPlus, CheckCircle2, Clock, Sparkles,
} from "lucide-react";
import { useSite } from "@/components/site/lang";
import { ObjLayers, ObjShield, ObjCards } from "@/components/site/objects";

/* The product panel in the hero.

   Built in HTML rather than dropped in as a screenshot. A capture of the real
   dashboard is honest but it is also 1440px of dark UI scaled into a small
   frame, which is why it kept reading as muddy — the type falls below legible
   size and the whole thing turns to texture. This is composed at the size it is
   actually shown, so every figure stays sharp, it reflows on a phone instead of
   becoming a postage stamp, and it costs a few kilobytes instead of 100.

   The figures are the demo clinic's real ones, so the panel and the statistics
   further down the page agree. */

const COPY = {
  ar: {
    win: "لوحة التحكم — عيادة طَود",
    nav: ["الرئيسية", "المواعيد", "المرضى", "الفواتير", "الخدمات", "التقارير", "الإعدادات"],
    navSub: "الإدارة",
    help: "مركز المساعدة",
    out: "تسجيل الخروج",
    kpis: [
      { l: "مواعيد اليوم", v: "١٥", d: "+١٢٪", i: CalendarDays },
      { l: "مرضى جدد", v: "٨", d: "+٦٪", i: UserPlus },
      { l: "إيراد الشهر", v: "٧٬٥٨٢", d: "+١٥٪", i: Wallet },
      { l: "نسبة التحصيل", v: "٨٥٫٦٪", d: "+٥٪", i: CheckCircle2 },
    ],
    apptsT: "المواعيد القادمة",
    appts: [
      { n: "أحمد بن سيف الريامي", t: "٠٩:٠٠", s: "مؤكّد" },
      { n: "فاطمة بنت محمد العامرية", t: "٠٩:٣٥", s: "مؤكّد" },
      { n: "سلطان بن علي الحبسي", t: "١٠:١٠", s: "مؤكّد" },
      { n: "عائشة بنت خميس الزدجالية", t: "١٠:٤٥", s: "مؤكّد" },
    ],
    revT: "الإيراد",
    revV: "٧٬٥٨٢ ر.ع",
    svcT: "توزيع الخدمات",
    svc: [
      { l: "كشف", v: "٤٦٪", c: "#4f8bff" },
      { l: "تنظيف", v: "٢٤٪", c: "#2563eb" },
      { l: "حشوات", v: "١٨٪", c: "#1341b8" },
      { l: "أخرى", v: "١٢٪", c: "#25406f" },
    ],
    suraN: "سُرى",
    suraB: "المساعد الذكي لإدارة العيادة. كيف يمكنني مساعدتك اليوم؟",
    suraC: "ابدأ محادثة",
    close: "إغلاق",
  },
  en: {
    win: "Dashboard — TAWD Clinic",
    nav: ["Home", "Appointments", "Patients", "Invoices", "Services", "Reports", "Settings"],
    navSub: "Manage",
    help: "Help centre",
    out: "Sign out",
    kpis: [
      { l: "Today", v: "15", d: "+12%", i: CalendarDays },
      { l: "New patients", v: "8", d: "+6%", i: UserPlus },
      { l: "Revenue", v: "7,582", d: "+15%", i: Wallet },
      { l: "Collection", v: "85.6%", d: "+5%", i: CheckCircle2 },
    ],
    apptsT: "Upcoming",
    appts: [
      { n: "Ahmed Al Riyami", t: "09:00", s: "Confirmed" },
      { n: "Fatma Al Amri", t: "09:35", s: "Confirmed" },
      { n: "Sultan Al Habsi", t: "10:10", s: "Confirmed" },
      { n: "Aisha Al Zadjali", t: "10:45", s: "Confirmed" },
    ],
    revT: "Revenue",
    revV: "OMR 7,582",
    svcT: "Service mix",
    svc: [
      { l: "Exam", v: "46%", c: "#4f8bff" },
      { l: "Cleaning", v: "24%", c: "#2563eb" },
      { l: "Fillings", v: "18%", c: "#1341b8" },
      { l: "Other", v: "12%", c: "#25406f" },
    ],
    suraN: "Sura",
    suraB: "The clinic's AI assistant. How can I help you today?",
    suraC: "Start a chat",
    close: "Close",
  },
} as const;

const NAV_ICONS = [LayoutGrid, CalendarDays, Users, Receipt, Scissors, BarChart3, Settings];

/* A month of revenue, rising. Drawn rather than charted: a chart library for a
   decorative sparkline is 40kb to render twelve points. */
function Spark() {
  const pts = [10, 16, 13, 22, 19, 28, 25, 34, 31, 42, 46, 58];
  const w = 240, h = 62, max = 62;
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - (p / max) * (h - 8) - 4}`).join(" L ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f8bff" stopOpacity=".38" />
          <stop offset="1" stopColor="#4f8bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M ${d} L ${w},${h} L 0,${h} Z`} fill="url(#sp)" />
      <path d={`M ${d}`} fill="none" stroke="#4f8bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - (58 / max) * (h - 8) - 4} r="3.2" fill="#fff" />
    </svg>
  );
}

function Donut() {
  const segs = [[46, "#4f8bff"], [24, "#2563eb"], [18, "#1341b8"], [12, "#25406f"]] as const;
  const C = 2 * Math.PI * 26;
  let acc = 0;
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden>
      {segs.map(([pct, col]) => {
        const dash = (pct / 100) * C;
        const el = (
          <circle key={col} cx="36" cy="36" r="26" fill="none" stroke={col} strokeWidth="10"
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc}
            transform="rotate(-90 36 36)" />
        );
        acc += dash;
        return el;
      })}
      <text x="36" y="40" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">46%</text>
    </svg>
  );
}

export function ProductPanel() {
  const { lang } = useSite();
  const c = COPY[lang];
  const stage = useRef<HTMLDivElement | null>(null);
  const [showSura, setShowSura] = useState(true);

  /* The panel turns toward the pointer, and the objects around it move further
     than the panel does — that mismatch is what reads as depth.

     The properties are written to the stage rather than the panel, because
     custom properties inherit: one write drives the console and all three
     orbiting shapes. No React state, so moving the mouse does not re-render
     the tree sixty times a second. */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let queued = false, mx = 0, my = 0;
    const write = () => {
      queued = false;
      el.style.setProperty("--mx", String(mx));
      el.style.setProperty("--my", String(my));
    };
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * -2;
      if (!queued) { queued = true; requestAnimationFrame(write); }
    };
    const leave = () => { mx = 0; my = 0; write(); };
    el.addEventListener("mousemove", move, { passive: true });
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mousemove", move); el.removeEventListener("mouseleave", leave); };
  }, []);

  return (
    <div className="stage" ref={stage}>
      <span className="stage__glow" aria-hidden />

      {/* Three objects orbiting the console at different depths. They drift on
          their own and lag the pointer by different amounts, which is what
          sells the panel as an object in space rather than a picture of one.
          aria-hidden throughout — decoration, nothing to announce. */}
      <span className="orb orb--1" aria-hidden><ObjLayers /></span>
      <span className="orb orb--2" aria-hidden><ObjShield /></span>
      <span className="orb orb--3" aria-hidden><ObjCards /></span>

      <div className="panel">
        <span className="panel__sheen" aria-hidden />
        <div className="panel__top">
          <Menu size={13} />
          {c.win}
          <span className="panel__live">
            <i /> {lang === "ar" ? "مباشر" : "Live"}
          </span>
        </div>

        <div className="panel__body">
          <nav className="panel__side">
            {c.nav.map((n, i) => {
              const I = NAV_ICONS[i];
              return (
                <a key={n} href="#" data-on={i === 0} onClick={(e) => e.preventDefault()}>
                  <I size={13} /> {n}
                </a>
              );
            })}
            <b>{c.navSub}</b>
            <a href="#" onClick={(e) => e.preventDefault()}><LifeBuoy size={13} /> {c.help}</a>
            <a href="#" onClick={(e) => e.preventDefault()}><LogOut size={13} /> {c.out}</a>
          </nav>

          <div className="panel__main">
            {/* Tiles and rows arrive in sequence rather than all at once. The
                console should look like it is loading real data, because that
                is the claim the panel is making. */}
            <div className="kpis">
              {c.kpis.map((k, i) => (
                <div key={k.l} className="kpi kpi--in" style={{ animationDelay: `${0.35 + i * 0.09}s` }}>
                  <div className="kpi__t">{k.l} <k.i size={12} /></div>
                  <div className="kpi__v">{k.v}</div>
                  <div className="kpi__d">{k.d}</div>
                </div>
              ))}
            </div>

            <div className="duo">
              <div className="box">
                <div className="box__h">{c.apptsT} <Clock size={12} /></div>
                {c.appts.map((a, i) => (
                  <div key={a.n} className="appt appt--in" style={{ animationDelay: `${0.75 + i * 0.1}s` }}>
                    <span className="appt__av" />
                    <span className="appt__n">{a.n}</span>
                    <span className="tag">{a.s}</span>
                    <span className="appt__t">{a.t}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: "0.7rem" }}>
                <div className="box">
                  <div className="box__h"><b className="mono">{c.revV}</b> {c.revT}</div>
                  <Spark />
                </div>
                <div className="box">
                  <div className="box__h">{c.svcT}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                    <Donut />
                    <div className="leg">
                      {c.svc.map((s) => (
                        <span key={s.l}><i style={{ background: s.c }} />{s.l} {s.v}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSura && (
        <div className="sura">
          <div className="sura__h">
            <span className="sura__ic"><Sparkles size={17} /></span>
            <span className="sura__n">{c.suraN}</span>
            <button className="sura__x" onClick={() => setShowSura(false)} aria-label={c.close}>
              <X size={14} />
            </button>
          </div>
          <p className="sura__b">{c.suraB}</p>
          <button className="sura__cta">{c.suraC}</button>
        </div>
      )}
    </div>
  );
}
