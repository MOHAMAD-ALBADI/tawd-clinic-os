import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import type { ModuleDef } from "@/lib/modules";

/** What a clinic sees when it opens a module its contract does not include.

    Deliberately not a 404 and deliberately not a deletion. Nothing the clinic
    entered is touched — turning the module back on restores the screen exactly
    as it was. The page names what is missing and who to ask, because "غير
    مصرح" leaves a manager guessing whether the system is broken. */
export function ModuleLocked({ module, homeHref }: { module: ModuleDef; homeHref: string }) {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 560 }}>
      <div className="panel" style={{ padding: "2rem" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)" }}>
          <Lock className="w-5 h-5" style={{ color: "#fbbf24" }} />
        </div>

        <h1 className="text-xl font-black text-white mb-1.5">{module.label}</h1>
        <p className="text-[13px] mb-5" style={{ color: "var(--text-2)" }}>{module.blurb}</p>

        <div className="rounded-xl px-4 py-3 mb-5"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            هذه الخدمة غير مشمولة في اشتراك عيادتكم الحالي. لإضافتها تواصلوا مع فريق طود —
            تُفعَّل خلال دقائق وتظهر بياناتكم كما هي.
          </p>
        </div>

        <Link href={homeHref} className="btn-ghost">
          <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة التحكم
        </Link>
      </div>
    </div>
  );
}
