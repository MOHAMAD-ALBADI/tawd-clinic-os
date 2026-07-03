import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Ask-Sura: answers clinic questions from LIVE clinic data (Gemini, key from channel_configs). */
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims || !claims.clinic_id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!["clinic_admin", "accountant"].includes(claims.role)) {
    return NextResponse.json(
      { answer: "عذراً، تحليلات سُرى متاحة لمدير العيادة والمحاسب فقط." },
      { status: 200 }
    );
  }

  let question = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "").slice(0, 400).trim();
  } catch { /* fallthrough */ }
  if (!question) {
    return NextResponse.json({ error: "empty question" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const cid = claims.clinic_id;
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${today.slice(0, 7)}-01T00:00:00`;
  const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

  const [
    cfgRes, clinicRes,
    todayApptsRes, tomorrowApptsRes, weekApptsRes, monthApptsRes,
    todayPaidRes, monthPaidRes, pendingInvRes,
    patientsRes, newPatientsMonthRes,
    waitlistRes, recoveredRes, alertsRes, servicesRes,
  ] = await Promise.all([
    sb.from("channel_configs").select("config").eq("clinic_id", cid).eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle(),
    sb.from("tawd_clinics").select("name, name_ar, clinic_type").eq("id", cid).single(),

    sb.from("appointments").select("slot_time, status, services!service_id(name_ar), tawd_staff_users!doctor_id(name_ar, name), patients!patient_id(name)")
      .eq("clinic_id", cid).gte("slot_time", `${today}T00:00:00`).lte("slot_time", `${today}T23:59:59`).is("deleted_at", null).order("slot_time"),
    sb.from("appointments").select("slot_time, status").eq("clinic_id", cid)
      .gte("slot_time", `${tomorrow}T00:00:00`).lte("slot_time", `${tomorrow}T23:59:59`).is("deleted_at", null),
    sb.from("appointments").select("slot_time, status").eq("clinic_id", cid)
      .gte("slot_time", `${weekAgo}T00:00:00`).is("deleted_at", null).limit(1000),
    sb.from("appointments").select("status, services!service_id(name_ar)").eq("clinic_id", cid)
      .gte("slot_time", monthStart).is("deleted_at", null).limit(2000),

    sb.from("invoices").select("total").eq("clinic_id", cid).eq("status", "paid")
      .gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
    sb.from("invoices").select("total").eq("clinic_id", cid).eq("status", "paid").gte("created_at", monthStart),
    sb.from("invoices").select("total").eq("clinic_id", cid).in("status", ["sent", "partially_paid", "overdue"]).is("deleted_at", null),

    sb.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", cid).is("deleted_at", null),
    sb.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", cid).gte("created_at", monthStart),

    sb.from("appointment_waitlist").select("id", { count: "exact", head: true }).eq("clinic_id", cid).eq("status", "waiting"),
    sb.from("automation_recovery_ledger").select("amount").eq("clinic_id", cid).gte("occurred_at", monthStart),
    sb.from("sura_alerts").select("kind").eq("clinic_id", cid).eq("status", "open"),
    sb.from("services").select("name_ar, price, is_active").eq("clinic_id", cid).eq("is_active", true).limit(30),
  ]);

  const geminiKey = (cfgRes.data?.config as Record<string, string> | null)?.gemini_key;
  if (!geminiKey) {
    return NextResponse.json({ answer: "إعداد الذكاء الاصطناعي غير مكتمل لهذه العيادة — تواصل مع دعم طود." });
  }

  const sum = (rows: unknown[] | null | undefined) =>
    (rows ?? []).reduce((s: number, r) => s + Number((r as { total?: number; amount?: number }).total ?? (r as { amount?: number }).amount ?? 0), 0);
  const byStatus = (rows: { status: string }[] | null | undefined) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  };

  const monthAppts = (monthApptsRes.data ?? []) as { status: string; services?: { name_ar?: string } | null }[];
  const svcCount: Record<string, number> = {};
  for (const a of monthAppts) {
    const n = a.services?.name_ar;
    if (n) svcCount[n] = (svcCount[n] ?? 0) + 1;
  }
  const topServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const todayList = ((todayApptsRes.data ?? []) as any[]).map((a) => ({
    time: String(a.slot_time).slice(11, 16),
    status: a.status,
    patient: a.patients?.name ?? null,
    service: a.services?.name_ar ?? null,
    doctor: a.tawd_staff_users?.name_ar ?? a.tawd_staff_users?.name ?? null,
  }));

  const alerts = (alertsRes.data ?? []) as { kind: string }[];
  const clinic = clinicRes.data;

  const data = {
    clinic: { name: clinic?.name_ar ?? clinic?.name, type: clinic?.clinic_type },
    currency: "ريال عُماني (OMR)",
    today_date: today,
    revenue: {
      today_paid: sum(todayPaidRes.data),
      month_paid: sum(monthPaidRes.data),
      unpaid_pending_total: sum(pendingInvRes.data),
      recovered_by_sura_this_month: sum(recoveredRes.data),
    },
    appointments: {
      today_count: todayList.length,
      today_by_status: byStatus(todayApptsRes.data as any),
      today_list: todayList.slice(0, 20),
      tomorrow_count: (tomorrowApptsRes.data ?? []).length,
      last7days_count: (weekApptsRes.data ?? []).length,
      this_month_by_status: byStatus(monthAppts),
    },
    patients: {
      total: patientsRes.count ?? 0,
      new_this_month: newPatientsMonthRes.count ?? 0,
    },
    waitlist_waiting: waitlistRes.count ?? 0,
    open_alerts: { total: alerts.length, emergencies: alerts.filter((a) => a.kind === "emergency").length, complaints: alerts.filter((a) => a.kind === "complaint").length },
    top_services_this_month: topServices,
    active_services: ((servicesRes.data ?? []) as any[]).map((s) => ({ name: s.name_ar, price: Number(s.price) })),
  };

  const prompt =
    `أنتِ "سُرى"، المساعدة الذكية لعيادة ${data.clinic.name ?? ""}. مدير العيادة يسألك عن أداء عيادته.\n` +
    `أجيبي بالعربية، بإيجاز ووضوح (٣ أسطر كحد أقصى إلا إذا طُلب تفصيل). اعتمدي حصراً على البيانات أدناه — لا تخترعي أي رقم. ` +
    `المبالغ بالريال العُماني بثلاث منازل عشرية (مثال: 5.000 ر.ع). إذا كانت الإجابة غير موجودة في البيانات قولي بصراحة إنها غير متوفرة حالياً.\n\n` +
    `[بيانات العيادة الحية]\n${JSON.stringify(data)}\n\n` +
    `[سؤال المدير]\n${question}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const j = await res.json();
    const answer = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) throw new Error(j?.error?.message ?? "empty answer");
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({
      answer: "تعذّر التحليل الآن — حاول مرة أخرى بعد لحظات.",
    });
  }
}
