"use client";

import { useState, useTransition } from "react";
import { Mail, AtSign, Check, AlertTriangle } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { sendEnquiry } from "@/app/actions/site-contact";

export default function ContactPage() {
  const { t } = useSite();
  const c = t.contact;

  const [f, setF] = useState({ name: "", clinic: "", phone: "", email: "", message: "" });
  const [state, setState] = useState<"idle" | "sent" | "failed" | "invalid">("idle");
  const [busy, start] = useTransition();

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2 || f.phone.trim().length < 6 || f.message.trim().length < 5) {
      setState("invalid");
      return;
    }
    setState("idle");
    start(async () => {
      try {
        const r = await sendEnquiry(f);
        setState(r.ok ? "sent" : "failed");
      } catch {
        setState("failed");
      }
    });
  }

  return (
    <section className="s-section" style={{ position: "relative" }}>
      <span className="s-bloom" aria-hidden />
      <div className="s-wrap" style={{ position: "relative", zIndex: 1 }}>
        <span className="s-eyebrow">{c.eyebrow}</span>
        <h1 className="s-h2" style={{ fontSize: "clamp(2rem, 5.5vw, 3.2rem)" }}>{c.title}</h1>
        <p className="s-lede" style={{ marginBottom: "2.8rem" }}>{c.lede}</p>

        <div className="s-grid s-grid--2" style={{ alignItems: "start", gap: "2.5rem" }}>
          {state === "sent" ? (
            <div className="s-card" style={{ padding: "2.4rem", borderColor: "rgba(52,211,153,0.3)" }}>
              <p style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "var(--s-confirm)", fontWeight: 700 }}>
                <Check size={18} /> {c.sent}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "grid", gap: "1rem" }} noValidate>
              <div className="s-grid s-grid--2" style={{ gap: "1rem" }}>
                <div className="s-field">
                  <label htmlFor="cn">{c.nameL} *</label>
                  <input id="cn" className="s-input" value={f.name} onChange={set("name")} required />
                </div>
                <div className="s-field">
                  <label htmlFor="cc">{c.clinicL}</label>
                  <input id="cc" className="s-input" value={f.clinic} onChange={set("clinic")} />
                </div>
              </div>

              <div className="s-grid s-grid--2" style={{ gap: "1rem" }}>
                <div className="s-field">
                  <label htmlFor="cp">{c.phoneL} *</label>
                  <input id="cp" className="s-input s-num" dir="ltr" inputMode="tel"
                    value={f.phone} onChange={set("phone")} required />
                </div>
                <div className="s-field">
                  <label htmlFor="ce">{c.emailL}</label>
                  <input id="ce" className="s-input" dir="ltr" type="email"
                    value={f.email} onChange={set("email")} />
                </div>
              </div>

              <div className="s-field">
                <label htmlFor="cm">{c.msgL} *</label>
                <textarea id="cm" className="s-textarea" value={f.message} onChange={set("message")}
                  placeholder={c.msgPlaceholder} required />
              </div>

              {(state === "invalid" || state === "failed") && (
                <p style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.85rem", color: "#fda4b4" }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  {state === "invalid" ? c.required : c.failed}
                </p>
              )}

              <button type="submit" className="s-btn s-btn--primary" disabled={busy} style={{ justifySelf: "start" }}>
                {busy ? c.sending : c.send}
              </button>
            </form>
          )}

          <div className="s-card" style={{ padding: "1.8rem" }}>
            <p className="s-foot__h">{c.directTitle}</p>
            <div style={{ display: "grid", gap: "1rem", marginTop: "0.4rem" }}>
              <a href={`mailto:${c.emailV}`} style={{ display: "flex", gap: "0.7rem", alignItems: "center", fontSize: "0.9rem", color: "var(--s-text-2)" }}>
                <Mail size={16} style={{ color: "var(--s-blue-lit)" }} />
                <span dir="ltr">{c.emailV}</span>
              </a>
              <a href={`https://instagram.com/${c.instaV}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", gap: "0.7rem", alignItems: "center", fontSize: "0.9rem", color: "var(--s-text-2)" }}>
                <AtSign size={16} style={{ color: "var(--s-blue-lit)" }} />
                <span dir="ltr">{c.instaV}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
