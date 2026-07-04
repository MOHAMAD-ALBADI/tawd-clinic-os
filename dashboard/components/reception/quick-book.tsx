"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, Search } from "lucide-react";
import { bookQuick } from "@/app/actions/reception";

type PatientOpt = { id: string; name: string; phone: string | null };
type Opt = { id: string; label: string };

/** Desk booking — availability-checked server-side (overlap + schedules + leaves). */
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
  const [ok, setOk] = useState<string | null>(null);
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

  function submit() {
    if (mode === "existing" && !form.patientId) { alert("اختر المريض"); return; }
    if (mode === "new" && !form.name.trim()) { alert("اسم المريض مطلوب"); return; }
    setOk(null);
    start(async () => {
      try {
        const r = await bookQuick({
          patientId: mode === "existing" ? form.patientId : undefined,
          name: mode === "new" ? form.name : undefined,
          phone: mode === "new" ? form.phone : undefined,
          serviceId: form.serviceId,
          doctorId: form.doctorId,
          date: form.date,
          time: form.time,
        });
        if (!r.ok) { alert(r.reason); return; }
        setOk(`تم الحجز ✓ — ${r.doctor} · ${form.date} ${form.time}`);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
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
            onClick={() => setMode(m)}
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
            <div className="badge badge-brand">{selected.name} {selected.phone ? `· ${selected.phone}` : ""}</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setForm((f) => ({ ...f, patientId: p.id }))}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}
                >
                  {p.name}
                </button>
              ))}
              {filtered.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-4)" }}>لا نتائج — سجّله كمريض جديد</p>}
            </div>
          )}
          {selected && (
            <button onClick={() => setForm((f) => ({ ...f, patientId: "" }))} className="text-[11px]" style={{ color: "var(--text-4)" }}>
              تغيير المريض
            </button>
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

      {ok && <div className="badge badge-ok mt-4"><CheckCircle2 className="w-3 h-3" /> {ok}</div>}

      <button onClick={submit} disabled={pending} className="btn-primary w-full mt-4">
        <CalendarPlus className="w-4 h-4" />
        {pending ? "جارٍ التحقق من التوفر…" : "تأكيد الحجز"}
      </button>
      <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-4)" }}>
        يتحقق تلقائياً من تعارض المواعيد ودوام الطبيب وإجازاته
      </p>
    </div>
  );
}
