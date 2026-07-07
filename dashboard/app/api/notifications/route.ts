import { NextResponse } from "next/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";

export const dynamic = "force-dynamic";

export type NotifItem = {
  id: string;
  title: string;
  sub?: string;
  href: string;
  severity: "bad" | "warn" | "info";
};

/** Role-aware, LIVE notifications — no placeholders. */
export async function GET() {
  const claims = await getUserClaims();
  if (!claims) return NextResponse.json({ items: [], count: 0 }, { status: 401 });

  const items: NotifItem[] = [];
  const today = new Date().toISOString().split("T")[0];

  if (hasRole(claims, "platform_admin")) {
    const sb = await createServiceRoleClient();
    const [{ data: subs }, { data: clinics }, { data: errs }] = await Promise.all([
      sb.from("tawd_subscriptions").select("clinic_id, status, trial_ends_at, current_period_end"),
      sb.from("tawd_clinics").select("id, name_ar, name"),
      sb.from("sura_errors").select("id, workflow_name").gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]);
    const nameOf = (id: string) => {
      const c = (clinics ?? []).find((x) => x.id === id);
      return (c?.name_ar ?? c?.name ?? "عيادة") as string;
    };
    for (const s of subs ?? []) {
      const end = s.status === "trial" ? s.trial_ends_at : s.current_period_end;
      if (!end) continue;
      const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
      if (days < 0) {
        items.push({ id: `sub-${s.clinic_id}`, title: `اشتراك ${nameOf(s.clinic_id)} منتهٍ`, sub: "جدّد أو سيُوقف تلقائياً", href: "/platform-admin/subscriptions", severity: "bad" });
      } else if (days <= 7) {
        items.push({ id: `sub-${s.clinic_id}`, title: `${nameOf(s.clinic_id)}: باقي ${days} يوم على الاشتراك`, sub: "فرصة تجديد", href: "/platform-admin/subscriptions", severity: "warn" });
      }
    }
    if ((errs ?? []).length > 0) {
      items.push({ id: "errs", title: `${errs!.length} خطأ أتمتة آخر 24 ساعة`, sub: errs![0].workflow_name as string, href: "/platform-admin/automation", severity: "bad" });
    }
    return NextResponse.json({ items: items.slice(0, 12), count: items.length });
  }

  const sb = await createServerSupabaseClient(); // RLS = clinic scope
  const cid = claims.clinic_id;

  if (claims.role === "doctor") {
    const { data: appts } = await sb
      .from("appointments")
      .select("id, slot_time, status, patients(name)")
      .eq("doctor_id", claims.sub).is("deleted_at", null)
      .gte("slot_time", `${today}T00:00:00`).lte("slot_time", `${today}T23:59:59`)
      .in("status", ["scheduled", "confirmed", "checked_in", "in_progress"])
      .order("slot_time").limit(10);
    const arrived = (appts ?? []).filter((a) => a.status === "checked_in").length;
    if (arrived > 0) items.push({ id: "arrived", title: `${arrived} مريض وصل وينتظرك`, href: "/doctor", severity: "warn" });
    const next = (appts ?? []).find((a) => new Date(a.slot_time) > new Date());
    if (next) {
      const t = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(next.slot_time));
      items.push({ id: "next", title: `موعدك القادم: ${(next.patients as unknown as { name?: string })?.name ?? "مريض"}`, sub: t, href: "/doctor", severity: "info" });
    }
    return NextResponse.json({ items, count: items.length });
  }

  /* clinic_admin / receptionist / accountant — union of the account's roles */
  const ops = claims.role === "clinic_admin" || hasRole(claims, "receptionist");
  const money = claims.role === "clinic_admin" || hasRole(claims, "accountant");
  const opsHome = claims.role === "clinic_admin" ? "/clinic-admin" : "/reception";

  const [alertsR, hitlR, queueR, overdueR, readyR] = await Promise.all([
    ops ? sb.from("sura_alerts").select("id, kind, patient_name").eq("clinic_id", cid).eq("status", "open").limit(6) : Promise.resolve({ data: [] as { id: string; kind: string; patient_name: string | null }[] }),
    ops ? sb.from("ai_review_queue").select("id", { count: "exact", head: true }).eq("clinic_id", cid).eq("status", "pending") : Promise.resolve({ count: 0 }),
    hasRole(claims, "receptionist")
      ? sb.from("waiting_queue").select("id", { count: "exact", head: true }).eq("clinic_id", cid).in("status", ["waiting", "called"]).gte("check_in_at", `${today}T00:00:00`)
      : Promise.resolve({ count: 0 }),
    money ? sb.from("invoices").select("id", { count: "exact", head: true }).eq("clinic_id", cid).eq("status", "overdue").is("deleted_at", null) : Promise.resolve({ count: 0 }),
    money
      ? sb.from("appointments").select("id, invoices!appt_id(id)").eq("clinic_id", cid).eq("status", "completed").gte("slot_time", `${today}T00:00:00`).lte("slot_time", `${today}T23:59:59`).is("deleted_at", null)
      : Promise.resolve({ data: [] as { id: string; invoices: { id: string }[] | null }[] }),
  ]);

  for (const a of (alertsR as { data: { id: string; kind: string; patient_name: string | null }[] }).data ?? []) {
    items.push({
      id: `al-${a.id}`,
      title: a.kind === "emergency" ? `🚨 حالة طارئة: ${a.patient_name ?? "مريض"}` : `شكوى مفتوحة: ${a.patient_name ?? "مريض"}`,
      href: opsHome,
      severity: a.kind === "emergency" ? "bad" : "warn",
    });
  }
  const hitl = (hitlR as { count: number | null }).count ?? 0;
  if (hitl > 0) items.push({ id: "hitl", title: `${hitl} محادثة سُرى تنتظر مراجعة`, href: opsHome, severity: "warn" });
  const q = (queueR as { count: number | null }).count ?? 0;
  if (q > 0) items.push({ id: "queue", title: `${q} في غرفة الانتظار الآن`, href: "/reception", severity: "info" });
  const ready = ((readyR as { data: { invoices: { id: string }[] | null }[] }).data ?? []).filter((a) => !(a.invoices ?? []).length).length;
  if (ready > 0) items.push({ id: "ready", title: `${ready} كشف مكتمل بانتظار الفوترة`, href: "/accountant", severity: "warn" });
  const overdue = (overdueR as { count: number | null }).count ?? 0;
  if (overdue > 0) {
    items.push({ id: "overdue", title: `${overdue} فاتورة متأخرة تحتاج متابعة`, href: claims.role === "clinic_admin" ? "/clinic-admin/invoices" : "/accountant/invoices", severity: "bad" });
  }

  return NextResponse.json({ items: items.slice(0, 12), count: items.length });
}
