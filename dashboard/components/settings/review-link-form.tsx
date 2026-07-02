"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Save, CheckCircle2 } from "lucide-react";
import { updateReviewLink } from "@/app/actions/clinic-settings";

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(226,232,240,0.95)",
  borderRadius: "0.75rem",
  padding: "0.65rem 1rem",
  width: "100%",
  fontSize: "14px",
  outline: "none",
} as const;

export function ReviewLinkForm({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(currentUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setSaved(false);
    start(async () => {
      try {
        await updateReviewLink(url);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center gap-3 mb-1.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
          <Star className="w-4 h-4" style={{ color: "#fbbf24" }} />
        </div>
        <div>
          <p className="font-bold text-white">رابط تقييم قوقل</p>
          <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>
            سُرى ترسله للمريض بعد زيارته لطلب تقييم للعيادة على قوقل
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://g.page/r/your-clinic/review"
          style={inputStyle}
          className="flex-1"
        />
        <button
          onClick={save}
          disabled={pending || url === (currentUrl ?? "")}
          className="flex items-center justify-center gap-1.5 px-5 rounded-xl text-sm font-bold shrink-0 transition-all disabled:opacity-40"
          style={{ background: saved ? "rgba(34,197,94,0.15)" : "rgba(20,184,166,0.15)", border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "rgba(20,184,166,0.3)"}`, color: saved ? "#4ADE80" : "#5dd9cb", padding: "0.65rem 1.25rem" }}
        >
          {saved ? <><CheckCircle2 className="w-4 h-4" /> تم الحفظ</> : <><Save className="w-4 h-4" /> {pending ? "..." : "حفظ"}</>}
        </button>
      </div>
      {err && <p className="text-[11px] mt-2" style={{ color: "#F87171" }}>{err}</p>}
      <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "rgba(148,163,184,0.4)" }}>
        كيف تجيب الرابط: افتح ملف عيادتك على قوقل → «اطلب تقييمات» → انسخ الرابط، والصقه هنا.
      </p>
    </div>
  );
}
