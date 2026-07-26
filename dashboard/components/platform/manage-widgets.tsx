"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, RefreshCcw, Send, Trash2, Plus } from "lucide-react";
import {
  updateSubscription, renewSubscriptionMonth, sendClinicWhatsApp,
  addPlatformCost, deletePlatformCost, impersonateClinic, requestClinicAccess,
} from "@/app/actions/platform";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/* ─── subscription status + renewal (clinic file) ───

   This used to be a second editor for plan, price and status, sitting on the
   same page as the contract panel and the header's status toggle. Three
   controls writing the same two fields is three answers to "what does this
   clinic pay" — and its plan list was hardcoded to the four original tiers, so
   a template created afterwards could not be picked here at all.

   It now shows the agreed terms and does the one thing nothing else does:
   move the period forward. Plan, price and modules belong to the contract
   panel; suspension belongs to the header. */
export function SubscriptionCard({
  clinicId, plan, status, priceOmr, periodEnd,
}: {
  clinicId: string; plan: string; status: string; priceOmr: number; periodEnd: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const daysLeft = periodEnd ? Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86_400_000) : null;
  const flash = (text: string, bad = false) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 4000); };

  const STATUS_AR: Record<string, string> = {
    trial: "تجريبي", active: "نشط", past_due: "متأخر السداد", paused: "موقوف", cancelled: "ملغى",
  };

  function renew() {
    start(async () => {
      const r = await renewSubscriptionMonth(clinicId);
      flash(r.ok ? "جُدّد شهراً ✓" : r.reason, !r.ok);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <Wallet className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          الاشتراك
        </h3>
        {daysLeft !== null && (
          <span className="text-[11px] font-bold ltr-nums"
            style={{ color: daysLeft <= 0 ? "#fda4b4" : daysLeft <= 7 ? "#fcd34d" : "var(--accent-1)" }}>
            {daysLeft <= 0 ? "منتهي!" : `باقي ${daysLeft} يوم`}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="text-[22px] font-black ltr-nums text-white">{fmt(priceOmr)}</span>
        <span className="text-[11px]" style={{ color: "var(--text-4)" }}>ر.ع/شهر</span>
      </div>
      <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-3)" }}>
        {plan} · {STATUS_AR[status] ?? status}
      </p>

      {msg && <p className="text-[12px] font-semibold mt-3" style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>{msg.text}</p>}

      <button onClick={renew} disabled={pending} className="btn-ghost w-full mt-4">
        <RefreshCcw className="w-3.5 h-3.5" /> {pending ? "جارٍ…" : "تمديد الفترة شهراً"}
      </button>
      {/* Renewing moves the period; it is not a receipt. Calling it "تجديد"
          with no payment behind it is how a clinic ends up looking paid up
          because someone clicked a button. */}
      <p className="text-[10.5px] mt-2 text-center leading-relaxed" style={{ color: "var(--text-4)" }}>
        يمدّد الفترة فقط ولا يسجّل مبلغاً — الفواتير والدفعات في{" "}
        <Link href="/platform-admin/billing" style={{ color: "var(--accent-1)" }}>التحصيل</Link>
        <br />الباقة والسعر والخدمات من «الاتفاق والصلاحيات» أدناه
      </p>
    </div>
  );
}

/* ─── WhatsApp to one clinic (clinic file) ─── */
export function ClinicWhatsApp({ clinicId, hasPhone }: { clinicId: string; hasPhone: boolean }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  function send() {
    start(async () => {
      const r = await sendClinicWhatsApp([clinicId], text);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      const res = r.results[0];
      setMsg(res?.sent ? { text: "أُرسلت واتساب ✓" } : { text: `لم تُرسل: ${res?.reason}`, bad: true });
      if (res?.sent) setText("");
      setTimeout(() => setMsg(null), 5000);
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
        <Send className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        رسالة واتساب للعيادة
      </h3>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
        {hasPhone ? "تُرسل لرقم العيادة المسجّل" : "⚠ لا يوجد رقم هاتف مسجّل لهذه العيادة"}
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="field" style={{ resize: "vertical" }}
        placeholder="مثال: اشتراككم ينتهي بعد ٣ أيام — للتجديد تواصلوا معنا" />
      {msg && <p className="text-[12px] font-semibold mt-2" style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>{msg.text}</p>}
      <button onClick={send} disabled={pending || !text.trim() || !hasPhone} className="btn-primary w-full mt-3">
        <Send className="w-3.5 h-3.5" /> {pending ? "جارٍ الإرسال…" : "إرسال"}
      </button>
    </div>
  );
}

/* ─── platform economy: AUTO usage from live sources + manual only for no-API items ─── */
export function CostsCard({
  costs, geminiTokensMonth, waMessagesMonth, mrr,
  dbSizeMb = null, waConversationsMonth = null, n8nRuns24h = null,
}: {
  costs: { id: string; name: string; monthly_omr: number }[];
  geminiTokensMonth: number;
  waMessagesMonth: number;
  mrr: number;
  dbSizeMb?: number | null;
  waConversationsMonth?: number | null;
  n8nRuns24h?: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const totalCosts = costs.reduce((s, c) => s + Number(c.monthly_omr), 0);
  const net = mrr - totalCosts;
  /* Gemini 2.5 Flash ~$0.30/1M in + $2.50/1M out — rough blended est ~$1/1M → OMR */
  const geminiEstOmr = (geminiTokensMonth / 1_000_000) * 0.385;

  function add() {
    start(async () => {
      const r = await addPlatformCost(name, parseFloat(amount) || 0);
      if (r.ok) { setName(""); setAmount(""); router.refresh(); }
    });
  }
  function del(id: string) {
    start(async () => { const r = await deletePlatformCost(id); if (r.ok) router.refresh(); });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-3">
        <Wallet className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        اقتصاد المنصة — تكاليفي واستهلاكي
      </h3>

      {/* AUTO — live consumption from real sources */}
      <p className="eyebrow mb-2" style={{ fontSize: 9, color: "var(--accent-2)" }}>استهلاك تلقائي حي — بدون إدخال يدوي</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        {[
          { l: "توكنز Gemini/شهر", v: geminiTokensMonth.toLocaleString("en-US"), sub: `≈ ${fmt(geminiEstOmr)} ر.ع (مجاني بخطتك الحالية)` },
          { l: "محادثات واتساب/شهر", v: (waConversationsMonth ?? 0).toLocaleString("en-US"), sub: `${waMessagesMonth.toLocaleString("en-US")} رسالة — ردود الخدمة مجانية في Meta` },
          { l: "حجم قاعدة البيانات", v: dbSizeMb !== null ? `${dbSizeMb} MB` : "—", sub: "من أصل 500MB (خطة Supabase المجانية)" },
          { l: "تشغيلات الأتمتة/24س", v: n8nRuns24h !== null ? n8nRuns24h.toLocaleString("en-US") : "—", sub: "n8n على خادمك الخاص" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl px-3 py-2.5" style={{ background: "rgb(var(--accent-1-rgb) / 0.04)", border: "1px solid rgb(var(--accent-1-rgb) / 0.12)" }}>
            <p className="text-[9px] mb-1" style={{ color: "var(--text-4)" }}>{k.l}</p>
            <p className="text-sm font-bold ltr-nums text-white">{k.v}</p>
            <p className="text-[9px]" style={{ color: "var(--text-4)" }}>{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { l: "اشتراكات مجانية مكتشفة تلقائياً", v: "0.000 ر.ع", sub: "Vercel Hobby · Supabase Free · Gemini Free · رقم واتساب تجريبي" },
          { l: "تكاليف يدوية (بلا API)", v: `${fmt(totalCosts)} ر.ع`, sub: "مثل VPS استضافة n8n" },
          { l: "صافي شهري تقديري", v: `${fmt(net)} ر.ع`, sub: "MRR − التكاليف" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] mb-1" style={{ color: "var(--text-4)" }}>{k.l}</p>
            <p className="text-sm font-bold ltr-nums text-white">{k.v}</p>
            <p className="text-[9px]" style={{ color: "var(--text-4)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <p className="eyebrow mb-2" style={{ fontSize: 9 }}>تكاليف بلا API (تُدخل مرة واحدة فقط — مثل VPS)</p>
      <div className="space-y-1.5 mb-3">
        {costs.map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[12px] flex-1 text-white">{c.name}</span>
            <span className="text-[12px] font-bold ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(Number(c.monthly_omr))}</span>
            <button onClick={() => del(c.id)} disabled={pending} className="w-6 h-6 rounded flex items-center justify-center"
              style={{ color: "#fda4b4" }} aria-label="حذف">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {costs.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-4)" }}>أضف تكاليفك (Vercel، Supabase، استضافة n8n، Meta…)</p>}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="field flex-1" placeholder="مثال: استضافة n8n" style={{ fontSize: 12 }} />
        <input type="text" inputMode="decimal" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className="field ltr-nums" dir="ltr" placeholder="ر.ع" style={{ width: 90, fontSize: 12 }} />
        <button onClick={add} disabled={pending || !name.trim()} className="btn-ghost shrink-0"><Plus className="w-4 h-4" /></button>
      </div>
      <p className="text-[9px] mt-2" style={{ color: "var(--text-4)" }}>* التوكنز المرصودة من مساعد اللوحة؛ رصد واتساب n8n يُضاف لاحقاً</p>
    </div>
  );
}

/* ─── support impersonation: log in AS the clinic (clinic file) ─── */
export function ImpersonateButton({ clinicId }: { clinicId: string }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function go() {
    setErr(null);
    start(async () => {
      const r = await impersonateClinic(clinicId);
      if (!r.ok) { setErr(r.reason); return; }
      setLink(r.link);
    });
  }

  const [reqMsg, setReqMsg] = useState<string | null>(null);
  function askPermission() {
    setErr(null);
    start(async () => {
      const r = await requestClinicAccess(clinicId);
      setReqMsg(r.ok ? "أُرسل طلب الإذن للعيادة (واتساب + داخل لوحتهم) — انتظر موافقتهم ثم ولّد الرابط" : r.reason);
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white text-sm mb-1">🕶️ دخول كالعيادة (بإذنهم)</h3>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
        ١) اطلب الإذن → يوصلهم تنبيه ٢) بعد موافقتهم (سارية ساعة) ولّد الرابط —
        وافتحه دائماً في <b>نافذة خفية</b> (الرابط يبدّل الجلسة)
      </p>
      {link ? (
        <div className="flex gap-2">
          <a href={link} target="_blank" rel="noreferrer" className="btn-primary flex-1">فتح لوحتهم (نافذة خفية!)</a>
          <button onClick={() => { navigator.clipboard.writeText(link); }} className="btn-ghost">نسخ</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={askPermission} disabled={pending} className="btn-ghost flex-1">
            {pending ? "…" : "١· طلب إذن العيادة"}
          </button>
          <button onClick={go} disabled={pending} className="btn-primary flex-1">
            {pending ? "…" : "٢· توليد الرابط"}
          </button>
        </div>
      )}
      {reqMsg && <p className="text-[12px] mt-2" style={{ color: "var(--accent-1)" }}>{reqMsg}</p>}
      {err && <p className="text-[12px] mt-2" style={{ color: "#fda4b4" }}>{err}</p>}
    </div>
  );
}

/* ─── clinic-admin side: approve/deny the support access request ─── */
export function SupportAccessBanner({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  function answer(approve: boolean) {
    start(async () => {
      const { respondSupportAccess } = await import("@/app/actions/platform");
      const r = await respondSupportAccess(requestId, approve);
      setDone(r.ok ? (approve ? "تمت الموافقة — وصول الدعم ساري لمدة ساعة ✓" : "تم الرفض") : r.reason);
      router.refresh();
    });
  }

  if (done) return <div className="badge badge-brand mb-1">{done}</div>;
  return (
    <div className="rounded-2xl flex items-center gap-3 px-4 py-3 flex-wrap"
      style={{ background: "rgb(var(--accent-1-rgb) / 0.06)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)" }}>
      <p className="text-[13px] font-semibold text-white flex-1">
        🛠️ فريق طود يطلب إذن الدخول للوحتكم للدعم الفني (صلاحية ساعة واحدة)
      </p>
      <button onClick={() => answer(true)} disabled={pending} className="btn-primary" style={{ padding: "0.4rem 1rem", fontSize: 12 }}>أوافق</button>
      <button onClick={() => answer(false)} disabled={pending} className="btn-danger">أرفض</button>
    </div>
  );
}
