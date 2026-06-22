import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Megaphone, Plus } from "lucide-react";

export const metadata = { title: "الحملات — طود" };

type Campaign = { id: string; name: string; status: string; created_at: string };

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: "مسودة",   color: "#64748B", bg: "#F1F5F9" },
  scheduled:  { label: "مجدولة",  color: "#1D4ED8", bg: "#EFF6FF" },
  sending:    { label: "جارٍ",    color: "#0d9488", bg: "#FFFBEB" },
  completed:  { label: "مكتملة",  color: "#059669", bg: "#ECFDF5" },
  failed:     { label: "فشلت",    color: "#DC2626", bg: "#FEF2F2" },
};

export default async function BroadcastPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "platform_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data, count } = await supabase
    .from("broadcast_campaigns")
    .select("id, name, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100);

  const campaigns = (data ?? []) as Campaign[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>الحملات</h2>
          <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{count ?? 0} حملة إرسال</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}
        >
          <Plus className="w-4 h-4" />
          حملة جديدة
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Megaphone className="w-10 h-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>لا توجد حملات حتى الآن</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(var(--muted) / 0.4)", borderBottom: "1px solid hsl(var(--border))" }}>
                {["اسم الحملة", "التاريخ", "الحالة"].map((h) => (
                  <th key={h} className="text-right py-3 px-5 text-[12px] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const s = STATUS[c.status] ?? STATUS.draft;
                return (
                  <tr key={c.id} style={{ borderBottom: i < campaigns.length - 1 ? "1px solid hsl(var(--border))" : undefined }}>
                    <td className="py-3.5 px-5 font-semibold" style={{ color: "hsl(var(--foreground))" }}>{c.name}</td>
                    <td className="py-3.5 px-5 ltr-nums" style={{ color: "hsl(var(--muted-foreground))" }}>{formatDate(c.created_at)}</td>
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
