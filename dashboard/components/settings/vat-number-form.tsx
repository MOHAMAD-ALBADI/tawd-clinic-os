"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReceiptText, Save, CheckCircle2 } from "lucide-react";
import { updateVatNumber } from "@/app/actions/accountant";

export function VatNumberForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setSaved(false);
    start(async () => {
      try {
        await updateVatNumber(value);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center gap-3 mb-1.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.22)" }}>
          <ReceiptText className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        </div>
        <div>
          <p className="font-bold text-white">الرقم الضريبي (VATIN)</p>
          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
            يظهر على الفواتير المطبوعة — مطلوب للفاتورة الضريبية المبسطة في عُمان
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="OM11xxxxxxxx"
          className="field flex-1 ltr-nums"
        />
        <button
          onClick={save}
          disabled={pending || value === (current ?? "")}
          className="btn-primary shrink-0"
          style={saved ? { background: "linear-gradient(135deg, #34d399, #10b981)", borderColor: "rgba(52,211,153,0.5)" } : undefined}
        >
          {saved ? <><CheckCircle2 className="w-4 h-4" /> تم الحفظ</> : <><Save className="w-4 h-4" /> {pending ? "…" : "حفظ"}</>}
        </button>
      </div>
      {err && <p className="text-[11px] mt-2" style={{ color: "#fda4b4" }}>{err}</p>}
    </div>
  );
}
