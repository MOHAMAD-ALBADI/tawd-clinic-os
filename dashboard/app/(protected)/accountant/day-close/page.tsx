import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { DayCloseForm } from "@/components/accountant/day-close-form";
import { ArrowRight, History } from "lucide-react";

export const metadata = { title: "إغلاق اليوم — طود" };

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function DayClosePage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: pays }, { data: history }] = await Promise.all([
    sb.from("payments").select("gateway, amount")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("paid_at", `${today}T00:00:00`).lte("paid_at", `${today}T23:59:59`),
    sb.from("cashier_day_closes")
      .select("close_date, opening_float, counted_cash, system_cash, system_card, variance, notes")
      .eq("clinic_id", claims.clinic_id)
      .order("close_date", { ascending: false }).limit(10),
  ]);

  let cash = 0, card = 0;
  for (const p of pays ?? []) {
    if (p.gateway === "cash") cash += Number(p.amount ?? 0);
    else card += Number(p.amount ?? 0);
  }

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "short" }).format(new Date(d + "T12:00:00"));

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <h2 className="text-xl font-bold text-white">إغلاق اليوم</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>تصفية الصندوق ومطابقة النظام</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <DayCloseForm systemCash={cash} systemCard={card} />

        {/* history */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-4">
            <History className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
            سجل الإغلاقات
          </h3>
          {(history ?? []).length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-4)" }}>لا إغلاقات مسجّلة بعد</p>
          ) : (
            <div className="space-y-1.5">
              {(history ?? []).map((h) => {
                const ok = Math.abs(Number(h.variance)) < 0.001;
                return (
                  <div key={h.close_date} className="flex items-center gap-3 px-3 py-2.5 rounded-xl flex-wrap"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-[12px] font-semibold text-white w-28 shrink-0">{fmtDate(h.close_date)}</span>
                    <span className="text-[11px] ltr-nums flex-1" style={{ color: "var(--text-3)" }}>
                      كاش {fmt(Number(h.system_cash))} · شبكة {fmt(Number(h.system_card))}
                    </span>
                    <span className="text-[11px] font-bold ltr-nums shrink-0"
                      style={{ color: ok ? "#5dd9cb" : "#fcd34d" }}>
                      {ok ? "مطابق ✓" : `فرق ${fmt(Number(h.variance))}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
