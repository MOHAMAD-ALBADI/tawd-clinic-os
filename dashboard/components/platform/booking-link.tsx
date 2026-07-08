"use client";

import { useState } from "react";
import { Link2, Copy, ExternalLink, CheckCircle2 } from "lucide-react";

/** Shareable public booking link for a clinic. */
export function BookingLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://tawd-clinic-os.vercel.app/book/${slug}`;

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
        <Link2 className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        رابط الحجز العام
      </h3>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
        شاركه مع العيادة — يضعونه في بايو إنستقرام / قوقل / واتساب فيحجز المرضى بأنفسهم
      </p>
      <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="text-[12px] ltr-nums flex-1 truncate" dir="ltr" style={{ color: "var(--text-2)" }}>/book/{slug}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="btn-ghost flex-1">
          {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> نُسخ</> : <><Copy className="w-3.5 h-3.5" /> نسخ الرابط</>}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="btn-primary flex-1">
          <ExternalLink className="w-3.5 h-3.5" /> معاينة
        </a>
      </div>
    </div>
  );
}
