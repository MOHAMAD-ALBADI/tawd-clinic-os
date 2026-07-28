"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, AlertTriangle, Banknote, CreditCard, ShieldCheck, Landmark } from "lucide-react";
import { savePaymentSettings } from "@/app/actions/clinic-settings";
import { METHODS, type PaymentMethod } from "@/lib/payment-methods";

const CHOOSABLE: PaymentMethod[] = ["cash", "card", "bank_transfer", "insurance"];

const iconFor = (m: PaymentMethod) =>
  m === "cash" ? Banknote : m === "insurance" ? ShieldCheck : CreditCard;

/** Which methods the desk offers, and the account a transfer goes to.

    The cashier offered every clinic the same two buttons, so a clinic with no
    card machine had a card button and one that takes transfers had nowhere to
    keep the account — the receptionist recited it from memory, which is how a
    patient's money ends up somewhere else. */
export function PaymentMethodsForm({ initial }: {
  initial: {
    methods: string[] | null;
    bankName: string | null;
    accountName: string | null;
    iban: string | null;
    phone: string | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  /* Null means "never configured", which the cashier reads as "offer everything".
     Pre-ticking all of them keeps the form honest about what the desk does now. */
  const [methods, setMethods] = useState<Set<PaymentMethod>>(
    new Set((initial.methods?.length ? initial.methods : CHOOSABLE) as PaymentMethod[]),
  );
  const [bankName, setBankName] = useState(initial.bankName ?? "");
  const [accountName, setAccountName] = useState(initial.accountName ?? "");
  const [iban, setIban] = useState(initial.iban ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const takesTransfer = methods.has("bank_transfer");
  const transferIncomplete = takesTransfer && !iban.trim() && !phone.trim();

  function toggle(m: PaymentMethod) {
    setMethods((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  }

  function save() {
    setMsg(null);
    start(async () => {
      const r = await savePaymentSettings({
        methods: [...methods],
        bankName: bankName.trim() || null,
        accountName: accountName.trim() || null,
        iban: iban.trim() || null,
        phone: phone.trim() || null,
      });
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setMsg({ text: "حُفظت طرق الدفع ✓" });
      setTimeout(() => setMsg(null), 4000);
      router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="section-title mb-1">
        <Landmark className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>طرق الدفع</h2>
      </div>
      <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
        ما تُحدّده هنا هو ما يظهر للكاشير عند التحصيل
      </p>

      <div className="grid sm:grid-cols-2 gap-2 mb-5">
        {CHOOSABLE.map((m) => {
          const on = methods.has(m);
          const meta = METHODS[m];
          const Icon = iconFor(m);
          return (
            <button key={m} type="button" onClick={() => toggle(m)}
              className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-start transition-colors"
              style={{
                background: on ? "rgb(var(--accent-1-rgb) / 0.07)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.28)" : "var(--hairline)"}`,
              }}>
              <Icon className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: on ? "var(--accent-1)" : "var(--text-4)" }} />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold"
                  style={{ color: on ? "#ffffff" : "var(--text-4)" }}>{meta.label}</span>
                <span className="block text-[10.5px]" style={{ color: "var(--text-4)" }}>{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {methods.size === 0 && (
        <p className="flex items-start gap-2 text-[11.5px] mb-4 px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          لم تُحدَّد أي طريقة — سيعرض الكاشير كل الطرق، لأن إيقاف التحصيل بالكامل
          ليس ما يقصده أحد.
        </p>
      )}

      {takesTransfer && (
        <div className="space-y-3">
          <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
            بيانات الحساب — تظهر للموظف على الشاشة ليقرأها على المريض
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="اسم البنك" value={bankName} onChange={setBankName} placeholder="بنك مسقط" />
            <Field label="اسم الحساب" value={accountName} onChange={setAccountName} placeholder="عيادة …" />
          </div>
          <Field label="رقم الآيبان" value={iban} onChange={setIban} ltr placeholder="OM…" />
          <Field label="رقم التحويل (هاتف/محفظة)" value={phone} onChange={setPhone} ltr placeholder="9xxxxxxx" />

          {transferIncomplete && (
            <p className="flex items-start gap-2 text-[11.5px] px-3.5 py-2.5 rounded-xl"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              التحويل مفعّل بلا آيبان ولا رقم — الموظف لن يجد ما يعطيه للمريض.
            </p>
          )}
        </div>
      )}

      {msg && (
        <p className="flex items-center gap-1.5 text-[12px] mt-4"
          style={{ color: msg.bad ? "#fda4b4" : "var(--accent-1)" }}>
          {msg.bad ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {msg.text}
        </p>
      )}

      <button className="btn-primary mt-4" disabled={pending} onClick={save}>
        <Save className="w-4 h-4" /> {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, ltr,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; ltr?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
        {label}
      </label>
      <input className={`field ${ltr ? "ltr-nums" : ""}`} dir={ltr ? "ltr" : undefined}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
