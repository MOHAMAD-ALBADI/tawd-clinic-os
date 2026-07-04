import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { CheckoutFlow } from "@/components/accountant/checkout-flow";
import { ArrowRight, AlertTriangle, User, Stethoscope } from "lucide-react";

export const metadata = { title: "الكاشير — طود" };

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function CheckoutPage({ params }: { params: Promise<{ apptId: string }> }) {
  const { apptId } = await params;
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const { data: appt } = await sb
    .from("appointments")
    .select("id, slot_time, status, patient_id, patients!patient_id(name, phone), services!service_id(name_ar, price), tawd_staff_users!doctor_id(name_ar, name)")
    .eq("id", apptId)
    .eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null)
    .single();
  if (!appt) notFound();

  /* outstanding balance from previous invoices — collect it while they're here */
  const { data: oldInv } = await sb
    .from("invoices")
    .select("total, status")
    .eq("clinic_id", claims.clinic_id)
    .eq("patient_id", appt.patient_id)
    .in("status", ["sent", "partially_paid", "overdue"])
    .neq("appt_id", apptId)
    .is("deleted_at", null);
  const outstanding = (oldInv ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);

  const patient = appt.patients as unknown as { name?: string; phone?: string } | null;
  const svc = appt.services as unknown as { name_ar?: string; price?: number } | null;
  const doc = appt.tawd_staff_users as unknown as { name_ar?: string; name?: string } | null;
  const when = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(appt.slot_time));

  return (
    <div className="space-y-4 animate-fade-in pb-20 max-w-2xl">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <h2 className="text-xl font-bold text-white">الكاشير</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>فوترة وتحصيل الزيارة</p>
      </div>

      {/* visit summary */}
      <div className="panel-feature" style={{ padding: "1.25rem 1.5rem" }}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: "var(--text-3)" }} />
            <span className="text-sm font-bold text-white">{patient?.name ?? "مريض"}</span>
          </div>
          <span className="w-px h-4" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" style={{ color: "var(--text-3)" }} />
            <span className="text-sm" style={{ color: "var(--text-2)" }}>
              {svc?.name_ar ?? "خدمة"}{doc ? ` · ${doc.name_ar ?? doc.name}` : ""}
            </span>
          </div>
          <span className="text-[11px] ms-auto" style={{ color: "var(--text-4)" }}>{when}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-4">
          <span className="text-3xl font-bold ltr-nums text-white">{fmt(Number(svc?.price ?? 0))}</span>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>ر.ع + الضريبة عند الإصدار</span>
        </div>
        {appt.status !== "completed" && (
          <p className="badge badge-warn mt-3">الموعد غير مكتمل بعد — أكمل الكشف أولاً</p>
        )}
      </div>

      {/* smart collection: previous unpaid balance */}
      {outstanding > 0 && (
        <div
          className="rounded-2xl flex items-center gap-3 px-4 py-3"
          style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#fcd34d" }} />
          <p className="text-[13px]" style={{ color: "#fcd34d" }}>
            على المريض رصيد سابق غير مسدد: <span className="font-bold ltr-nums">{fmt(outstanding)} ر.ع</span> — فرصة للتحصيل الآن
          </p>
        </div>
      )}

      {appt.status === "completed" && <CheckoutFlow appointmentId={apptId} />}
    </div>
  );
}
