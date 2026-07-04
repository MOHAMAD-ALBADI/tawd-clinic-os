import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { Banknote, CreditCard, ReceiptText, AlertCircle, ChevronLeft, Lock } from "lucide-react";

export const metadata = { title: "لوحة المالية — طود" };

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function AccountantPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = `${today.slice(0, 7)}-01T00:00:00`;

  const [paysTodayRes, monthPaidRes, pendingRes, readyRes, recentPaysRes, closedRes] = await Promise.all([
    sb.from("payments").select("gateway, amount")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("paid_at", `${today}T00:00:00`).lte("paid_at", `${today}T23:59:59`),
    sb.from("invoices").select("total")
      .eq("clinic_id", claims.clinic_id).eq("status", "paid").gte("created_at", monthStart).is("deleted_at", null),
    sb.from("invoices").select("total, status")
      .eq("clinic_id", claims.clinic_id).in("status", ["sent", "partially_paid", "overdue"]).is("deleted_at", null),
    sb.from("appointments")
      .select("id, slot_time, patients!patient_id(name), services!service_id(name_ar, price), invoices!appt_id(id)")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .gte("slot_time", `${today}T00:00:00`).lte("slot_time", `${today}T23:59:59`)
      .is("deleted_at", null).order("slot_time", { ascending: false }),
    sb.from("payments")
      .select("id, gateway, amount, paid_at, invoices!invoice_id(invoice_number, patients!patient_id(name))")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed")
      .order("paid_at", { ascending: false }).limit(8),
    sb.from("cashier_day_closes").select("close_date")
      .eq("clinic_id", claims.clinic_id).eq("close_date", today).limit(1),
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
  const dayClosed = (closedRes.data ?? []).length > 0;

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

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
              <p className="text-[10px]" style={{ color: "var(--text-4)" }}>إيراد الشهر</p>
              <p className="text-lg font-bold ltr-nums text-white">{fmt(monthPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ KPIs ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "جاهز للفوترة", v: ready.length, sub: "كشف مكتمل بلا فاتورة", warn: ready.length > 0 },
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
              <p className="text-sm" style={{ color: "var(--text-3)" }}>كل كشوفات اليوم مفوترة ✓</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {ready.map((a) => {
                const p = a.patients as unknown as { name?: string } | null;
                const s = a.services as unknown as { name_ar?: string; price?: number } | null;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-[12px] ltr-nums w-14 shrink-0" style={{ color: "var(--text-3)" }}>{fmtTime(a.slot_time)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{p?.name ?? "مريض"}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{s?.name_ar ?? ""}</p>
                    </div>
                    <span className="text-[13px] font-bold ltr-nums text-white shrink-0">{fmt(Number(s?.price ?? 0))}</span>
                    <Link
                      href={`/accountant/checkout/${a.id}`}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}
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
