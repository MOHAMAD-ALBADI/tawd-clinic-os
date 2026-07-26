"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { addClinicHoliday, removeClinicHoliday } from "@/app/actions/clinic-settings";

export type Holiday = { id: string; holiday_date: string; name_ar: string | null; name: string };

const AR_DATE = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long" });

export function ClinicHolidays({ holidays }: { holidays: Holiday[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function add() {
    setErr(null);
    start(async () => {
      const r = await addClinicHoliday({ date, nameAr: label });
      if (!r.ok) { setErr(r.reason); return; }
      setDate(""); setLabel("");
      /* The closure blocks new bookings immediately; appointments already on the
         books are the manager's to call. Saying nothing here would let them
         believe the day was cleared. */
      setFlash(r.existingAppointments > 0
        ? `سُجّل الإغلاق — لكن ${r.existingAppointments} موعد محجوز في ذلك اليوم يحتاج اتصالاً`
        : "سُجّل الإغلاق — لن يُقبل أي حجز في هذا اليوم");
      setTimeout(() => setFlash(null), 6000);
      router.refresh();
    });
  }

  function remove(id: string) {
    setErr(null);
    start(async () => {
      const r = await removeClinicHoliday(id);
      if (!r.ok) { setErr(r.reason); return; }
      router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="section-title mb-1">
        <CalendarX2 className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>أيام إغلاق العيادة</h2>
      </div>
      <p className="text-[11.5px] mb-4" style={{ color: "var(--text-4)" }}>
        الأعياد والإجازات. سُرى وصفحة الحجز والاستقبال — كلهم يتخطّون هذه الأيام تلقائياً
      </p>

      {flash && (
        <div className="flex items-start gap-2 text-[12.5px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-[12.5px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
        </div>
      )}

      <div className="flex items-end gap-2 flex-wrap mb-4">
        <div style={{ minWidth: 150 }}>
          <label className="block text-[11.5px] mb-1.5" style={{ color: "var(--text-3)" }}>التاريخ</label>
          <input type="date" className="field" value={date} min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex-1" style={{ minWidth: 180 }}>
          <label className="block text-[11.5px] mb-1.5" style={{ color: "var(--text-3)" }}>السبب</label>
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="عيد الفطر · اليوم الوطني · صيانة" />
        </div>
        <button className="btn-primary" disabled={pending || !date || !label.trim()} onClick={add}>
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>

      {holidays.length === 0 ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--text-4)" }}>
          لا أيام إغلاق مسجّلة — العيادة تستقبل الحجوزات كل يوم ضمن أوقات العمل
        </p>
      ) : (
        <div className="space-y-1.5">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
              <CalendarX2 className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate">{h.name_ar ?? h.name}</p>
                <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                  {AR_DATE.format(new Date(`${h.holiday_date}T12:00:00`))}
                  <span className="ltr-nums"> · {h.holiday_date}</span>
                </p>
              </div>
              <button className="btn-ghost" disabled={pending} title="إلغاء الإغلاق" onClick={() => remove(h.id)}>
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
