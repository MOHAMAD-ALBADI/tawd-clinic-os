import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { DayCloseForm } from "@/components/accountant/day-close-form";
import { clinicToday, clinicDayRange } from "@/lib/clinic-time";
import { ArrowRight, History, ListChecks, Banknote, CreditCard, Undo2 } from "lucide-react";
import { arTime } from "@/lib/ar-format";
import { bucketOf, METHOD_AR } from "@/lib/payment-methods";

/* One vocabulary, shared with the cashier and the register — this local copy
   called bank_transfer "تحويل/شبكة", the same conflation the schema has now
   dropped. */

export const metadata = { title: "إغلاق اليوم — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function DayClosePage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  /* Must use the same clinic-local window as closeDay(), or the totals the
     cashier is shown before closing differ from the ones actually recorded. */
  const today = clinicToday();
  const { startUtc, endUtc } = clinicDayRange(today);

  const [{ data: pays }, { data: refunds }, { data: history }] = await Promise.all([
    /* Itemised, not just totalled. A cashier who is 5.000 short cannot find it
       in a single figure — reconciliation means looking down the list for the
       payment that is wrong, and the list was never on the page. */
    sb.from("payments")
      .select("id, gateway, amount, paid_at, invoices!invoice_id(invoice_number, patients!patient_id(name))")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("paid_at", startUtc).lt("paid_at", endUtc)
      .order("paid_at"),
    /* Money that went back out today. It belongs on the same list as the money
       that came in: a drawer is reconciled by looking at every movement, and a
       refund the list does not mention is a shortfall with no explanation. */
    sb.from("invoice_adjustments")
      .select("id, amount, method, reason, created_at, invoices!invoice_id(invoice_number, patients!patient_id(name))")
      .eq("clinic_id", claims.clinic_id).eq("kind", "refund")
      .gte("created_at", startUtc).lt("created_at", endUtc)
      .order("created_at"),
    sb.from("cashier_day_closes")
      .select("close_date, opening_float, counted_cash, system_cash, system_card, system_transfer, system_refunds, variance, notes")
      .eq("clinic_id", claims.clinic_id)
      .order("close_date", { ascending: false }).limit(10),
  ]);

  /* The same buckets closeDay() writes, from the same function — the preview and
     the saved close must not be able to disagree, and they did: everything
     non-cash was folded into "card" on screen and recorded as "other". */
  let cash = 0, card = 0, transfer = 0, other = 0;
  for (const p of pays ?? []) {
    const amt = Number(p.amount ?? 0);
    switch (bucketOf(p.gateway as string)) {
      case "drawer":   cash += amt; break;
      case "terminal": card += amt; break;
      case "bank":     transfer += amt; break;
      default:         other += amt;
    }
  }

  /* Only cash refunds touch the drawer — a reversed card payment is settled by
     the bank and never passes through the till. */
  const cashRefunds = (refunds ?? [])
    .filter((r) => r.method === "cash")
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "short" }).format(new Date(d + "T12:00:00"));

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none">إغلاق اليوم</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>تصفية الصندوق ومطابقة النظام</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <DayCloseForm systemCash={cash} systemCard={card} systemTransfer={transfer}
            systemOther={other} cashRefunds={cashRefunds} />

          {/* Every payment behind today's figures. */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <ListChecks className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
                حركات اليوم
              </h3>
              <span className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>
                {(pays ?? []).length} دفعة
                {(refunds ?? []).length > 0 && ` · ${(refunds ?? []).length} استرداد`}
              </span>
            </div>

            {(refunds ?? []).length > 0 && (
              <div className="space-y-1 mb-2">
                {(refunds ?? []).map((r) => {
                  const inv = r.invoices as unknown as
                    { invoice_number?: string; patients?: { name?: string } | null } | null;
                  return (
                    <div key={r.id as string} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                      style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.22)" }}>
                      <Undo2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#c4b5fd" }} />
                      <span className="text-[11px] ltr-nums shrink-0" style={{ color: "var(--text-4)" }}>
                        {arTime.format(new Date(r.created_at as string))}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-white truncate">
                          {inv?.patients?.name ?? "—"}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-4)" }}>
                          <span className="ltr-nums">{inv?.invoice_number ?? ""}</span>
                          {" · "}{METHOD_AR(r.method as string)}{" · "}{r.reason as string}
                        </p>
                      </div>
                      <span className="text-[12.5px] font-black ltr-nums shrink-0" style={{ color: "#c4b5fd" }}>
                        −{fmt(Number(r.amount ?? 0))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {(pays ?? []).length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-4)" }}>
                لا دفعات مسجّلة اليوم — الصندوق يُغلق على الرصيد الافتتاحي وحده
              </p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {(pays ?? []).map((p) => {
                  const inv = p.invoices as unknown as
                    { invoice_number?: string; patients?: { name?: string } | null } | null;
                  const isCash = p.gateway === "cash";
                  return (
                    <div key={p.id as string} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                      {isCash
                        ? <Banknote className="w-3.5 h-3.5 shrink-0" style={{ color: "#34d399" }} />
                        : <CreditCard className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-3)" }} />}
                      <span className="text-[11px] ltr-nums shrink-0" style={{ color: "var(--text-4)" }}>
                        {arTime.format(new Date(p.paid_at as string))}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-white truncate">
                          {inv?.patients?.name ?? "—"}
                        </p>
                        <p className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>
                          {inv?.invoice_number ?? ""} · {METHOD_AR(p.gateway as string)}
                        </p>
                      </div>
                      <span className="text-[12.5px] font-black ltr-nums shrink-0"
                        style={{ color: isCash ? "#34d399" : "#ffffff" }}>
                        {fmt(Number(p.amount ?? 0))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

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
                      كاش {fmt(Number(h.system_cash))} · مكينة {fmt(Number(h.system_card))}
                      {Number(h.system_transfer ?? 0) > 0 && <> · تحويل {fmt(Number(h.system_transfer))}</>}
                      {Number(h.system_refunds ?? 0) > 0 && (
                        <span style={{ color: "#c4b5fd" }}> · مستردّ {fmt(Number(h.system_refunds))}</span>
                      )}
                    </span>
                    <span className="text-[11px] font-bold ltr-nums shrink-0"
                      style={{ color: ok ? "var(--accent-1)" : "#fcd34d" }}>
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
