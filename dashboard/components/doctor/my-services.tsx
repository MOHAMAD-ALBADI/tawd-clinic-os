"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Save, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { setMyServices } from "@/app/actions/doctor-services";

export type ClinicService = {
  id: string; name: string; price: number; durationMinutes: number | null;
  /** does any doctor in the clinic have this service mapped? */
  mappedByAnyone: boolean;
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** What this doctor can be booked for.

    Reception and the public page already filter on this table; nothing could
    edit it. A doctor could be quietly removed from a service by a mapping
    someone else created and never find out. */
export function MyServices({
  services, mine,
}: { services: ClinicService[]; mine: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>(mine);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const dirty =
    picked.length !== mine.length || picked.some((id) => !mine.includes(id));

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setMyServices(picked);
      if (!r.ok) { setMsg({ text: r.reason, bad: true }); return; }
      setMsg({ text: `حُفظت — أنت مُتاح لـ ${r.count} خدمة` });
      setTimeout(() => setMsg(null), 4000);
      router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="section-title mb-1">
        <Scissors className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>الخدمات التي أقدّمها</h2>
      </div>
      <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
        تحدّد ما يستطيع الاستقبال وصفحة الحجز وسُرى حجزه معك
      </p>

      {msg && (
        <div className="flex items-center gap-2 text-[12.5px] px-4 py-2.5 rounded-xl mb-3"
          style={msg.bad
            ? { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }
            : { background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          {msg.bad ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {msg.text}
        </div>
      )}

      {/* The fallback is load-bearing and invisible, so it is stated. */}
      {picked.length === 0 && (
        <div className="flex items-start gap-2 text-[12px] px-3.5 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.22)", color: "#7dd3fc" }}>
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          لم تحدّد شيئاً — تبقى متاحاً لأي خدمة لم يحدّدها طبيب آخر. بمجرد أن يحدّد
          زميل خدمةً ما، تختفي أنت منها ما لم تخترها هنا.
        </div>
      )}

      {services.length === 0 ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--text-4)" }}>
          لا خدمات مفعّلة في العيادة بعد
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-1.5">
          {services.map((s) => {
            const on = picked.includes(s.id);
            /* A service somebody else claimed and this doctor has not is one
               they are currently not bookable for — worth seeing at a glance. */
            const excluded = !on && s.mappedByAnyone;
            return (
              <button key={s.id} type="button" onClick={() => toggle(s.id)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-start transition-colors"
                style={{
                  background: on ? "rgb(var(--accent-1-rgb) / 0.07)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.28)" : "var(--hairline)"}`,
                }}>
                <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{
                    background: on ? "var(--accent-2)" : "transparent",
                    border: `1px solid ${on ? "var(--accent-2)" : "var(--hairline)"}`,
                  }}>
                  {on && <CheckCircle2 className="w-3 h-3 text-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate" style={{ color: on ? "#ffffff" : "var(--text-2)" }}>
                    {s.name}
                  </p>
                  <p className="text-[10.5px] ltr-nums" style={{ color: "var(--text-4)" }}>
                    {omr(s.price)} ر.ع{s.durationMinutes ? ` · ${s.durationMinutes} د` : ""}
                    {excluded ? " · لست متاحاً لها" : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <p className="text-[11px] ltr-nums" style={{ color: "var(--text-4)" }}>
          {picked.length} / {services.length}
        </p>
        <button className="btn-primary" disabled={pending || !dirty} onClick={save}
          style={!dirty ? { opacity: 0.45, cursor: "not-allowed" } : undefined}>
          <Save className="w-4 h-4" /> {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
