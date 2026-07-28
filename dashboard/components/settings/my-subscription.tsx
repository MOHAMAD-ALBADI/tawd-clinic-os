import { CheckCircle2, Lock, Receipt, Users, UserCircle, Stethoscope, MessageCircle } from "lucide-react";
import { MODULES, MODULE_GROUPS, type Entitlements } from "@/lib/modules";
import { PaySubscription } from "@/components/settings/pay-subscription";

export type MyInvoice = {
  id: string; number: string; periodStart: string; periodEnd: string;
  total: number; paid: number; status: string; dueAt: string | null;
};

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const DAY = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric" });

/** The clinic's own view of its contract and its bill.

    Everything here is read-only and comes from the same rows the platform
    edits — there is no second copy to drift. It exists so three questions stop
    being phone calls: what am I paying for, how close am I to my limits, and
    what do I still owe. */
export function MySubscription({
  entitlements, invoices, usage, planName, status, renewsAt, pay,
}: {
  entitlements: Entitlements;
  invoices: MyInvoice[];
  usage: { doctors: number; staff: number; patients: number };
  planName: string;
  status: string;
  renewsAt: string | null;
  /** card payment availability, and how the last return from the gateway went */
  pay: { configured: boolean; live: boolean; flag: string | null };
}) {
  const included = new Set(entitlements.modules);
  const outstanding = invoices
    .filter((i) => i.status === "open")
    .reduce((s, i) => s + (i.total - i.paid), 0);

  const STATUS_AR: Record<string, string> = {
    trial: "تجريبي", active: "نشط", past_due: "متأخر السداد",
    paused: "موقوف", cancelled: "ملغى",
  };

  return (
    <div className="space-y-4">
      {/* ── what you pay ── */}
      <div className="panel" style={{ padding: "1.5rem" }}>
        <div className="section-title mb-4">
          <Receipt className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>اشتراككم</h2>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[28px] font-black ltr-nums text-white">
            {fmt(entitlements.basePriceOmr + entitlements.perDoctorOmr * entitlements.contractedDoctors)}
          </span>
          <span className="text-[12px]" style={{ color: "var(--text-3)" }}>ر.ع شهرياً</span>
          <span className="badge badge-mute">{planName}</span>
          <span className="badge" style={
            status === "active" ? { background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }
            : status === "trial" ? { background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.22)" }
            : { background: "rgba(248,113,113,0.1)", color: "#fda4b4", border: "1px solid rgba(248,113,113,0.22)" }
          }>{STATUS_AR[status] ?? status}</span>
        </div>

        {entitlements.perDoctorOmr > 0 && (
          <p className="text-[11.5px] mt-1.5" style={{ color: "var(--text-4)" }}>
            {fmt(entitlements.basePriceOmr)} أساسي + {fmt(entitlements.perDoctorOmr)} ×{" "}
            <span className="ltr-nums">{entitlements.contractedDoctors}</span> طبيب
          </p>
        )}
        {renewsAt && (
          <p className="text-[11.5px] mt-1" style={{ color: "var(--text-3)" }}>
            يُجدَّد في {DAY.format(new Date(renewsAt))}
          </p>
        )}
        {entitlements.notes && (
          <p className="text-[11.5px] mt-3 px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)", color: "var(--text-2)" }}>
            {entitlements.notes}
          </p>
        )}
      </div>

      {/* ── how much of it you are using ──
          Shown before the limit is hit, so the first sign of a full plan is not
          a refused save in the middle of registering a patient. */}
      {(entitlements.maxDoctors != null || entitlements.maxStaff != null || entitlements.maxPatients != null) && (
        <div className="panel" style={{ padding: "1.5rem" }}>
          <div className="section-title mb-1">
            <Users className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>حدود اشتراككم</h2>
          </div>
          <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
            للتوسعة تواصلوا مع فريق طود — تُرفع فوراً
          </p>
          <div className="space-y-3">
            <Meter icon={Stethoscope} label="أطباء" used={usage.doctors} limit={entitlements.maxDoctors} />
            <Meter icon={Users} label="حسابات" used={usage.staff} limit={entitlements.maxStaff} />
            <Meter icon={UserCircle} label="مرضى" used={usage.patients} limit={entitlements.maxPatients} />
          </div>
        </div>
      )}

      {/* ── what you get ── */}
      <div className="panel" style={{ padding: "1.5rem" }}>
        <div className="section-title mb-1">
          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>الخدمات المشمولة</h2>
        </div>
        <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
          الرمادي غير مشمول في اشتراككم الحالي — بياناته تبقى محفوظة إن أُضيف لاحقاً
        </p>
        <div className="space-y-3">
          {MODULE_GROUPS.map((g) => (
            <div key={g}>
              <p className="text-[10.5px] mb-1.5" style={{ color: "var(--text-4)" }}>{g}</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {MODULES.filter((m) => m.group === g).map((m) => {
                  const on = included.has(m.key);
                  return (
                    <div key={m.key} className="flex items-start gap-2 px-3 py-2 rounded-xl"
                      style={{
                        background: on ? "rgb(var(--accent-1-rgb) / 0.05)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.18)" : "var(--hairline)"}`,
                      }}>
                      {on
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--accent-1)" }} />
                        : <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-4)" }} />}
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold" style={{ color: on ? "#ffffff" : "var(--text-4)" }}>
                          {m.label}
                        </p>
                        <p className="text-[10.5px]" style={{ color: "var(--text-4)" }}>{m.blurb}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── what you owe ── */}
      <div className="panel" style={{ padding: "1.5rem" }}>
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="section-title">
            <Receipt className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>فواتيركم</h2>
          </div>
          {outstanding > 0 && (
            <span className="text-[12px]" style={{ color: "#fbbf24" }}>
              مستحق <span className="font-black ltr-nums">{fmt(outstanding)}</span> ر.ع
            </span>
          )}
        </div>
        <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
          ما صدر عليكم وما وصل من دفعات — نفس السجل الذي لدى فريق طود
        </p>

        {/* How the last trip to the gateway ended. "Pending" is not "failed":
            a card can still be settling when the browser comes back, and telling
            a clinic their payment failed when it merely has not landed yet is
            the wrong thing to be wrong about. */}
        {pay.flag && (
          <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl mb-3"
            style={
              pay.flag === "paid"
                ? { background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }
                : { background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }
            }>
            {pay.flag === "paid" ? "وصلت دفعتكم وسُجّلت على الفاتورة ✓"
              : pay.flag === "cancelled" ? "أُلغيت عملية الدفع — لم يُخصم شيء"
              : pay.flag === "pending" ? "لم تصل الدفعة بعد. إن خُصم المبلغ اضغط زر التحقّق بجانب الفاتورة."
              : "تعذّر التعرّف على عملية الدفع"}
          </div>
        )}

        {invoices.length === 0 ? (
          <p className="text-[12px] text-center py-6" style={{ color: "var(--text-4)" }}>
            لا فواتير بعد
          </p>
        ) : (
          <div className="space-y-1.5">
            {invoices.map((i) => {
              const rest = i.total - i.paid;
              const late = i.status === "open" && !!i.dueAt && new Date(i.dueAt).getTime() < Date.now();
              return (
                <div key={i.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${late ? "rgba(248,113,113,0.22)" : "var(--hairline)"}`,
                  }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold ltr-nums text-white">{i.number}</p>
                    <p className="text-[10.5px] ltr-nums" style={{ color: "var(--text-4)" }}>
                      {i.periodStart} → {i.periodEnd}
                    </p>
                  </div>
                  <span className="ltr-nums font-bold text-white text-[13px]">{fmt(i.total)}</span>
                  {i.status === "paid" ? (
                    <span className="badge badge-ok">مدفوعة</span>
                  ) : i.status === "void" ? (
                    <span className="badge badge-mute">ملغاة</span>
                  ) : (
                    <>
                      <span className="text-[11.5px]" style={{ color: late ? "#fda4b4" : "#fbbf24" }}>
                        {i.paid > 0 ? <>باقي <span className="ltr-nums">{fmt(rest)}</span></> : "غير مدفوعة"}
                        {late && " · متأخرة"}
                      </span>
                      {rest > 0 && (
                        <PaySubscription invoiceId={i.id} outstanding={rest}
                          configured={pay.configured} live={pay.live} />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[11px] mt-3" style={{ color: "var(--text-4)" }}>
          <MessageCircle className="w-3 h-3" />
          للاستفسار عن فاتورة أو تعديل الاشتراك تواصلوا مع فريق طود
        </p>
      </div>
    </div>
  );
}

function Meter({
  icon: Icon, label, used, limit,
}: { icon: typeof Users; label: string; used: number; limit: number | null }) {
  if (limit == null) {
    return (
      <div className="flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-3)" }} />
        <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
        <span className="text-[12px] ms-auto" style={{ color: "var(--accent-1)" }}>بلا حد</span>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tight = pct >= 80;
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-3)" }} />
        <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
        <span className="text-[12px] ltr-nums ms-auto" style={{ color: tight ? "#fbbf24" : "var(--text-3)" }}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{
          width: `${pct}%`,
          background: tight ? "#fbbf24" : "var(--accent-2)",
        }} />
      </div>
    </div>
  );
}
