import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SalaryAndAttendance, type StaffRow } from "@/components/payroll/salary-attendance";
import { PayrollRuns, type RunRow, type PayslipRow } from "@/components/payroll/payroll-runs";
import { Wallet, Users, CalendarCheck } from "lucide-react";

export const metadata = { title: "الرواتب والموظفون — طود" };

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export default async function PayrollPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${period}-01`;
  const today = now.toISOString().slice(0, 10);

  const [staffRes, profRes, absRes, todayRes, runsRes] = await Promise.all([
    sb.from("tawd_staff_users").select("id, name, name_ar, role")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).is("deleted_at", null)
      .neq("role", "platform_admin").order("name"),
    sb.from("staff_hr_profiles").select("*").eq("clinic_id", claims.clinic_id),
    sb.from("attendance").select("staff_id").eq("clinic_id", claims.clinic_id)
      .eq("status", "absent").gte("work_date", monthStart).lte("work_date", today),
    sb.from("attendance").select("staff_id, status").eq("clinic_id", claims.clinic_id).eq("work_date", today),
    sb.from("payroll_runs").select("id, period, status, total_net")
      .eq("clinic_id", claims.clinic_id).order("period", { ascending: false }).limit(24),
  ]);

  const profByStaff = new Map((profRes.data ?? []).map((p) => [p.staff_id, p]));
  const absCount = new Map<string, number>();
  for (const a of absRes.data ?? []) absCount.set(a.staff_id, (absCount.get(a.staff_id) ?? 0) + 1);
  const todayStatus = new Map((todayRes.data ?? []).map((a) => [a.staff_id, a.status as string]));

  const staff: StaffRow[] = (staffRes.data ?? []).map((s) => {
    const p = profByStaff.get(s.id);
    return {
      id: s.id, name: (s.name_ar ?? s.name) as string, role: s.role as string,
      hasProfile: !!p,
      basic: n(p?.basic_salary), housing: n(p?.housing_allowance),
      transport: n(p?.transport_allowance), other: n(p?.other_allowance),
      job_title: (p?.job_title as string) ?? "", hire_date: (p?.hire_date as string) ?? "",
      bank_name: (p?.bank_name as string) ?? "", iban: (p?.iban as string) ?? "",
      monthAbsence: absCount.get(s.id) ?? 0,
      todayStatus: todayStatus.get(s.id) ?? null,
    };
  });

  const runs: RunRow[] = (runsRes.data ?? []).map((r) => ({
    id: r.id, period: r.period, status: r.status as "draft" | "finalized", total_net: n(r.total_net),
  }));

  // payslips for the current period's run (if any)
  const currentRun = runs.find((r) => r.period === period) ?? null;
  let payslips: PayslipRow[] = [];
  if (currentRun) {
    const { data } = await sb.from("payslips")
      .select("id, staff_id, basic, allowances, additions, deductions, absence_days, gross, net, notes, tawd_staff_users!staff_id(name, name_ar)")
      .eq("run_id", currentRun.id).eq("clinic_id", claims.clinic_id);
    payslips = (data ?? []).map((p) => {
      const u = p.tawd_staff_users as unknown as { name?: string; name_ar?: string } | null;
      return {
        id: p.id, staff_id: p.staff_id, staff_name: u?.name_ar ?? u?.name ?? "موظف",
        basic: n(p.basic), allowances: n(p.allowances), additions: n(p.additions),
        deductions: n(p.deductions), absence_days: n(p.absence_days),
        gross: n(p.gross), net: n(p.net), notes: (p.notes as string) ?? "",
      };
    }).sort((a, b) => a.staff_name.localeCompare(b.staff_name));
  }

  const withSalary = staff.filter((s) => s.hasProfile).length;
  const monthlyCost = staff.reduce((s, x) => s + x.basic + x.housing + x.transport + x.other, 0);
  const presentToday = staff.filter((s) => s.todayStatus === "present").length;

  const kpis = [
    { label: "موظفون", value: String(staff.length), Icon: Users, color: "var(--accent-1)" },
    { label: "رواتب مُعدّة", value: `${withSalary}/${staff.length}`, Icon: Wallet, color: "var(--accent-1)" },
    { label: "حاضر اليوم", value: String(presentToday), Icon: CalendarCheck, color: "var(--accent-1)" },
    { label: "كلفة الرواتب/شهر (ر.ع)", value: fmt(monthlyCost), Icon: Wallet, color: "var(--accent-1)" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">HR &amp; PAYROLL</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">الرواتب والموظفون</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>الرواتب، الحضور، ومسيّرات الرواتب الشهرية</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none text-white" style={{ fontSize: "1.7rem" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <SalaryAndAttendance staff={staff} today={today} />
      <PayrollRuns period={period} runs={runs} currentRun={currentRun} payslips={payslips} />
    </div>
  );
}
