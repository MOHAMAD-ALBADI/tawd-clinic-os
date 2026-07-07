"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet, RefreshCcw, Send, Trash2, Plus, CheckCircle2 } from "lucide-react";
import {
  updateSubscription, renewSubscriptionMonth, sendClinicWhatsApp,
  addPlatformCost, deletePlatformCost, impersonateClinic,
} from "@/app/actions/platform";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const PLANS = ["starter", "growth", "pro", "enterprise"] as const;

/* ─── subscription management (clinic file) ─── */
export function SubscriptionCard({
  clinicId, plan, status, priceOmr, periodEnd,
}: {
  clinicId: string; plan: string; status: string; priceOmr: number; periodEnd: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ plan, status, price: String(priceOmr) });
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const daysLeft = periodEnd ? Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86_400_000) : null;

  const flash = (text: string, bad = false) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 4000); };

  function save() {
    start(async () => {
      const r = await updateSubscription(clinicId, {
        plan: form.plan as typeof PLANS[number],
        status: form.status as "trial" | "active" | "suspended",
        price_omr: parseFloat(form.price) || 0,
      });
      flash(r.ok ? "حُفظ الاشتراك ✓" : r.reason, !r.ok);
      if (r.ok) router.refresh();
    });
  }

  function renew() {
    start(async () => {
      const r = await renewSubscriptionMonth(clinicId);
      flash(r.ok ? `جُدّد حتى ${r.until} ✓` : r.reason, !r.ok);
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
            style={{ color: daysLeft <= 0 ? "#fda4b4" : daysLeft <= 7 ? "#fcd34d" : "#5dd9cb" }}>
            {daysLeft <= 0 ? "منتهي!" : `باقي ${daysLeft} يوم`}
          </span>
        )}
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-3)" }}>الباقة والسعر وحالة التجديد</p>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الباقة</label>
          <select value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} className="field" style={{ fontSize: 12 }}>
            {PLANS.map((p) => <option key={p} value={p} style={{ background: "#131315" }}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>السعر ر.ع/شهر</label>
          <input type="number" step="0.001" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} className="field ltr-nums" dir="ltr" style={{ fontSize: 12 }} />
        </div>
        <div>
          <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الحالة</label>
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="field" style={{ fontSize: 12 }}>
            {["trial", "active", "suspended"].map((s) => <option key={s} value={s} style={{ background: "#131315" }}>{s === "trial" ? "تجريبي" : s === "active" ? "نشط" : "موقوف"}</option>)}
          </select>
        </div>
      </div>

      {msg && <p className="text-[12px] font-semibold mt-3" style={{ color: msg.bad ? "#fda4b4" : "#5dd9cb" }}>{msg.text}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={pending} className="btn-ghost flex-1">حفظ</button>
        <button onClick={renew} disabled={pending} className="btn-primary flex-1">
          <RefreshCcw className="w-3.5 h-3.5" /> تجديد شهر
        </button>
      </div>
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
      {msg && <p className="text-[12px] font-semibold mt-2" style={{ color: msg.bad ? "#fda4b4" : "#5dd9cb" }}>{msg.text}</p>}
      <button onClick={send} disabled={pending || !text.trim() || !hasPhone} className="btn-primary w-full mt-3">
        <Send className="w-3.5 h-3.5" /> {pending ? "جارٍ الإرسال…" : "إرسال"}
      </button>
    </div>
  );
}

/* ─── founder's fixed costs editor (overview) ─── */
export function CostsCard({
  costs, geminiTokensMonth, waMessagesMonth, mrr,
}: {
  costs: { id: string; name: string; monthly_omr: number }[];
  geminiTokensMonth: number;
  waMessagesMonth: number;
  mrr: number;
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

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { l: "توكنز Gemini/شهر*", v: geminiTokensMonth.toLocaleString("en-US"), sub: `≈ ${fmt(geminiEstOmr)} ر.ع` },
          { l: "رسائل واتساب/شهر", v: waMessagesMonth.toLocaleString("en-US"), sub: "محادثات سُرى" },
          { l: "صافي شهري تقديري", v: `${fmt(net)}`, sub: "MRR − التكاليف الثابتة" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] mb-1" style={{ color: "var(--text-4)" }}>{k.l}</p>
            <p className="text-sm font-bold ltr-nums text-white">{k.v}</p>
            <p className="text-[9px] ltr-nums" style={{ color: "var(--text-4)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <p className="eyebrow mb-2" style={{ fontSize: 9 }}>تكاليفي الثابتة الشهرية — {fmt(totalCosts)} ر.ع</p>
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
        <input type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className="field ltr-nums" dir="ltr" placeholder="ر.ع" style={{ width: 90, fontSize: 12 }} />
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

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <h3 className="font-bold text-white text-sm mb-1">🕶️ دخول كالعيادة (دعم فني)</h3>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
        رابط دخول لمرة واحدة بحساب مدير العيادة — افتحه في نافذة خفية حتى تبقى جلستك
      </p>
      {link ? (
        <div className="flex gap-2">
          <a href={link} target="_blank" rel="noreferrer" className="btn-primary flex-1">فتح لوحتهم</a>
          <button onClick={() => { navigator.clipboard.writeText(link); }} className="btn-ghost">نسخ</button>
        </div>
      ) : (
        <button onClick={go} disabled={pending} className="btn-ghost w-full">
          {pending ? "جارٍ التوليد…" : "توليد رابط الدخول"}
        </button>
      )}
      {err && <p className="text-[12px] mt-2" style={{ color: "#fda4b4" }}>{err}</p>}
    </div>
  );
}

/* ─── bulk WhatsApp broadcast to clinic owners ─── */
export function PlatformBroadcast({
  clinics,
}: {
  clinics: { id: string; label: string; phone: boolean; group: "expiring" | "overdue" | "ok" }[];
}) {
  const [pending, start] = useTransition();
  const [audience, setAudience] = useState<"all" | "expiring" | "overdue">("all");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ sent: number; total: number; fails: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const targets = clinics.filter((c) => c.phone && (audience === "all" || c.group === audience));

  function send() {
    setErr(null); setResult(null);
    start(async () => {
      const r = await sendClinicWhatsApp(targets.map((t) => t.id), text);
      if (!r.ok) { setErr(r.reason); return; }
      setResult({
        sent: r.sentCount,
        total: r.results.length,
        fails: r.results.filter((x) => !x.sent).map((x) => `${x.clinic} (${x.reason})`),
      });
      if (r.sentCount > 0) setText("");
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem", maxWidth: 640 }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-4">
        <Send className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        رسالة جماعية لأصحاب العيادات
      </h3>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        {([["all", "كل العيادات"], ["expiring", "تجارب تنتهي ≤7 أيام"], ["overdue", "منتهي اشتراكهم"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setAudience(k)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg"
            style={{
              background: audience === k ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${audience === k ? "rgba(45,212,191,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: audience === k ? "#5dd9cb" : "var(--text-3)",
            }}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
        سيستقبلها <span className="font-bold ltr-nums text-white">{targets.length}</span> عيادة (اللي لها رقم مسجّل)
      </p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="field" style={{ resize: "vertical" }}
        placeholder="مثال: تحديث جديد في طود 🎉 — غرفة انتظار بمناداة واتساب ونظام ولاء ذكي. جرّبوها اليوم!" />

      {err && <p className="text-[12px] font-semibold mt-3" style={{ color: "#fda4b4" }}>{err}</p>}
      {result && (
        <div className="rounded-xl px-3 py-2.5 mt-3" style={{ background: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.2)" }}>
          <p className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "#5dd9cb" }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> أُرسلت لـ {result.sent} من {result.total}
          </p>
          {result.fails.length > 0 && (
            <p className="text-[11px] mt-1" style={{ color: "#fcd34d" }}>لم تصل: {result.fails.join("، ")}</p>
          )}
        </div>
      )}

      <button onClick={send} disabled={pending || !text.trim() || targets.length === 0} className="btn-primary w-full mt-4">
        <Send className="w-4 h-4" /> {pending ? "جارٍ الإرسال…" : `إرسال لـ ${targets.length} عيادة`}
      </button>
      <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-4)" }}>
        ملاحظة واتساب: خارج نافذة 24 ساعة قد تتطلب Meta قالباً معتمداً — النتائج تُعرض بصدق لكل رقم
      </p>
    </div>
  );
}
