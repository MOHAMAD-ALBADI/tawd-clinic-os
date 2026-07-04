import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";

export const metadata = { title: "إحصائياتي — طود" };

export default async function DoctorStatsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${today.slice(0, 7)}-01T00:00:00`;
  const monthLabel = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" }).format(now);

  const [{ data: monthAppts }, { count: notesMonth }] = await Promise.all([
    supabase
      .from("appointments")
      .select("status, slot_time, patient_id, services(name_ar)")
      .eq("doctor_id", claims.sub)
      .is("deleted_at", null)
      .gte("slot_time", monthStart)
      .limit(2000),
    supabase
      .from("patient_notes")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", claims.sub)
      .gte("created_at", monthStart),
  ]);

  const appts = monthAppts ?? [];
  const done      = appts.filter((a) => a.status === "completed");
  const noShow    = appts.filter((a) => a.status === "no_show").length;
  const cancelled = appts.filter((a) => a.status === "cancelled").length;
  const upcoming  = appts.filter((a) => ["scheduled", "confirmed"].includes(a.status) && a.slot_time > now.toISOString()).length;
  const uniquePatients = new Set(done.map((a) => a.patient_id)).size;
  const closedTotal = done.length + noShow + cancelled;
  const completionRate = closedTotal > 0 ? Math.round((done.length / closedTotal) * 100) : 0;

  const svcCount: Record<string, number> = {};
  for (const a of done) {
    const n = (a.services as unknown as { name_ar: string } | null)?.name_ar;
    if (n) svcCount[n] = (svcCount[n] ?? 0) + 1;
  }
  const topServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSvc = topServices[0]?.[1] ?? 1;

  const KPIS = [
    { l: "كشوفات مكتملة", v: done.length, sub: monthLabel },
    { l: "مرضى فريدون", v: uniquePatients, sub: "مريض مختلف" },
    { l: "معدل الإتمام", v: `${completionRate}%`, sub: `${noShow} غياب · ${cancelled} إلغاء` },
    { l: "مواعيد قادمة", v: upcoming, sub: "بانتظارك" },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <h2 className="text-xl font-bold text-white">إحصائياتي</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{monthLabel}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <div key={k.l} className="panel panel-hover" style={{ padding: "1.25rem 1.4rem" }}>
            <p className="eyebrow mb-3">{k.l}</p>
            <p className="text-3xl font-bold ltr-nums text-white leading-none">{k.v}</p>
            <p className="text-[11px] mt-2" style={{ color: "var(--text-3)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* top services — the tawd bars speak */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>خدماتي الأكثر تقديماً</h2>
          </div>
          {topServices.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-4)" }}>
              لا كشوفات مكتملة هذا الشهر بعد
            </p>
          ) : (
            <div className="space-y-3">
              {topServices.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{name}</span>
                    <span className="text-xs font-bold ltr-nums text-white">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((count / maxSvc) * 100)}%`,
                        background: "linear-gradient(90deg, rgba(45,212,191,0.35), var(--accent-1))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* documentation */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>التوثيق السريري</h2>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-bold ltr-nums text-white leading-none">{notesMonth ?? 0}</p>
            <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>ملاحظة سريرية هذا الشهر</p>
          </div>
          <p className="text-[11px] mt-4 leading-relaxed" style={{ color: "var(--text-4)" }}>
            التوثيق المنتظم يحمي المريض ويحميك — استخدم «وضع الكشف» لتوثيق منظم (شكوى / فحص / تشخيص / خطة) في كل زيارة.
          </p>
        </div>
      </div>
    </div>
  );
}
