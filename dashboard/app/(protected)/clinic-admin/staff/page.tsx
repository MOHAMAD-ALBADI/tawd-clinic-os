import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Mail, Percent } from "lucide-react";
import { InviteStaffModal } from "@/components/staff/invite-staff-modal";
import { ToggleActiveButton } from "@/components/staff/toggle-active-button";

export const metadata = { title: "الكادر الطبي — طود" };

type StaffMember = {
  id: string; name: string; name_ar?: string; email: string;
  role: string; is_active: boolean; phone?: string; commission_rate?: number;
};

const ROLE_META: Record<string, { label: string; color: string; bg: string; order: number }> = {
  doctor:         { label: "طبيب",           color: "#38bdf8", bg: "rgba(56,189,248,0.85)",  order: 1 },
  clinic_admin:   { label: "مدير العيادة",   color: "#5dd9cb", bg: "rgba(15,118,110,0.85)",    order: 2 },
  admin:          { label: "مدير العيادة",   color: "#5dd9cb", bg: "rgba(15,118,110,0.85)",    order: 2 },
  receptionist:   { label: "موظف استقبال",  color: "#38bdf8", bg: "rgba(154,52,18,0.85)",   order: 3 },
  accountant:     { label: "محاسب",          color: "#34D399", bg: "rgba(6,95,70,0.85)",     order: 4 },
  platform_admin: { label: "مشرف المنصة",   color: "#F87171", bg: "rgba(153,27,27,0.85)",   order: 5 },
};

const GROUP_LABELS: Record<number, string> = {
  1: "الأطباء",
  2: "الإدارة",
  3: "فريق الاستقبال",
  4: "المحاسبة",
  5: "مشرفو المنصة",
};

export default async function StaffPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data, count } = await supabase
    .from("tawd_staff_users")
    .select("id,name,name_ar,email,role,is_active,phone,commission_rate", { count: "exact" })
    .eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null)
    .order("role")
    .limit(100);

  const staff   = (data ?? []) as StaffMember[];
  const active  = staff.filter((s) => s.is_active).length;
  const doctors = staff.filter((s) => s.role === "doctor").length;
  const inactive = staff.filter((s) => !s.is_active).length;

  /* Group by role order */
  const grouped = new Map<number, StaffMember[]>();
  for (const m of staff) {
    const meta = ROLE_META[m.role];
    const order = meta?.order ?? 9;
    if (!grouped.has(order)) grouped.set(order, []);
    grouped.get(order)!.push(m);
  }
  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(20,184,166,0.5)" }}>TEAM</p>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">الكادر الطبي</h2>
        </div>
        <InviteStaffModal />
      </div>

      {/* ── STAT PILLS ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { label: "إجمالي الفريق", value: count ?? 0, color: "#5dd9cb",  dot: "rgba(20,184,166,0.6)" },
          { label: "الأطباء",       value: doctors,     color: "#38bdf8",  dot: "rgba(56,189,248,0.6)" },
          { label: "نشطون",         value: active,      color: "#4ADE80",  dot: "rgba(74,222,128,0.6)" },
          ...(inactive > 0 ? [{ label: "معطّلون", value: inactive, color: "#F87171", dot: "rgba(248,113,113,0.6)" }] : []),
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }} />
            <span className="text-[11px] font-medium" style={{ color: "rgba(148,163,184,0.5)" }}>{s.label}</span>
            <span className="text-[13px] font-black ltr-nums" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── ROSTER ── */}
      {staff.length === 0 ? (
        <div
          className="rounded-3xl flex flex-col items-center justify-center py-24 gap-4"
          style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.055)" }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)" }}>
            <span className="text-2xl font-black" style={{ color: "rgba(20,184,166,0.3)" }}>0</span>
          </div>
          <p className="text-sm font-medium" style={{ color: "rgba(148,163,184,0.4)" }}>لا يوجد موظفون مسجّلون بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedGroups.map(([order, members]) => {
            const groupLabel = GROUP_LABELS[order] ?? "أخرى";
            const meta = ROLE_META[members[0].role] ?? ROLE_META["admin"];
            return (
              <div key={order} className="rounded-3xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.055)" }}>

                {/* Section header */}
                <div
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}80` }} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(148,163,184,0.4)" }}>
                      {groupLabel}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold ltr-nums" style={{ color: meta.color }}>{members.length}</span>
                </div>

                {/* Members */}
                {members.map((member, idx) => {
                  const r = ROLE_META[member.role] ?? { label: member.role, color: "#94A3B8", bg: "rgba(100,116,139,0.85)", order: 9 };
                  const displayName = member.name_ar ?? member.name;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 px-5 py-4 relative"
                      style={{
                        borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.035)" : undefined,
                        opacity: member.is_active ? 1 : 0.5,
                      }}
                    >
                      {/* Role color left bar */}
                      <div
                        style={{
                          position: "absolute",
                          insetInlineStart: 0,
                          top: "20%", bottom: "20%",
                          width: 3,
                          borderRadius: "0 3px 3px 0",
                          background: r.color,
                          opacity: member.is_active ? 0.7 : 0.2,
                        }}
                      />

                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-[13px] font-black shrink-0"
                        style={{ background: `${r.color}14`, color: r.color, border: `1px solid ${r.color}25` }}
                      >
                        {displayName.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-0.5">
                          <span className="font-bold text-white text-[14px] truncate">{displayName}</span>
                          {!member.is_active && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                              style={{ background: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                              معطّل
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(148,163,184,0.4)" }}>
                            <Mail className="w-3 h-3 shrink-0" />
                            {member.email}
                          </span>
                          {member.commission_rate != null && member.commission_rate > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold"
                              style={{ color: "rgba(45,212,191,0.6)" }}>
                              <Percent className="w-3 h-3" />
                              {member.commission_rate} عمولة
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role badge */}
                      <div className="hidden sm:flex shrink-0">
                        <span
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: `${r.color}12`, color: r.color, border: `1px solid ${r.color}22` }}
                        >
                          {r.label}
                        </span>
                      </div>

                      {/* Status + action */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background: member.is_active ? "#4ADE80" : "rgba(148,163,184,0.2)",
                              boxShadow: member.is_active ? "0 0 6px rgba(74,222,128,0.8)" : "none",
                            }}
                          />
                          <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.35)" }}>
                            {member.is_active ? "نشط" : "معطّل"}
                          </span>
                        </div>
                        <ToggleActiveButton staffId={member.id} isActive={member.is_active} name={displayName} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
