import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/* Everything the doctor's day screen needs, in one place.

   The old page fetched today's appointments and rendered them. That is a
   timetable, and a doctor already has one on the wall. What a clinical
   dashboard is for is the other half: what is unfinished, what is overdue, and
   what is about to go wrong — the queue that is building, the visit from
   Tuesday with no note on it, the prescription still unsigned, the accepted
   treatment plan nobody has booked the next step for.

   Windows are deliberately short. A doctor acts on this morning and last week;
   anything older belongs in a report, not on the screen they open between
   patients. */

export type DayAppt = {
  id: string;
  slotTime: string;
  status: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  service: string | null;
  durationMinutes: number | null;
  allergies: string[];
  chronic: string[];
  /** how long they have been sitting in the waiting room, in minutes */
  waitingMinutes: number | null;
  queuePosition: number | null;
  visitsBefore: number;
};

export type DoctorTask = {
  kind: "undocumented" | "unsigned_rx" | "stalled_plan" | "running_late";
  label: string;
  detail: string;
  href: string;
  urgent: boolean;
  when: string | null;
};

export type DoctorDay = {
  appts: DayAppt[];
  tasks: DoctorTask[];
  /** the exam in progress, else the next patient to see */
  focus: DayAppt | null;
  focusIsLive: boolean;
  done: number;
  remaining: number;
  waiting: number;
  monthDone: number;
  /** minutes of booked chair time today */
  bookedMinutes: number;
};

const AR_TIME = new Intl.DateTimeFormat("ar", {
  timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true,
});
const AR_DAY = new Intl.DateTimeFormat("ar", {
  timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long",
});
export const fmtTime = (iso: string) => AR_TIME.format(new Date(iso));
export const fmtDay = (iso: string) => AR_DAY.format(new Date(iso));

/** Muscat is UTC+4 with no DST, so the clinic's day is a fixed offset window.
    toISOString().slice(0,10) would give the UTC day and lose 00:00–04:00. */
function muscatDayBounds(d = new Date()) {
  const local = new Date(d.getTime() + 4 * 3600_000);
  const day = local.toISOString().slice(0, 10);
  return { day, from: `${day}T00:00:00+04:00`, to: `${day}T23:59:59+04:00` };
}

type Joined = { name: string; phone: string | null } | null;

export async function getDoctorDay(doctorId: string, clinicId: string): Promise<DoctorDay> {
  const sb = await createServerSupabaseClient();
  const now = Date.now();
  const { day, from, to } = muscatDayBounds();
  const monthStart = `${day.slice(0, 7)}-01T00:00:00+04:00`;
  const twoWeeksAgo = new Date(now - 14 * 86_400_000).toISOString();

  const [
    { data: todayRows },
    { data: monthRows },
    { data: recentDone },
    { data: notes },
    { data: rx },
    { data: planItems },
  ] = await Promise.all([
    sb.from("appointments")
      .select("id, slot_time, status, patient_id, duration_minutes, patients(name, phone), services(name_ar)")
      .eq("doctor_id", doctorId).is("deleted_at", null)
      .gte("slot_time", from).lte("slot_time", to)
      .order("slot_time"),

    sb.from("appointments")
      .select("status").eq("doctor_id", doctorId).is("deleted_at", null)
      .gte("slot_time", monthStart).limit(2000),

    /* the fortnight behind, for documentation gaps */
    sb.from("appointments")
      .select("id, slot_time, patient_id, patients(name)")
      .eq("doctor_id", doctorId).eq("status", "completed").is("deleted_at", null)
      .gte("slot_time", twoWeeksAgo).order("slot_time", { ascending: false }).limit(200),

    sb.from("patient_notes")
      .select("patient_id, created_at").eq("doctor_id", doctorId)
      .gte("created_at", twoWeeksAgo).limit(500),

    sb.from("prescriptions")
      .select("id, patient_id, created_at, patients(name)")
      .eq("doctor_id", doctorId).is("signed_at", null).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(20),

    /* accepted plans with work still outstanding and nothing booked */
    sb.from("treatment_plan_items")
      .select("id, plan_id, description, status, treatment_plans!plan_id(id, patient_id, status, doctor_id, patients(name))")
      .eq("clinic_id", clinicId).eq("status", "pending").limit(200),
  ]);

  const rows = todayRows ?? [];
  const patientIds = [...new Set(rows.map((r) => r.patient_id as string).filter(Boolean))];

  const [{ data: hist }, { data: queue }, { data: priorVisits }] = await Promise.all([
    patientIds.length
      ? sb.from("medical_histories").select("patient_id, allergies, chronic_diseases").in("patient_id", patientIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    patientIds.length
      ? sb.from("waiting_queue").select("patient_id, queue_position, status, check_in_at")
          .eq("clinic_id", clinicId).in("patient_id", patientIds).in("status", ["waiting", "called"])
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    patientIds.length
      ? sb.from("appointments").select("patient_id").eq("status", "completed")
          .is("deleted_at", null).in("patient_id", patientIds).limit(2000)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const allergyOf = new Map<string, string[]>();
  const chronicOf = new Map<string, string[]>();
  for (const h of hist ?? []) {
    const pid = h.patient_id as string;
    const a = (h.allergies as string[] | null) ?? [];
    const c = (h.chronic_diseases as string[] | null) ?? [];
    if (a.length) allergyOf.set(pid, a);
    if (c.length) chronicOf.set(pid, c);
  }
  const queueOf = new Map<string, { pos: number | null; since: string | null }>();
  for (const q of queue ?? []) {
    queueOf.set(q.patient_id as string, {
      pos: (q.queue_position as number | null) ?? null,
      since: (q.check_in_at as string | null) ?? null,
    });
  }
  const visitsOf = new Map<string, number>();
  for (const v of priorVisits ?? []) {
    const pid = v.patient_id as string;
    visitsOf.set(pid, (visitsOf.get(pid) ?? 0) + 1);
  }

  const appts: DayAppt[] = rows.map((r) => {
    const pid = r.patient_id as string;
    const q = queueOf.get(pid);
    const p = r.patients as unknown as Joined;
    return {
      id: r.id as string,
      slotTime: r.slot_time as string,
      status: r.status as string,
      patientId: pid,
      patientName: p?.name ?? "مريض",
      patientPhone: p?.phone ?? null,
      service: (r.services as unknown as { name_ar: string } | null)?.name_ar ?? null,
      durationMinutes: (r.duration_minutes as number | null) ?? null,
      allergies: allergyOf.get(pid) ?? [],
      chronic: chronicOf.get(pid) ?? [],
      waitingMinutes: q?.since ? Math.max(0, Math.floor((now - new Date(q.since).getTime()) / 60_000)) : null,
      queuePosition: q?.pos ?? null,
      visitsBefore: visitsOf.get(pid) ?? 0,
    };
  });

  /* ── the task list ── */
  const tasks: DoctorTask[] = [];

  /* A visit closed with nothing written down. Matched on the day of the visit
     rather than exactly — a note typed an hour after the patient left is still
     that visit's note. */
  const noteDays = new Set(
    (notes ?? []).map((n) => `${n.patient_id}|${String(n.created_at).slice(0, 10)}`)
  );
  for (const v of recentDone ?? []) {
    const key = `${v.patient_id}|${String(v.slot_time).slice(0, 10)}`;
    if (noteDays.has(key)) continue;
    const name = (v.patients as unknown as Joined)?.name ?? "مريض";
    const daysAgo = Math.floor((now - new Date(v.slot_time as string).getTime()) / 86_400_000);
    tasks.push({
      kind: "undocumented",
      label: `زيارة ${name} بلا توثيق`,
      detail: daysAgo === 0 ? "اليوم" : `منذ ${daysAgo} يوم`,
      href: `/doctor/patients/${v.patient_id}`,
      urgent: daysAgo >= 3,
      when: v.slot_time as string,
    });
  }

  for (const p of rx ?? []) {
    const name = (p.patients as unknown as Joined)?.name ?? "مريض";
    tasks.push({
      kind: "unsigned_rx",
      label: `وصفة ${name} غير موقّعة`,
      detail: "لا تُصرف من الصيدلية قبل التوقيع",
      href: `/doctor/patients/${p.patient_id}`,
      urgent: true,
      when: p.created_at as string,
    });
  }

  /* Plans this doctor owns, accepted, with work left and no future booking. */
  const stalled = new Map<string, { name: string; patientId: string; count: number }>();
  for (const it of planItems ?? []) {
    const plan = it.treatment_plans as unknown as
      { id: string; patient_id: string; status: string; doctor_id: string; patients: Joined } | null;
    if (!plan || plan.doctor_id !== doctorId) continue;
    if (plan.status !== "accepted" && plan.status !== "in_progress") continue;
    const cur = stalled.get(plan.id) ?? { name: plan.patients?.name ?? "مريض", patientId: plan.patient_id, count: 0 };
    cur.count++;
    stalled.set(plan.id, cur);
  }
  const bookedPatientIds = new Set(
    rows.filter((r) => ["scheduled", "confirmed"].includes(r.status as string)).map((r) => r.patient_id as string)
  );
  for (const [, s] of stalled) {
    if (bookedPatientIds.has(s.patientId)) continue;
    tasks.push({
      kind: "stalled_plan",
      label: `خطة ${s.name} متوقفة`,
      detail: `${s.count} إجراء لم يُنفَّذ ولا موعد قادم`,
      href: `/doctor/treatment-plans`,
      urgent: false,
      when: null,
    });
  }

  /* Booked, time has passed, still not checked in or seen. */
  for (const a of appts) {
    const late = Math.floor((now - new Date(a.slotTime).getTime()) / 60_000);
    if (late >= 15 && ["scheduled", "confirmed"].includes(a.status)) {
      tasks.push({
        kind: "running_late",
        label: `${a.patientName} تأخّر ${late} دقيقة`,
        detail: a.patientPhone ? `اتصل: ${a.patientPhone}` : "لا رقم مسجّل",
        href: `/doctor/patients/${a.patientId}`,
        urgent: late >= 30,
        when: a.slotTime,
      });
    }
  }

  tasks.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  const live = appts.find((a) => a.status === "in_progress") ?? null;
  const focus =
    live ??
    appts.find((a) => a.status === "checked_in") ??
    appts.find((a) => ["confirmed", "scheduled"].includes(a.status)) ??
    null;

  return {
    appts,
    tasks,
    focus,
    focusIsLive: !!live,
    done: appts.filter((a) => a.status === "completed").length,
    remaining: appts.filter((a) => ["scheduled", "confirmed", "checked_in"].includes(a.status)).length,
    waiting: appts.filter((a) => a.status === "checked_in").length,
    monthDone: (monthRows ?? []).filter((a) => a.status === "completed").length,
    bookedMinutes: appts
      .filter((a) => !["cancelled", "no_show"].includes(a.status))
      .reduce((s, a) => s + (a.durationMinutes ?? 30), 0),
  };
}
