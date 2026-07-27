import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { clinicToday, clinicDayRange, clinicDatePlus } from "@/lib/clinic-time";
import { arTime } from "@/lib/ar-format";
import { Banknote, CreditCard, ReceiptText, AlertCircle, ChevronLeft, Lock } from "lucide-react";

export const metadata = { title: "لوحة المالية — طود" };

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function AccountantPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  /* Muscat, not UTC. This page computed the day itself while the day-close
     screen used clinicDayRange, so the two disagreed about which payments
     belong to today — the same figure, two answers, on money. */
  const today = clinicToday();
  const { startUtc, endUtc } = clinicDayRange(today);
  const monthStart = `${today.slice(0, 7)}-01T00:00:00+04:00`;

  /* Current quarter, clinic time — the VAT period. */
  const qMonth = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
  const quarterStart = `${today.slice(0, 4)}-${String(qMonth).padStart(2, "0")}-01`;

  const [paysTodayRes, monthPaidRes, pendingRes, readyRes, recentPaysRes, closedRes, agingRes, vatRes] = await Promise.all([
    sb.from("payments").select("gateway, amount")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("paid_at", startUtc).lte("paid_at", endUtc),
    sb.from("invoices").select("total")
      .eq("clinic_id", claims.clinic_id).eq("status", "paid").gte("created_at", monthStart).is("deleted_at", null),
    sb.from("invoices").select("total, status")
      .eq("clinic_id", claims.clinic_id).in("status", ["sent", "partially_paid", "overdue"]).is("deleted_at", null),
    /* Every completed visit with no invoice, not just today's.

       This was scoped to today, so a visit finished yesterday and not billed
       vanished from the accountant's world entirely — there was no screen
       anywhere that listed it. Work delivered and never charged for, and
       nothing in the product ever mentioned it again. Ninety days back. */
    sb.from("appointments")
      .select("id, slot_time, patients!patient_id(name), services!service_id(name_ar, price), invoices!appt_id(id)")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("slot_time", clinicDayRange(clinicDatePlus(-90)).startUtc)
      .is("deleted_at", null).order("slot_time", { ascending: false }).limit(500),
    sb.from("payments")
      .select("id, gateway, amount, paid_at, invoices!invoice_id(invoice_number, patients!patient_id(name))")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .order("paid_at", { ascending: false }).limit(8),
    sb.from("cashier_day_closes").select("close_date")
      .eq("clinic_id", claims.clinic_id).eq("close_date", today).limit(1),
    /* Receivables need an age to be actionable — "50 outstanding" is a number,
       "50 outstanding, 30 of it past ninety days" is a decision. */
    sb.from("invoices").select("total, created_at, status")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .in("status", ["sent", "partially_paid", "overdue"]).limit(2000),
    /* The quarter's output VAT, so the filing position is visible before the
       deadline rather than discovered at it. */
    sb.from("invoices").select("vat_amount")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .neq("status", "draft").neq("status", "cancelled").neq("status", "refunded")
      .gte("created_at", `${quarterStart}T00:00:00+04:00`).limit(5000),
  ]);

  let cashToday = 0, cardToday = 0;
  for (const p of paysTodayRes.data ?? []) {
    if (p.gateway === "cash") cashToday += Number(p.amount ?? 0);
    else cardToday += Number(p.amount ?? 0);
  }
  const collectedToday = cashToday + cardToday;
  const monthPaid = (monthPaidRes.data ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);
  const pending = pendingRes.data ?? [];
  const pendingTotal = pending.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const overdueCount = pending.filter((i) => i.status === "overdue").length;
  const ready = (readyRes.data ?? []).filter((a) => !(a.invoices as unknown as { id: string }[] | null)?.length);
  /* Money the clinic earned and never billed. Naming the figure is the point —
     "3 visits" is a chore, "45.000 ر.ع unbilled" is a decision. */
  const readyValue = ready.reduce(
    (s, a) => s + Number((a.services as unknown as { price?: number } | null)?.price ?? 0), 0);
  const dayClosed = (closedRes.data ?? []).length > 0;

  const aging = { d30: 0, d60: 0, d90: 0, over: 0 };
  for (const inv of agingRes.data ?? []) {
    const age = Math.floor((Date.now() - new Date(inv.created_at as string).getTime()) / 86_400_000);
    const v = Number(inv.total ?? 0);
    if (age <= 30) aging.d30 += v;
    else if (age <= 60) aging.d60 += v;
    else if (age <= 90) aging.d90 += v;
    else aging.over += v;
  }
  const vatQuarter = (vatRes.data ?? []).reduce((s, i) => s + Number(i.vat_amount ?? 0), 0);
  /* Billed vs collected this month is where revenue leaks, and neither number
     meant anything alone. */
  const collectionRate = monthPaid > 0 || pendingTotal > 0
    ? Math.round((monthPaid / (monthPaid + pendingTotal)) * 100)
    : null;

  const fmtTime = (iso: string) => arTime.format(new Date(iso));

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* ══ day summary hero ══ */}
      <div className="panel-feature relative overflow-hidden" style={{ padding: "1.5rem 1.75rem" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow" style={{ color: "var(--accent-2)" }}>مقبوضات اليوم · ر.ع</p>
            <p className="ltr-nums font-bold leading-none mt-2" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)", color: collectedToday > 0 ? "#fff" : "rgba(255,255,255,0.4)" }}>
              {fmt(collectedToday)}
            </p>
            <div className="flex items-center gap-4 mt-3 text-[12px]">
              <span className="flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                <Banknote className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                كاش <span className="font-bold ltr-nums text-white">{fmt(cashToday)}</span>
              </span>
              <span className="flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                <CreditCard className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                شبكة <span className="font-bold ltr-nums text-white">{fmt(cardToday)}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/accountant/day-close" className={dayClosed ? "btn-ghost" : "btn-primary"}>
              <Lock className="w-4 h-4" />
              {dayClosed ? "اليوم مُغلق ✓" : "إغلاق اليوم"}
            </Link>
            <div className="text-end">
              <p className="text-[10px]" style={{ color: "var(--text-4)" }}>محصّل الشهر</p>
              <p className="text-lg font-bold ltr-nums text-white">{fmt(monthPaid)}</p>
              {collectionRate !== null && (
                <p className="text-[10px] ltr-nums" style={{ color: collectionRate >= 80 ? "var(--accent-1)" : "#fbbf24" }}>
                  نسبة التحصيل {collectionRate}%
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ KPIs ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "جاهز للفوترة", v: ready.length,
            sub: readyValue > 0 ? `${fmt(readyValue)} ر.ع لم تُفوتَر` : "كشف مكتمل بلا فاتورة",
            warn: ready.length > 0 },
          { l: "غير مسدد", v: fmt(pendingTotal), sub: `${pending.length} فاتورة`, warn: false },
          { l: "متأخرة", v: overdueCount, sub: "تحتاج متابعة", warn: overdueCount > 0 },
          { l: "عمليات اليوم", v: (paysTodayRes.data ?? []).length, sub: "دفعة مسجّلة", warn: false },
        ].map((k) => (
          <div key={k.l} className="panel panel-hover" style={{ padding: "1.1rem 1.3rem" }}>
            <p className="eyebrow mb-2.5">{k.l}</p>
            <p className="text-2xl font-bold ltr-nums leading-none" style={{ color: k.warn ? "#fcd34d" : "#fff" }}>{k.v}</p>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--text-3)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Aged receivables and the VAT position — the two figures a finance
          screen exists to answer and neither was anywhere. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { l: "حتى ٣٠ يوم", v: fmt(aging.d30), tone: "plain" as const },
          { l: "٣١–٦٠", v: fmt(aging.d60), tone: aging.d60 > 0 ? "warn" as const : "plain" as const },
          { l: "٦١–٩٠", v: fmt(aging.d90), tone: aging.d90 > 0 ? "warn" as const : "plain" as const },
          { l: "أكثر من ٩٠", v: fmt(aging.over), tone: aging.over > 0 ? "bad" as const : "plain" as const },
        ].map((b) => (
          <div key={b.l} className="panel" style={{ padding: "0.9rem 1.1rem" }}>
            <p className="text-[10px] mb-1.5" style={{ color: "var(--text-4)" }}>{b.l}</p>
            <p className="font-black ltr-nums" style={{
              fontSize: "1.15rem",
              color: b.tone === "bad" ? "#fda4b4" : b.tone === "warn" ? "#fbbf24" : "#ffffff",
            }}>{b.v}</p>
          </div>
        ))}
        <Link href="/accountant/vat" className="panel panel-hover" style={{ padding: "0.9rem 1.1rem" }}>
          <p className="text-[10px] mb-1.5" style={{ color: "var(--text-4)" }}>ضريبة الربع</p>
          <p className="font-black ltr-nums" style={{ fontSize: "1.15rem", color: "var(--accent-1)" }}>{fmt(vatQuarter)}</p>
          <p className="text-[9.5px] mt-0.5" style={{ color: "var(--text-4)" }}>الإقرار ←</p>
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* ready to invoice */}
        <div className="col-span-12 lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>جاهز للفوترة والتحصيل</h2>
            {ready.length > 0 && <span className="badge badge-warn ltr-nums">{ready.length}</span>}
          </div>

          {ready.length === 0 ? (
            <div className="text-center py-10">
              <ReceiptText className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
              <p className="text-sm" style={{ color: "var(--text-3)" }}>لا كشف مكتمل بلا فاتورة ✓</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {ready.map((a) => {
                const p = a.patients as unknown as { name?: string } | null;
                const s = a.services as unknown as { name_ar?: string; price?: number } | null;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    {(() => {
                      const days = Math.floor((Date.now() - new Date(a.slot_time as string).getTime()) / 86_400_000);
                      return (
                        <span className="text-[12px] ltr-nums w-14 shrink-0"
                          style={{ color: days >= 2 ? "#fbbf24" : "var(--text-3)" }}>
                          {days === 0 ? fmtTime(a.slot_time) : `${days} يوم`}
                        </span>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{p?.name ?? "مريض"}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{s?.name_ar ?? ""}</p>
                    </div>
                    <span className="text-[13px] font-bold ltr-nums text-white shrink-0">{fmt(Number(s?.price ?? 0))}</span>
                    <Link
                      href={`/accountant/checkout/${a.id}`}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}
                    >
                      <ReceiptText className="w-3.5 h-3.5" />
                      فوترة وقبض
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* recent payments */}
        <div className="col-span-12 lg:col-span-5 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>آخر المدفوعات</h2>
          </div>
          {(recentPaysRes.data ?? []).length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-4)" }}>لا مدفوعات بعد</p>
          ) : (
            <div className="space-y-1.5">
              {(recentPaysRes.data ?? []).map((p) => {
                const inv = p.invoices as unknown as { invoice_number?: string; patients?: { name?: string } | null } | null;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    {p.gateway === "cash"
                      ? <Banknote className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-3)" }} />
                      : <CreditCard className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-3)" }} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{inv?.patients?.name ?? "—"}</p>
                      <p className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>{inv?.invoice_number ?? ""}</p>
                    </div>
                    <span className="text-[12px] font-bold ltr-nums text-white shrink-0">{fmt(Number(p.amount ?? 0))}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/accountant/invoices" className="flex items-center justify-center gap-1 text-[11px] font-semibold mt-4" style={{ color: "var(--text-3)" }}>
            كل الفواتير <ChevronLeft className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="rounded-2xl flex items-center gap-3 px-4 py-3"
          style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#fcd34d" }} />
          <p className="text-[12px]" style={{ color: "#fcd34d" }}>
            {overdueCount} فاتورة متأخرة — اطلب من سُرى: «مين عليهم فواتير متأخرة؟» لمتابعتهم
          </p>
        </div>
      )}
    </div>
  );
}
