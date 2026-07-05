"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, Search, AlertCircle, Clock } from "lucide-react";
import { bookQuick } from "@/app/actions/reception";

type PatientOpt = { id: string; name: string; phone: string | null };
type Opt = { id: string; label: string };

/** Desk booking — availability-checked server-side (overlap + schedules + leaves).
    All feedback is in-app: no browser dialogs. */
export function QuickBook({
  patients,
  services,
  doctors,
}: {
  patients: PatientOpt[];
  services: Opt[];
  doctors: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [alts, setAlts] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ patient: string; doctor: string; service: string; date: string; time: string } | null>(null);
  const [form, setForm] = useState({
    patientId: "",
    name: "",
    phone: "",
    serviceId: services[0]?.id ?? "",
    doctorId: "any" as string,
    date: new Date(Date.now() + 86_400_000).toISOString().split("T")[0],
    time: "10:00",
  });

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return patients.slice(0, 8);
    return patients
      .filter((p) => p.name.includes(q) || (p.phone ?? "").includes(q))
      .slice(0, 8);
  }, [patients, search]);

  const selected = patients.find((p) => p.id === form.patientId);

  function submit(timeOverride?: string) {
    const time = timeOverride ?? form.time;
    if (timeOverride) setForm((p) => ({ ...p, time: timeOverride }));
    if (mode === "existing" && !form.patientId) { setErr("اختر المريض أولاً"); return; }
    if (mode === "new" && !form.name.trim()) { setErr("اسم المريض مطلوب"); return; }
    setErr(null); setAlts([]);
    start(async () => {
      try {
        const r = await bookQuick({
          patientId: mode === "existing" ? form.patientId : undefined,
          name: mode === "new" ? form.name : undefined,
          phone: mode === "new" ? form.phone : undefined,
          serviceId: form.serviceId,
          doctorId: form.doctorId,
          date: form.date,
          time,
        });
        if (!r.ok) {
          setErr(r.reason);
          setAlts(("alternatives" in r ? r.alternatives : []) ?? []);
          return;
        }
        setSuccess({
          patient: mode === "existing" ? (selected?.name ?? "المريض") : form.name,
          doctor: r.doctor,
          service: r.service ?? "",
          date: form.date,
          time,
        });
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  function reset() {
    setSuccess(null); setErr(null); setAlts([]);
    setForm((p) => ({ ...p, patientId: "", name: "", phone: "" }));
    setSearch("");
  }

  /* ── success card ── */
  if (success) {
    const dateAr = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long" })
      .format(new Date(success.date + "T12:00:00"));
    return (
      <div className="panel-feature text-center" style={{ padding: "2.25rem", maxWidth: 620 }}>
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--accent-1)" }} />
        <p className="text-xl font-bold text-white mb-2">تم الحجز بنجاح</p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          <span className="font-bold text-white">{success.patient}</span>
          {" · "}{success.service}
          <br />
          {dateAr} · <span className="ltr-nums font-bold text-white">{success.time}</span>
          {" · "}{success.doctor}
        </p>
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={reset} className="btn-primary">
            <CalendarPlus className="w-4 h-4" /> حجز موعد آخر
          </button>
          <a href="/reception" className="btn-ghost">رجوع للوحة</a>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: "1.5rem", maxWidth: 620 }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-4">
        <CalendarPlus className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        حجز موعد
      </h3>

      {/* patient picker */}
      <div className="flex gap-1.5 mb-3">
        {([["existing", "مريض مسجّل"], ["new", "مريض جديد"]] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => { setMode(m); setErr(null); }}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: mode === m ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${mode === m ? "rgba(45,212,191,0.3)" : "rgba(255,255,255,0.07)"}`,
              color: mode === m ? "#5dd9cb" : "var(--text-3)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 end-3" style={{ color: "var(--text-4)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field"
              placeholder="ابحث بالاسم أو الجوال…"
            />
          </div>
          {selected ? (
            <div className="flex items-center gap-2">
              <span className="badge badge-brand">{selected.name} {selected.phone ? `· ${selected.phone}` : ""}</span>
              <button onClick={() => setForm((f) => ({ ...f, patientId: "" }))} className="text-[11px]" style={{ color: "var(--text-4)" }}>
                تغيير
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setForm((f) => ({ ...f, patientId: p.id })); setErr(null); }}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}
                >
                  {p.name}
                </button>
              ))}
              {filtered.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-4)" }}>لا نتائج — سجّله كمريض جديد</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الاسم *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="field" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الجوال</label>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="field ltr-nums" dir="ltr" placeholder="+968…" />
          </div>
        </div>
      )}

      {/* booking details */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الخدمة</label>
          <select value={form.serviceId} onChange={(e) => setForm((p) => ({ ...p, serviceId: e.target.value }))} className="field">
            {services.map((s) => <option key={s.id} value={s.id} style={{ background: "#131315" }}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الطبيب</label>
          <select value={form.doctorId} onChange={(e) => setForm((p) => ({ ...p, doctorId: e.target.value }))} className="field">
            <option value="any" style={{ background: "#131315" }}>أول طبيب متاح</option>
            {doctors.map((d) => <option key={d.id} value={d.id} style={{ background: "#131315" }}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>التاريخ</label>
          <input type="date" value={form.date} min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="field ltr-nums" />
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الوقت</label>
          <input type="time" value={form.time}
            onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} className="field ltr-nums" />
        </div>
      </div>

      {/* in-app feedback */}
      {err && (
        <div className="rounded-xl px-4 py-3 mt-4" style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.22)" }}>
          <p className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "#fda4b4" }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            {err}
          </p>
          {alts.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                <Clock className="w-3 h-3" /> أوقات متاحة نفس اليوم — اضغط للحجز مباشرة:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {alts.map((t) => (
                  <button
                    key={t}
                    onClick={() => submit(t)}
                    disabled={pending}
                    className="text-[12px] font-bold ltr-nums px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.3)", color: "#5dd9cb" }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={() => submit()} disabled={pending} className="btn-primary w-full mt-4">
        <CalendarPlus className="w-4 h-4" />
        {pending ? "جارٍ التحقق من التوفر…" : "تأكيد الحجز"}
      </button>
      <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-4)" }}>
        يتحقق تلقائياً من تعارض المواعيد ودوام الطبيب وإجازاته
      </p>
    </div>
  );
}
