import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard } from "lucide-react";

export const metadata = { title: "الفواتير — طود" };

type Invoice = { id: string; total: number; status: string; created_at: string };

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: "مسودة",   color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  sent:           { label: "مُرسلة",  color: "#38bdf8", bg: "rgba(56,189,248,0.1)"  },
  paid:           { label: "مدفوعة",  color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  partially_paid: { label: "مدفوعة جزئياً", color: "#2dd4bf", bg: "rgba(45,212,191,0.1)" },
  overdue:        { label: "متأخرة",  color: "#f43f5e", bg: "rgba(244,63,94,0.1)"   },
  cancelled:      { label: "ملغاة",   color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  refunded:       { label: "مستردة",  color: "#5dd9cb", bg: "rgba(45,212,191,0.1)"  },
};

export default async function InvoicesPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data, count } = await supabase
    .from("invoices")
    .select("id, total, status, created_at", { count: "exact" })
    .eq("clinic_id", claims.clinic_id)
    .order("created_at", { ascending: false })
    .limit(200);

  const invoices = (data ?? []) as Invoice[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>الفواتير</h2>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{count ?? 0} فاتورة</p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CreditCard className="w-10 h-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد فواتير</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(var(--muted) / 0.4)", borderBottom: "1px solid hsl(var(--border))" }}>
                {["رقم الفاتورة", "التاريخ", "المبلغ", "الحالة"].map((h) => (
                  <th key={h} className="text-right py-3 px-5 text-[12px] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const s = STATUS[inv.status] ?? STATUS.draft;
                return (
                  <tr key={inv.id} style={{ borderBottom: i < invoices.length - 1 ? "1px solid hsl(var(--border))" : undefined }}>
                    <td className="py-3.5 px-5 font-mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      #{inv.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3.5 px-5 ltr-nums" style={{ color: "hsl(var(--muted-foreground))" }}>{formatDate(inv.created_at)}</td>
                    <td className="py-3.5 px-5 font-semibold ltr-nums" style={{ color: "hsl(var(--foreground))" }}>{formatCurrency(inv.total ?? 0)}</td>
                    <td className="py-3.5 px-5">
                      <span className="text-[12px] px-2.5 py-1 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
