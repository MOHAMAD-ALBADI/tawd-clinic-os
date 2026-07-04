import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { CheckinButton } from "@/components/reception/checkin-button";
import { WaitingRoom, type QueueEntry } from "@/components/reception/waiting-room";
import { WalkinDialog } from "@/components/reception/walkin-dialog";
import { EmergencyAlerts } from "@/components/dashboard/emergency-alerts";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { CalendarPlus, ClipboardList, Hourglass } from "lucide-react";

export const metadata = { title: "لوحة الاستقبال — طود" };

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: "مجدول",  color: "#a1a1aa" },
  confirmed:   { label: "مؤكد",   color: "#e4e4e7" },
  checked_in:  { label: "وصل",    color: "#5dd9cb" },
  in_progress: { label: "جارٍ",   color: "#2dd4bf" },
  completed:   { label: "مكتمل",  color: "#5dd9cb" },
  cancelled:   { label: "ملغي",   color: "#71717a" },
  no_show:     { label: "لم يحضر", color: "#fda4b4" },
};

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

const relMin = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `منذ ${m} د` : `منذ ${Math.round(m / 60)} س`;
};

export default async function ReceptionPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const [apptsRes, queueRes, alertsRes, waitlistRes, doctorsRes, servicesRes, patientsRes] = await Promise.all([
    sb.from("appointments")
      .select("id, slot_time, status, patient_id, patients!patient_id(name, phone), services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar, name)")
      .eq("clinic_id", claims.clinic_id)
      .gte("slot_time", `${today}T00:00:00`).lte("slot_time", `${today}T23:59:59`)
      .is("deleted_at", null).order("slot_time"),
    sb.from("waiting_queue")
      .select("id, queue_position, status, check_in_at, patients!patient_id(name), appointments!appt_id(services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar, name))")
      .eq("clinic_id", claims.clinic_id)
      .in("status", ["waiting", "called", "in_room"])
      .gte("check_in_at", `${today}T00:00:00`)
      .order("queue_position"),
    sb.from("sura_alerts")
      .select("id, kind, phone, patient_name, message, created_at")
      .eq("clinic_id", claims.clinic_id).in("kind", ["emergency", "complaint"]).eq("status", "open")
      .order("created_at", { ascending: false }).limit(10),
    sb.from("appointment_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", claims.clinic_id).eq("status", "waiting"),
    sb.from("tawd_staff_users").select("id, name, name_ar")
      .eq("clinic_id", claims.clinic_id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null),
    sb.from("services").select("id, name_ar").eq("clinic_id", claims.clinic_id).eq("is_active", true).order("name_ar"),
    sb.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", claims.clinic_id).is("deleted_at", null),
  ]);

  const appts = apptsRes.data ?? [];
  const doctors = (doctorsRes.data ?? []).map((d) => ({ id: d.id, label: (d.name_ar ?? d.name) as string }));
  const services = (servicesRes.data ?? []).map((s) => ({ id: s.id, label: s.name_ar as string }));

  const queue: QueueEntry[] = (queueRes.data ?? []).map((q) => {
    const appt = q.appointments as unknown as {
      services?: { name_ar?: string } | null;
      tawd_staff_users?: { name_ar?: string; name?: string } | null;
    } | null;
    return {
      id: q.id,
      position: q.queue_position,
      status: q.status,
      patientName: (q.patients as unknown as { name?: string } | null)?.name ?? "مريض",
      serviceName: appt?.services?.name_ar ?? null,
      doctorName: appt?.tawd_staff_users?.name_ar ?? appt?.tawd_staff_users?.name ?? null,
      waitingSince: relMin(q.check_in_at),
    };
  });

  const relTime = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 1 ? "الآن" : h < 24 ? `منذ ${h} ساعة` : `منذ ${Math.floor(h / 24)} يوم`;
  };
  const alerts = (alertsRes.data ?? []).map((a) => ({
    id: a.id, kind: a.kind ?? "emergency", phone: a.phone ?? null,
    patientName: a.patient_name ?? null, message: a.message ?? null, ago: relTime(a.created_at),
  }));

  const upcoming = appts.filter((a) => ["scheduled", "confirmed"].includes(a.status));
  const inClinic = appts.filter((a) => ["checked_in", "in_progress"].includes(a.status)).length;
  const completed = appts.filter((a) => a.status === "completed").length;
  const next = upcoming.find((a) => new Date(a.slot_time) > new Date()) ?? upcoming[0] ?? null;

  const todayAr = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <EmergencyAlerts alerts={alerts} />

      {/* ══ command strip ══ */}
      <div className="panel-feature relative overflow-hidden" style={{ padding: "1.5rem 1.75rem" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>{todayAr}</p>
            <h1 className="text-xl font-bold text-white mt-1">لوحة الاستقبال</h1>
            {next ? (
              <p className="text-[12px] mt-1.5" style={{ color: "var(--text-3)" }}>
                القادم: <span className="font-bold text-white">{(next.patients as unknown as { name?: string } | null)?.name ?? "مريض"}</span>
                {" · "}
                <span className="ltr-nums font-bold" style={{ color: "#5dd9cb" }}>{fmtTime(next.slot_time)}</span>
              </p>
            ) : (
              <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>لا مواعيد قادمة اليوم</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/reception/book" className="btn-primary">
              <CalendarPlus className="w-4 h-4" />
              حجز موعد
            </Link>
            <WalkinDialog services={services} doctors={doctors} />
          </div>
        </div>

        <div className="flex items-center gap-5 mt-5 flex-wrap">
          {[
            { l: "مواعيد اليوم", v: appts.length },
            { l: "بانتظار الوصول", v: upcoming.length },
            { l: "داخل العيادة", v: inClinic },
            { l: "مكتمل", v: completed },
            { l: "قائمة انتظار الحجز", v: waitlistRes.count ?? 0 },
          ].map((s, i) => (
            <div key={s.l} className="flex items-baseline gap-2">
              {i > 0 && <span className="w-px h-4 -ms-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />}
              <span className="text-lg font-bold ltr-nums text-white">{s.v}</span>
              <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ main grid ══ */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* today board */}
        <div className="col-span-12 lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>مواعيد اليوم</h2>
            <span className="live-dot" />
          </div>

          {appts.length === 0 ? (
            <div className="text-center py-14">
              <ClipboardList className="w-9 h-9 mx-auto mb-3" style={{ color: "var(--text-4)" }} />
              <p className="text-sm" style={{ color: "var(--text-3)" }}>لا مواعيد اليوم</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {appts.map((a) => {
                const st = STATUS[a.status] ?? STATUS.scheduled;
                const p = a.patients as unknown as { name?: string; phone?: string } | null;
                const svcName = (a.services as unknown as { name_ar?: string } | null)?.name_ar ?? "";
                const doc = a.tawd_staff_users as unknown as { name_ar?: string; name?: string } | null;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl flex-wrap"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <span className="text-[13px] font-bold ltr-nums w-16 shrink-0 text-white">{fmtTime(a.slot_time)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{p?.name ?? "مريض"}</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
                        {svcName}{doc ? ` · ${doc.name_ar ?? doc.name}` : ""}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                      style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: st.color }}
                    >
                      <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                      {st.label}
                    </span>
                    {["scheduled", "confirmed"].includes(a.status) && (
                      <CheckinButton appointmentId={a.id} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* waiting room */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <WaitingRoom entries={queue} />

          <div className="panel flex items-center gap-3" style={{ padding: "1rem 1.25rem" }}>
            <Hourglass className="w-4 h-4 shrink-0" style={{ color: "var(--text-3)" }} />
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
              <span className="font-bold text-white ltr-nums">{waitlistRes.count ?? 0}</span> في قائمة انتظار الحجز —
              عند أي إلغاء سُرى تعرض الموعد عليهم تلقائياً
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
