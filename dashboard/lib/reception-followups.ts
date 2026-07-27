import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/* The front desk's actual job, which the dashboard never showed.

   Research on dental front-office workflow is consistent about what fills a
   schedule, and none of it is on the day board: confirming tomorrow before
   going home, rebooking today's no-shows the same day, working the recall list,
   and chasing treatment the patient accepted and never scheduled. Those four
   are the difference between a full chair and an empty one, and TAWD offered a
   list of today and a booking form.

   Everything here comes from rows that already exist. Nothing is invented. */

export type FollowUp = {
  id: string;
  patientId: string;
  patientName: string;
  phone: string | null;
  /** why they are on the list */
  reason: string;
  detail: string;
  /** OMR at stake, when there is one */
  value: number | null;
  urgent: boolean;
  apptId?: string;
};

export type FollowUpBoard = {
  confirmTomorrow: FollowUp[];
  rebookNoShows: FollowUp[];
  recallDue: FollowUp[];
  unscheduledTreatment: FollowUp[];
  waitlist: FollowUp[];
  outstanding: FollowUp[];
  tomorrowLabel: string;
};

type PatientJoin = { name: string; phone: string | null } | null;

const omr = (v: number) => Number(v.toFixed(3));

/** Muscat is UTC+4 with no DST. */
function muscatDate(offsetDays = 0) {
  const t = new Date(Date.now() + 4 * 3600_000 + offsetDays * 86_400_000);
  return t.toISOString().slice(0, 10);
}

export async function getFollowUps(clinicId: string): Promise<FollowUpBoard> {
  const sb = await createServerSupabaseClient();
  const today = muscatDate(0);
  const tomorrow = muscatDate(1);
  const now = new Date().toISOString();
  const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000).toISOString();

  const [
    { data: tomorrowAppts },
    { data: noShows },
    { data: lastVisits },
    { data: planItems },
    { data: waitlistRows },
    { data: openInvoices },
    { data: futureAppts },
  ] = await Promise.all([
    /* Not yet confirmed for tomorrow. A confirmed patient does not need a call
       and putting them on the list is how a list stops being trusted. */
    sb.from("appointments")
      .select("id, slot_time, status, patient_id, patients!patient_id(name, phone), services!service_id(name_ar)")
      .eq("clinic_id", clinicId).eq("status", "scheduled").is("deleted_at", null)
      .gte("slot_time", `${tomorrow}T00:00:00+04:00`).lte("slot_time", `${tomorrow}T23:59:59+04:00`)
      .order("slot_time"),

    /* Missed today or in the last week and never rebooked. */
    sb.from("appointments")
      .select("id, slot_time, patient_id, patients!patient_id(name, phone), services!service_id(name_ar)")
      .eq("clinic_id", clinicId).eq("status", "no_show").is("deleted_at", null)
      .gte("slot_time", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order("slot_time", { ascending: false }).limit(50),

    /* Last visit per patient, aggregated in Postgres.

       This used to fetch every completed appointment and reduce it in JS,
       capped at 4000 rows. Past that cap patients silently vanished from the
       recall list — the one list whose entire purpose is catching the people
       nobody remembered. */
    sb.rpc("clinic_last_visits", { p_clinic_id: clinicId }),

    /* Treatment the patient agreed to and nobody booked. The single largest
       pool of revenue sitting in any dental practice. */
    sb.from("treatment_plan_items")
      .select("id, description, unit_price, quantity, status, treatment_plans!plan_id(id, patient_id, status, patients(name, phone))")
      .eq("clinic_id", clinicId).eq("status", "pending").limit(1000),

    sb.from("appointment_waitlist")
      .select("id, patient_id, priority, desired_from, desired_to, created_at, patients!patient_id(name, phone), services!service_id(name_ar)")
      .eq("clinic_id", clinicId).eq("status", "waiting")
      .order("priority", { ascending: false }).order("created_at").limit(50),

    sb.from("invoices")
      .select("id, patient_id, total, status, created_at, patients!patient_id(name, phone)")
      .eq("clinic_id", clinicId).is("deleted_at", null)
      .in("status", ["sent", "overdue", "partially_paid"]).limit(200),

    /* Anyone already booked ahead is not chased. */
    sb.from("appointments")
      .select("patient_id").eq("clinic_id", clinicId).is("deleted_at", null)
      .in("status", ["scheduled", "confirmed"]).gte("slot_time", now).limit(2000),
  ]);

  const bookedAhead = new Set((futureAppts ?? []).map((a) => a.patient_id as string));

  const confirmTomorrow: FollowUp[] = (tomorrowAppts ?? []).map((a) => {
    const p = a.patients as unknown as PatientJoin;
    const time = new Intl.DateTimeFormat("ar-u-nu-latn", {
      timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(a.slot_time as string));
    return {
      id: `c-${a.id}`, apptId: a.id as string,
      patientId: a.patient_id as string,
      patientName: p?.name ?? "مريض", phone: p?.phone ?? null,
      reason: "لم يؤكد بعد",
      detail: `${time} · ${(a.services as unknown as { name_ar?: string } | null)?.name_ar ?? "—"}`,
      value: null, urgent: false,
    };
  });

  const rebookNoShows: FollowUp[] = (noShows ?? [])
    .filter((a) => !bookedAhead.has(a.patient_id as string))
    .map((a) => {
      const p = a.patients as unknown as PatientJoin;
      const days = Math.floor((Date.now() - new Date(a.slot_time as string).getTime()) / 86_400_000);
      return {
        id: `n-${a.id}`, apptId: a.id as string,
        patientId: a.patient_id as string,
        patientName: p?.name ?? "مريض", phone: p?.phone ?? null,
        reason: "لم يحضر ولم يُعِد الحجز",
        detail: days === 0 ? "اليوم" : `منذ ${days} يوم`,
        value: null, urgent: days <= 1,
      };
    });

  /* Recall: last seen six months ago or more, nothing booked.

     Longest-absent first, and names are fetched only for the fifty that
     qualify rather than joined across the entire visit history. */
  const overdue = ((lastVisits ?? []) as { patient_id: string; last_visit: string }[])
    .filter((v) => v.last_visit < sixMonthsAgo && !bookedAhead.has(v.patient_id))
    .sort((a, b) => a.last_visit.localeCompare(b.last_visit))
    .slice(0, 50);

  const { data: recallPeople } = overdue.length
    ? await sb.from("patients").select("id, name, phone").in("id", overdue.map((v) => v.patient_id))
    : { data: [] as Record<string, unknown>[] };
  const personOf = new Map((recallPeople ?? []).map((p) => [p.id as string, p]));

  const recallDue: FollowUp[] = overdue.map((v) => {
    const p = personOf.get(v.patient_id);
    const months = Math.floor((Date.now() - new Date(v.last_visit).getTime()) / (30 * 86_400_000));
    return {
      id: `r-${v.patient_id}`, patientId: v.patient_id,
      patientName: (p?.name as string) ?? "مريض",
      phone: (p?.phone as string | null) ?? null,
      reason: "موعد دوري مستحق",
      detail: `آخر زيارة منذ ${months} شهر`,
      value: null, urgent: months >= 12,
    };
  });

  /* Accepted treatment with nothing on the books, grouped per patient so the
     desk makes one call, not one call per tooth. */
  const perPatient = new Map<string, { name: string; phone: string | null; count: number; value: number }>();
  for (const it of planItems ?? []) {
    const plan = it.treatment_plans as unknown as
      { patient_id: string; status: string; patients: PatientJoin } | null;
    if (!plan) continue;
    if (plan.status !== "accepted" && plan.status !== "in_progress") continue;
    if (bookedAhead.has(plan.patient_id)) continue;
    const cur = perPatient.get(plan.patient_id) ?? {
      name: plan.patients?.name ?? "مريض", phone: plan.patients?.phone ?? null, count: 0, value: 0,
    };
    cur.count++;
    cur.value += Number(it.unit_price ?? 0) * Number(it.quantity ?? 1);
    perPatient.set(plan.patient_id, cur);
  }
  const unscheduledTreatment: FollowUp[] = [...perPatient.entries()]
    .map(([pid, v]) => ({
      id: `t-${pid}`, patientId: pid,
      patientName: v.name, phone: v.phone,
      reason: "علاج وافق عليه ولم يُحجز",
      detail: `${v.count} إجراء`,
      value: omr(v.value), urgent: false,
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const waitlist: FollowUp[] = (waitlistRows ?? []).map((w) => {
    const p = w.patients as unknown as PatientJoin;
    return {
      id: `w-${w.id}`, patientId: w.patient_id as string,
      patientName: p?.name ?? "مريض", phone: p?.phone ?? null,
      reason: "ينتظر موعداً",
      detail: `${(w.services as unknown as { name_ar?: string } | null)?.name_ar ?? "أي خدمة"}${
        w.desired_from ? ` · من ${w.desired_from}` : ""}`,
      value: null,
      urgent: Number(w.priority ?? 0) > 0,
    };
  });

  /* Unpaid invoices, so the desk can ask while the patient is standing there
     rather than posting a reminder afterwards. */
  const owed = new Map<string, { name: string; phone: string | null; total: number; count: number }>();
  for (const inv of openInvoices ?? []) {
    const pid = inv.patient_id as string;
    const p = inv.patients as unknown as PatientJoin;
    const cur = owed.get(pid) ?? { name: p?.name ?? "مريض", phone: p?.phone ?? null, total: 0, count: 0 };
    cur.total += Number(inv.total ?? 0);
    cur.count++;
    owed.set(pid, cur);
  }
  const outstanding: FollowUp[] = [...owed.entries()]
    .map(([pid, v]) => ({
      id: `o-${pid}`, patientId: pid,
      patientName: v.name, phone: v.phone,
      reason: "مبلغ مستحق",
      detail: `${v.count} فاتورة غير مسدّدة`,
      value: omr(v.total), urgent: v.total >= 100,
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return {
    confirmTomorrow, rebookNoShows, recallDue, unscheduledTreatment, waitlist, outstanding,
    tomorrowLabel: new Intl.DateTimeFormat("ar-u-nu-latn", {
      timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long",
    }).format(new Date(`${tomorrow}T12:00:00+04:00`)),
  };
}
