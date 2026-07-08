import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Phone, Star, ChevronLeft, UserPlus } from "lucide-react";
import { AddPatientTrigger, EditPatientTrigger, ArchivePatientTrigger } from "@/components/patients/add-patient-trigger";
import { ImportTrigger } from "@/components/patients/import-trigger";

export const metadata = { title: "المرضى — طود" };

type Patient = {
  id: string; name: string; phone: string;
  dob: string | null; gender: string | null; email: string | null; national_id: string | null;
  loyalty_points: number | null; created_at: string;
};

export default async function PatientsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data, count } = await supabase
    .from("patients")
    .select("id,name,phone,dob,gender,email,national_id,loyalty_points,created_at", { count: "exact" })
    .eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(200);

  const patients    = (data ?? []) as Patient[];
  const withLoyalty = patients.filter((p) => (p.loyalty_points ?? 0) > 0).length;
  const today       = new Date().toISOString().split("T")[0];
  const newToday    = patients.filter((p) => p.created_at.startsWith(today)).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1" style={{ color: "var(--color-brand-400)" }}>PATIENTS</p>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">المرضى</h2>
        </div>
        <div className="flex items-center gap-2">
          <ImportTrigger />
          <AddPatientTrigger />
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { label: "إجمالي المرضى",   value: count ?? 0,  dot: "var(--color-brand-400)" },
          { label: "لديهم نقاط ولاء", value: withLoyalty, dot: "var(--color-warn)" },
          { label: "مسجّل اليوم",     value: newToday,    dot: "var(--color-ok)" },
        ].map((s) => (
          <div key={s.label} className="pill">
            <span className="pill-dot" style={{ background: s.dot }} />
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{s.label}</span>
            <span className="text-[13px] font-black ltr-nums text-white">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Directory */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div>
            <p className="eyebrow">DIRECTORY</p>
            <p className="text-sm font-bold text-white mt-0.5">سجل المرضى</p>
          </div>
          <span className="badge badge-brand ltr-nums">{patients.length}</span>
        </div>

        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(45,212,191,0.07)", border: "1px solid rgba(45,212,191,0.14)" }}>
              <UserPlus className="w-6 h-6" style={{ color: "var(--color-brand-400)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>لا يوجد مرضى مسجّلون</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.012)" }}>
                  {["المريض", "رقم الجوال", "نقاط الولاء", "تاريخ التسجيل", ""].map((h, i) => (
                    <th key={i} className="text-right py-3 px-6 eyebrow">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="group row-hover" style={{ borderTop: "1px solid var(--hairline-2)" }}>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black shrink-0"
                          style={{ background: "rgba(45,212,191,0.1)", color: "var(--color-brand-300)", border: "1px solid rgba(45,212,191,0.18)" }}>
                          {p.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-[13.5px] text-white">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="flex items-center gap-1.5 ltr-nums text-[12px]" style={{ color: "var(--text-2)" }}>
                        <Phone className="w-3 h-3 shrink-0" style={{ color: "var(--color-brand-400)" }} />{p.phone}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      {(p.loyalty_points ?? 0) > 0 ? (
                        <span className="badge badge-warn ltr-nums"><Star className="w-3 h-3" />{p.loyalty_points}</span>
                      ) : <span style={{ color: "var(--text-4)" }}>—</span>}
                    </td>
                    <td className="py-3.5 px-6 ltr-nums text-[12px]" style={{ color: "var(--text-3)" }}>{formatDate(p.created_at)}</td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <EditPatientTrigger patient={p} />
                        <Link href={`/clinic-admin/patients/${p.id}`} className="btn-ghost">
                          الملف <ChevronLeft className="w-3 h-3" />
                        </Link>
                        <ArchivePatientTrigger id={p.id} name={p.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
