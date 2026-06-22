import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AddServiceTrigger, EditServiceTrigger } from "@/components/services/service-form-trigger";
import { ToggleServiceTrigger } from "@/components/services/toggle-service-trigger";
import { DeleteServiceTrigger } from "@/components/services/delete-service-trigger";
import { Stethoscope, Clock } from "lucide-react";

export const metadata = { title: "الخدمات — طود" };

type Service = {
  id: string; name: string; price: number;
  duration_minutes: number | null; description: string | null; is_active: boolean;
};

const PALETTE = ["#14b8a6", "#38bdf8", "#34D399", "#38bdf8", "#38bdf8", "#5dd9cb", "#5dd9cb"];
const colorFor = (name: string) => PALETTE[name.charCodeAt(0) % PALETTE.length];

export default async function ServicesPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data, count } = await supabase
    .from("services")
    .select("id,name,price,duration_minutes,description,is_active", { count: "exact" })
    .eq("clinic_id", claims.clinic_id)
    .order("name");

  const services = (data ?? []) as Service[];
  const active   = services.filter((s) => s.is_active).length;
  const inactive  = (count ?? 0) - active;

  const avgPrice = services.length > 0
    ? services.reduce((sum, s) => sum + s.price, 0) / services.length
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(20,184,166,0.5)" }}>SERVICES</p>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">الخدمات</h2>
        </div>
        <AddServiceTrigger />
      </div>

      {/* ── STAT PILLS ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { label: "إجمالي الخدمات", value: count ?? 0, color: "#5dd9cb", dot: "rgba(20,184,166,0.6)" },
          { label: "نشطة",            value: active,      color: "#4ADE80", dot: "rgba(74,222,128,0.6)" },
          ...(inactive > 0 ? [{ label: "معطّلة", value: inactive, color: "#F87171", dot: "rgba(248,113,113,0.6)" }] : []),
          { label: "متوسط السعر", value: `${avgPrice.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ر.ع`, color: "#2dd4bf", dot: "rgba(45,212,191,0.5)" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 px-3.5 py-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }} />
            <span className="text-[11px] font-medium" style={{ color: "rgba(148,163,184,0.5)" }}>{s.label}</span>
            <span className="text-[13px] font-black ltr-nums" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── SERVICES GRID ── */}
      {services.length === 0 ? (
        <div className="rounded-3xl flex flex-col items-center justify-center py-24 gap-4"
          style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.055)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.12)" }}>
            <Stethoscope className="w-6 h-6" style={{ color: "rgba(20,184,166,0.4)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "rgba(148,163,184,0.35)" }}>لا توجد خدمات — أضف أول خدمة</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => {
            const col = colorFor(s.name);
            return (
              <div
                key={s.id}
                className="rounded-2xl relative overflow-hidden group"
                style={{
                  background: "rgba(255,255,255,0.018)",
                  border: `1px solid ${s.is_active ? `${col}20` : "rgba(255,255,255,0.04)"}`,
                  backdropFilter: "blur(16px)",
                  opacity: s.is_active ? 1 : 0.55,
                  transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                }}
                onMouseEnter={undefined}
              >
                {/* Left accent stripe */}
                <div style={{
                  position: "absolute", insetInlineStart: 0, top: 0, bottom: 0,
                  width: 3, background: s.is_active ? col : "rgba(255,255,255,0.06)",
                  opacity: s.is_active ? 0.8 : 0.3,
                }} />

                <div className="p-4 pe-4 ps-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${col}12`, border: `1px solid ${col}20` }}>
                        <Stethoscope className="w-4 h-4" style={{ color: col }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-[13.5px] truncate">{s.name}</p>
                        {s.description && (
                          <p className="text-[11px] truncate mt-0.5" style={{ color: "rgba(148,163,184,0.4)" }}>
                            {s.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={s.is_active
                        ? { background: "rgba(74,222,128,0.1)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.2)" }
                        : { background: "rgba(100,116,139,0.1)", color: "#64748B", border: "1px solid rgba(100,116,139,0.2)" }
                      }
                    >
                      {s.is_active ? "نشطة" : "معطّلة"}
                    </span>
                  </div>

                  {/* Price + duration */}
                  <div className="flex items-center gap-4 mb-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] mb-0.5"
                        style={{ color: "rgba(148,163,184,0.3)" }}>السعر</p>
                      <p className="text-[18px] font-black ltr-nums leading-none"
                        style={{ color: col, letterSpacing: "-0.02em" }}>
                        {s.price.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        <span className="text-[10px] font-bold ms-1" style={{ color: `${col}60` }}>ر.ع</span>
                      </p>
                    </div>
                    {s.duration_minutes && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Clock className="w-3 h-3" style={{ color: "rgba(148,163,184,0.45)" }} />
                        <span className="text-[11px] ltr-nums font-medium" style={{ color: "rgba(148,163,184,0.55)" }}>
                          {s.duration_minutes} د
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <EditServiceTrigger service={s} />
                    <ToggleServiceTrigger id={s.id} isActive={s.is_active} />
                    <DeleteServiceTrigger id={s.id} name={s.name} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
