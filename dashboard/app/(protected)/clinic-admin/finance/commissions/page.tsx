import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CommissionsBoard, type CommissionRow } from "@/components/payroll/commissions-board";
import { Percent, Clock, CheckCircle2 } from "lucide-react";

export const metadata = { title: "عمولات الأطباء — طود" };
export const dynamic = "force-dynamic";

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export default async function CommissionsPage() {
  const claims = (await getUserClaims())!;
  const sb = await createServerSupabaseClient();

  const { data } = await sb.from("doctor_commissions")
    .select("id, commission_rate, commission_amount, status, created_at, tawd_staff_users!doctor_id(name, name_ar)")
    .eq("clinic_id", claims.clinic_id).order("created_at", { ascending: false }).limit(200);

  const commissions: CommissionRow[] = (data ?? []).map((c) => {
    const u = c.tawd_staff_users as unknown as { name?: string; name_ar?: string } | null;
    return {
      id: c.id, doctor_name: u?.name_ar ?? u?.name ?? "طبيب",
      rate: n(c.commission_rate), amount: n(c.commission_amount),
      status: c.status as CommissionRow["status"], created_at: c.created_at as string,
    };
  });

  const sum = (s: string) => commissions.filter((c) => c.status === s).reduce((t, c) => t + c.amount, 0);

  const kpis = [
    { label: "بانتظار الاعتماد", value: fmt(sum("pending")), Icon: Clock, color: "#fbbf24" },
    { label: "معتمدة غير مدفوعة", value: fmt(sum("approved")), Icon: Percent, color: "#38bdf8" },
    { label: "مدفوعة", value: fmt(sum("paid")), Icon: CheckCircle2, color: "var(--accent-1)" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.7rem", color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <CommissionsBoard commissions={commissions} />
    </div>
  );
}
