"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star, Search, X, Plus, Minus, AlertTriangle, CheckCircle2, History, Coins, Settings,
} from "lucide-react";
import { adjustPoints } from "@/app/actions/loyalty-admin";
import { NumField, F } from "@/components/ui/num-field";
import { arDateTime } from "@/lib/ar-format";

export type LoyaltyHolder = { id: string; name: string; phone: string | null; points: number };
export type LoyaltyTxn = {
  id: string; patientName: string; type: string; points: number;
  balanceAfter: number; note: string | null; createdAt: string;
};
export type LoyaltyConfig = {
  active: boolean;
  pointsPerOmr: number;
  redemptionRate: number;   // OMR per point
  minRedeem: number;
  maxRedeemPct: number;
  expiryMonths: number | null;
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const int = (v: number) => v.toLocaleString("en-US");

const TYPE_AR: Record<string, string> = {
  earn_visit: "اكتساب بزيارة", earn_referral: "اكتساب بإحالة",
  redeem: "استبدال", adjust: "تعديل يدوي", expire: "انتهاء صلاحية",
};

/** Points management, rather than a list of names.

    The page showed patients and their balances and nothing else — no settings,
    no history, no way to correct anything, and no statement of what the points
    are worth. A balance is a liability: it can be redeemed against a bill, so
    the total is money the clinic owes and belongs on the screen with it. */
export function LoyaltyManager({
  holders, recent, config,
}: { holders: LoyaltyHolder[]; recent: LoyaltyTxn[]; config: LoyaltyConfig }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<LoyaltyHolder | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return holders.filter((h) => !term || `${h.name} ${h.phone ?? ""}`.toLowerCase().includes(term));
  }, [holders, q]);

  const totalPoints = holders.reduce((s, h) => s + h.points, 0);
  const liability = totalPoints * config.redemptionRate;

  return (
    <div className="space-y-4">
      {!config.active && (
        <div className="panel flex items-start gap-3" style={{ padding: "1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            نظام الولاء معطّل — الأرصدة أدناه قائمة ولا تُكتسب نقاط جديدة ولا تُستبدل عند الدفع.
          </p>
        </div>
      )}

      {msg && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={msg.bad
            ? { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }
            : { background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          {msg.bad ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="نقاط قائمة" value={int(totalPoints)} sub={`${holders.length} مريض`} />
        {/* The number nobody was shown: what those points cost if redeemed. */}
        <Card label="التزام مالي" value={omr(liability)} sub="ر.ع لو استُبدلت كلها" warn={liability > 0} />
        <Card label="قيمة النقطة" value={omr(config.redemptionRate)} sub="ر.ع عند الاستبدال" />
        <Card label="الاكتساب" value={int(config.pointsPerOmr)} sub="نقطة لكل ر.ع مدفوع" accent />
      </div>

      <div className="panel flex items-start gap-3 flex-wrap" style={{ padding: "0.95rem 1.2rem" }}>
        <Settings className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--text-3)" }} />
        <p className="text-[12px] flex-1" style={{ color: "var(--text-3)" }}>
          الحد الأدنى للاستبدال <span className="font-bold ltr-nums text-white">{int(config.minRedeem)}</span> نقطة ·
          أقصى خصم <span className="font-bold ltr-nums text-white">{config.maxRedeemPct}%</span> من الفاتورة
          {config.expiryMonths ? <> · تنتهي بعد <span className="font-bold ltr-nums text-white">{config.expiryMonths}</span> شهراً</> : " · بلا انتهاء"}
        </p>
        <Link href="/clinic-admin/marketing/loyalty" className="text-[11.5px] underline" style={{ color: "var(--accent-1)" }}>
          تعديل القواعد
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-3">
            <Star className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>أرصدة المرضى</h2>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
              style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم…" style={{ paddingInlineStart: 34 }} />
            {q && (
              <button onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineEnd: 12 }}>
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="text-[12px] text-center py-10" style={{ color: "var(--text-4)" }}>
              {q ? "لا نتائج" : "لا مريض لديه نقاط بعد — تُكتسب تلقائياً عند الدفع"}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {rows.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                  <div className="flex-1 min-w-0">
                    <Link href={`/reception/patients/${h.id}`} className="text-[13px] font-bold text-white truncate hover:underline">
                      {h.name}
                    </Link>
                    {h.phone && (
                      <p className="text-[10.5px] ltr-nums" style={{ color: "var(--text-4)" }}>{h.phone}</p>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-[13px] font-black ltr-nums shrink-0"
                    style={{ color: "var(--accent-1)" }}>
                    <Star className="w-3.5 h-3.5" /> {int(h.points)}
                  </span>
                  <span className="text-[10.5px] ltr-nums shrink-0" style={{ color: "var(--text-4)" }}>
                    ≈ {omr(h.points * config.redemptionRate)} ر.ع
                  </span>
                  <button className="btn-ghost" disabled={pending} title="تعديل الرصيد"
                    onClick={() => { setMsg(null); setTarget(h); }}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Every movement, with who and why. Points move money; an unexplained
            balance change is the kind of thing an audit asks about. */}
        <div className="col-span-12 lg:col-span-5 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-3">
            <History className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>سجل الحركات</h2>
          </div>
          {recent.length === 0 ? (
            <p className="text-[12px] text-center py-10" style={{ color: "var(--text-4)" }}>لا حركات بعد</p>
          ) : (
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
              {recent.map((t) => (
                <div key={t.id} className="px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold text-white truncate">{t.patientName}</span>
                    <span className="text-[12px] font-black ltr-nums ms-auto"
                      style={{ color: t.points >= 0 ? "#34d399" : "#fda4b4" }}>
                      {t.points > 0 ? "+" : ""}{int(t.points)}
                    </span>
                  </div>
                  <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-4)" }}>
                    {TYPE_AR[t.type] ?? t.type} · الرصيد {int(t.balanceAfter)} · {arDateTime.format(new Date(t.createdAt))}
                  </p>
                  {t.note && <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-3)" }}>{t.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {target && (
        <AdjustDialog
          holder={target} config={config} pending={pending}
          onClose={() => setTarget(null)}
          onSave={(points, note) => start(async () => {
            const r = await adjustPoints({ patientId: target.id, points, note });
            if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
            setTarget(null);
            setMsg({ text: r.warning ?? `رصيد ${target.name} صار ${int(r.after)} نقطة`, bad: !!r.warning });
            setTimeout(() => setMsg(null), 5000);
            router.refresh();
          })}
        />
      )}
    </div>
  );
}

function Card({ label, value, sub, accent, warn }: {
  label: string; value: string; sub: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className="panel" style={{ padding: "1.1rem 1.2rem" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--text-4)" }}>{label}</p>
      <p className="font-black ltr-nums leading-none"
        style={{ fontSize: "1.5rem", color: warn ? "#fbbf24" : accent ? "var(--accent-1)" : "#ffffff" }}>{value}</p>
      <p className="text-[10.5px] mt-1.5" style={{ color: "var(--text-4)" }}>{sub}</p>
    </div>
  );
}

function AdjustDialog({
  holder, config, pending, onClose, onSave,
}: {
  holder: LoyaltyHolder; config: LoyaltyConfig; pending: boolean;
  onClose: () => void; onSave: (points: number, note: string) => void;
}) {
  const [dir, setDir] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const n = Math.trunc(Number(amount) || 0);
  const after = holder.points + dir * n;
  const invalid = n <= 0 || after < 0 || !note.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 420, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-black text-white">تعديل نقاط {holder.name}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <p className="text-[12.5px] mb-4" style={{ color: "var(--text-2)" }}>
          الرصيد الحالي <span className="font-black ltr-nums text-white">{int(holder.points)}</span> نقطة
          <span style={{ color: "var(--text-4)" }}> ≈ {omr(holder.points * config.redemptionRate)} ر.ع</span>
        </p>

        <div className="flex items-center gap-1.5 mb-3">
          {([[1, "إضافة", Plus], [-1, "خصم", Minus]] as const).map(([d, l, Icon]) => {
            const on = dir === d;
            return (
              <button key={d} type="button" onClick={() => setDir(d)}
                className="flex items-center gap-1.5 flex-1 justify-center text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
                style={{
                  background: on ? "rgb(var(--accent-1-rgb) / 0.13)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.34)" : "var(--hairline)"}`,
                  color: on ? "var(--accent-1)" : "var(--text-3)",
                }}>
                <Icon className="w-3.5 h-3.5" /> {l}
              </button>
            );
          })}
        </div>

        <F label="عدد النقاط">
          <NumField allowDecimal={false} value={amount} onChange={setAmount} placeholder="100" />
        </F>

        <div className="mt-3">
          <F label="السبب — يبقى في السجل">
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="تعويض عن تأخير · تصحيح خطأ · مكافأة إحالة" />
          </F>
        </div>

        {n > 0 && (
          <p className="text-[12px] mt-3" style={{ color: after < 0 ? "#fda4b4" : "var(--text-3)" }}>
            {after < 0
              ? "لا يمكن الخصم أكثر من الرصيد"
              : <>الرصيد بعد التعديل <span className="font-black ltr-nums text-white">{int(after)}</span> نقطة</>}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-4">
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={pending || invalid}
            onClick={() => onSave(dir * n, note)}>
            <Coins className="w-4 h-4" /> {pending ? "جارٍ…" : "حفظ التعديل"}
          </button>
        </div>
      </div>
    </div>
  );
}
