"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, CheckCircle2, AlertCircle, Clock, MessageCircle } from "lucide-react";
import { publicBook } from "@/app/actions/public-booking";

type Opt = { id: string; label: string; price?: number };

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function PublicBookingForm({
  slug, services, doctors,
}: {
  slug: string;
  services: Opt[];
  doctors: Opt[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [alts, setAlts] = useState<string[]>([]);
  const [ok, setOk] = useState<{ doctor: string; service: string; when: string } | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "",
    serviceId: services[0]?.id ?? "",
    doctorId: "any" as string,
    date: new Date(Date.now() + 86_400_000).toISOString().split("T")[0],
    time: "10:00",
  });

  function submit(timeOverride?: string) {
    const time = timeOverride ?? form.time;
    if (timeOverride) setForm((f) => ({ ...f, time: timeOverride }));
    if (!form.name.trim()) { setErr("الرجاء إدخال الاسم"); return; }
    if (!form.phone.trim()) { setErr("الرجاء إدخال رقم الجوال"); return; }
    setErr(null); setAlts([]);
    start(async () => {
      try {
        const r = await publicBook({ slug, serviceId: form.serviceId, doctorId: form.doctorId, date: form.date, time, name: form.name, phone: form.phone });
        if (!r.ok) { setErr(r.reason); setAlts(("alternatives" in r ? r.alternatives : []) ?? []); return; }
        setOk({ doctor: r.doctor, service: r.service, when: r.when });
      } catch { setErr("تعذّر الاتصال — حاول مجدداً"); }
    });
  }

  if (ok) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: "var(--accent-1)" }} />
        <p className="text-2xl font-bold text-white mb-2">تم حجز موعدك 🎉</p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-2)" }}>
          {ok.service} · {ok.doctor}<br />
          🗓️ {ok.when}
        </p>
        <p className="badge badge-brand inline-flex">
          <MessageCircle className="w-3 h-3" /> وصلك تأكيد على الواتساب
        </p>
        <p className="text-[11px] mt-5" style={{ color: "var(--text-4)" }}>
          لأي تعديل أو إلغاء، تواصل مع العيادة أو ردّ على رسالة سُرى
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-semibold block mb-1" style={{ color: "var(--text-2)" }}>الاسم *</label>
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="field" placeholder="اسمك الكامل" />
        </div>
        <div>
          <label className="text-[12px] font-semibold block mb-1" style={{ color: "var(--text-2)" }}>الجوال *</label>
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="field ltr-nums" dir="ltr" placeholder="+9689xxxxxxx" />
        </div>
      </div>

      <div>
        <label className="text-[12px] font-semibold block mb-1" style={{ color: "var(--text-2)" }}>الخدمة</label>
        <select value={form.serviceId} onChange={(e) => setForm((p) => ({ ...p, serviceId: e.target.value }))} className="field">
          {services.map((s) => (
            <option key={s.id} value={s.id} style={{ background: "#131315" }}>
              {s.label}{s.price ? ` — ${fmt(s.price)} ر.ع` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[12px] font-semibold block mb-1" style={{ color: "var(--text-2)" }}>الطبيب</label>
          <select value={form.doctorId} onChange={(e) => setForm((p) => ({ ...p, doctorId: e.target.value }))} className="field">
            <option value="any" style={{ background: "#131315" }}>أي طبيب متاح</option>
            {doctors.map((d) => <option key={d.id} value={d.id} style={{ background: "#131315" }}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[12px] font-semibold block mb-1" style={{ color: "var(--text-2)" }}>التاريخ</label>
          <input type="date" value={form.date} min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="field ltr-nums" />
        </div>
        <div>
          <label className="text-[12px] font-semibold block mb-1" style={{ color: "var(--text-2)" }}>الوقت</label>
          <input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} className="field ltr-nums" />
        </div>
      </div>

      {err && (
        <div className="rounded-xl px-4 py-3" style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.22)" }}>
          <p className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "#fda4b4" }}>
            <AlertCircle className="w-4 h-4 shrink-0" /> {err}
          </p>
          {alts.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                <Clock className="w-3 h-3" /> أوقات متاحة — اضغط للحجز:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {alts.map((t) => (
                  <button key={t} onClick={() => submit(t)} disabled={pending}
                    className="text-[12px] font-bold ltr-nums px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.3)", color: "#5dd9cb" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={() => submit()} disabled={pending} className="btn-primary w-full" style={{ padding: "0.8rem" }}>
        <CalendarCheck className="w-4 h-4" />
        {pending ? "جارٍ الحجز…" : "تأكيد الحجز"}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--text-4)" }}>
        بالضغط على تأكيد، توافق على استقبال رسالة تأكيد على الواتساب
      </p>
    </div>
  );
}
