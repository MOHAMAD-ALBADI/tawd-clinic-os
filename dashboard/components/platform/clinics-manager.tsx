"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, Search, Power, LogIn, ChevronLeft, MessageCircle,
  CheckCircle2, AlertTriangle, Copy, ShieldQuestion, X, Trash2, Users, FileText,
} from "lucide-react";
import { setClinicStatus, impersonateClinic, requestClinicAccess, deleteClinic } from "@/app/actions/platform";

export type ClinicRow = {
  id: string; name: string; name_ar: string | null;
  clinic_type: string; status: string; plan: string;
  staff_count: number; patient_count: number; appts_30d: number;
  last_activity: string | null;
  sub_status: string | null; mrr: number; period_end: string | null;
  whatsapp_linked: boolean;
};

const STATUS: Record<string, { label: string; color: string }> = {
  trial:     { label: "تجريبي", color: "#fbbf24" },
  active:    { label: "نشطة",   color: "#34d399" },
  suspended: { label: "موقوفة", color: "#fda4b4" },
  cancelled: { label: "ملغاة",  color: "#71717a" },
};
const TYPE_AR: Record<string, string> = {
  dental: "أسنان", cosmetic: "تجميل", dermatology: "جلدية",
  pediatric: "أطفال", ophthalmology: "عيون", general: "عام",
};
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Days a clinic has been quiet. Null when it has never done anything. */
function idleDays(last: string | null): number | null {
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
}

type Filter = "all" | "active" | "trial" | "suspended" | "attention";

export function ClinicsManager({ clinics }: { clinics: ClinicRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<ClinicRow | null>(null);
  const [link, setLink] = useState<{ clinic: string; url: string; email: string } | null>(null);

  /* Deletion state. `held` is what the server found in the clinic once it
     refused — the operator sees the real counts before the second attempt. */
  const [confirmDelete, setConfirmDelete] = useState<ClinicRow | null>(null);
  const [typedName, setTypedName] = useState("");
  const [held, setHeld] = useState<{ patients: number; invoices: number } | null>(null);
  const [ack, setAck] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  function openDelete(c: ClinicRow) {
    setConfirmDelete(c); setTypedName(""); setHeld(null); setAck(false); setDelErr(null);
  }

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 4000); }

  /* "Needs attention" is the list the operator should actually work from:
     quiet for a week, expiring within a week, already expired, or suspended. */
  const needsAttention = (c: ClinicRow) => {
    const idle = idleDays(c.last_activity);
    const daysLeft = c.period_end
      ? Math.ceil((new Date(c.period_end).getTime() - Date.now()) / 86_400_000)
      : null;
    return c.status === "suspended"
      || (idle !== null && idle >= 7)
      || idle === null
      || (daysLeft !== null && daysLeft <= 7);
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clinics.filter((c) => {
      if (term && !`${c.name_ar ?? ""} ${c.name}`.toLowerCase().includes(term)) return false;
      if (filter === "attention") return needsAttention(c);
      if (filter !== "all" && c.status !== filter) return false;
      return true;
    });
  }, [clinics, q, filter]);

  const counts = useMemo(() => ({
    all: clinics.length,
    active: clinics.filter((c) => c.status === "active").length,
    trial: clinics.filter((c) => c.status === "trial").length,
    suspended: clinics.filter((c) => c.status === "suspended").length,
    attention: clinics.filter(needsAttention).length,
  }), [clinics]);

  function toggleStatus(c: ClinicRow) {
    setErr(null);
    const next = c.status === "suspended" ? "active" : "suspended";
    start(async () => {
      try {
        const r = await setClinicStatus(c.id, next);
        if (!r.ok) { setErr(r.reason); return; }
        setConfirmSuspend(null);
        ok(next === "suspended"
          ? `أُوقفت ${c.name_ar ?? c.name} — ورُوجع اشتراكها`
          : `أُعيد تفعيل ${c.name_ar ?? c.name}`);
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  function runDelete(c: ClinicRow) {
    setDelErr(null);
    start(async () => {
      try {
        const r = await deleteClinic({
          clinicId: c.id, confirmName: typedName, acknowledgeDataLoss: ack,
        });
        if (!r.ok) {
          /* First refusal carries the counts — show them and require the tick. */
          if ("needsAcknowledge" in r && r.needsAcknowledge) {
            setHeld({ patients: r.patients, invoices: r.invoices });
          }
          setDelErr(r.reason);
          return;
        }
        setConfirmDelete(null);
        ok(`حُذفت ${c.name_ar ?? c.name} نهائياً — و${r.deletedStaff} حساب دخول معها`);
        router.refresh();
      } catch { setDelErr("تعذّر الاتصال"); }
    });
  }

  function enter(c: ClinicRow) {
    setErr(null);
    start(async () => {
      try {
        const r = await impersonateClinic(c.id);
        if (!r.ok) {
          setErr(r.reason);
          /* No live approval: offer to ask for one rather than dead-ending. */
          if (r.needsRequest) {
            const req = await requestClinicAccess(c.id);
            if (req.ok) { setErr(null); ok("أُرسل طلب إذن للعيادة — يظهر لمديرها الآن"); }
          }
          return;
        }
        setLink({ clinic: c.name_ar ?? c.name, url: r.link, email: r.email });
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن عيادة…" style={{ paddingInlineStart: 34 }} />
        </div>
        {([
          ["all", "الكل"], ["attention", "تحتاج متابعة"], ["active", "نشطة"],
          ["trial", "تجريبية"], ["suspended", "موقوفة"],
        ] as [Filter, string][]).map(([id, label]) => {
          const on = filter === id;
          const n = counts[id];
          const urgent = id === "attention" && n > 0;
          return (
            <button key={id} onClick={() => setFilter(id)}
              className="flex items-center gap-1.5 shrink-0 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
              style={{
                background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                color: on ? "var(--accent-1)" : urgent ? "#fbbf24" : "var(--text-3)",
              }}>
              {label}
              <span className="ltr-nums text-[11px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center gap-3 py-16">
          <Building2 className="w-6 h-6" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {q || filter !== "all" ? "لا عيادة تطابق البحث" : "لا عيادات بعد — أنشئ أول عيادة"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["العيادة", "الباقة", "الفريق", "المرضى", "مواعيد ٣٠ يوم", "آخر نشاط", "الإيراد/شهر", "الحالة", ""].map((h) => (
                    <th key={h} className="text-start px-3 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const st = STATUS[c.status] ?? STATUS.trial;
                  const idle = idleDays(c.last_activity);
                  const quiet = idle === null || idle >= 7;
                  const daysLeft = c.period_end
                    ? Math.ceil((new Date(c.period_end).getTime() - Date.now()) / 86_400_000)
                    : null;
                  const label = c.name_ar ?? c.name;

                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--hairline-2)" }}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)" }}>
                            <Building2 className="w-4 h-4" style={{ color: "var(--text-2)" }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{label}</p>
                            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                              {TYPE_AR[c.clinic_type] ?? c.clinic_type}
                              {" · "}
                              <MessageCircle className="w-2.5 h-2.5 inline"
                                style={{ color: c.whatsapp_linked ? "var(--accent-1)" : "var(--text-4)" }} />
                              {c.whatsapp_linked ? " واتساب" : " بلا واتساب"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3" style={{ color: "var(--text-2)" }}>{c.plan}</td>
                      <td className="px-3 py-3 ltr-nums text-white">{c.staff_count}</td>
                      <td className="px-3 py-3 ltr-nums text-white">{c.patient_count}</td>
                      <td className="px-3 py-3 ltr-nums" style={{ color: c.appts_30d > 0 ? "#ffffff" : "var(--text-4)" }}>
                        {c.appts_30d}
                      </td>
                      <td className="px-3 py-3">
                        {idle === null ? (
                          <span className="text-[11.5px]" style={{ color: "#fda4b4" }}>لم تُستخدم</span>
                        ) : (
                          <span className="text-[11.5px] ltr-nums" style={{ color: quiet ? "#fbbf24" : "var(--text-3)" }}>
                            {idle === 0 ? "اليوم" : `${idle} يوم`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="ltr-nums font-bold" style={{ color: c.mrr > 0 ? "var(--accent-1)" : "var(--text-4)" }}>
                          {fmt(c.mrr)}
                        </span>
                        {daysLeft !== null && daysLeft <= 7 && (
                          <p className="text-[10.5px] ltr-nums" style={{ color: daysLeft <= 0 ? "#fda4b4" : "#fbbf24" }}>
                            {daysLeft <= 0 ? "منتهٍ" : `ينتهي بعد ${daysLeft} يوم`}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40` }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-ghost" disabled={pending} title="الدخول كهذه العيادة (بإذنها)"
                            onClick={() => enter(c)}>
                            <LogIn className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-ghost" disabled={pending}
                            title={c.status === "suspended" ? "إعادة التفعيل" : "إيقاف العيادة"}
                            onClick={() => c.status === "suspended" ? toggleStatus(c) : setConfirmSuspend(c)}>
                            <Power className="w-3.5 h-3.5"
                              style={{ color: c.status === "suspended" ? "#34d399" : "#fbbf24" }} />
                          </button>
                          <button className="btn-ghost" disabled={pending} title="حذف العيادة نهائياً"
                            onClick={() => openDelete(c)}>
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
                          </button>
                          <Link href={`/platform-admin/clinics/${c.id}`} className="btn-ghost" title="ملف العيادة">
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* suspending cuts a paying customer off — say what it does before doing it */}
      {confirmSuspend && (
        <Overlay onClose={() => setConfirmSuspend(null)} title="إيقاف عيادة">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
            <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
              سيُمنع كل موظفي <span className="font-bold text-white">{confirmSuspend.name_ar ?? confirmSuspend.name}</span> من
              استخدام النظام، ويتوقف احتساب اشتراكها في دخلك.
              بياناتها تبقى كما هي، والتفعيل يعيدها فوراً.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmSuspend(null)}>إلغاء</button>
            <button className="btn-danger" disabled={pending} onClick={() => toggleStatus(confirmSuspend)}>
              تأكيد الإيقاف
            </button>
          </div>
        </Overlay>
      )}

      {/* Deletion. The only irreversible action in the product, so it is
          deliberately slow: suspend first, type the name, and see the record
          counts before agreeing to lose them. */}
      {confirmDelete && (() => {
        const c = confirmDelete;
        const label = c.name_ar ?? c.name;
        const live = c.status !== "suspended" && c.status !== "cancelled";
        const nameOk = typedName.trim() === (c.name_ar ?? "").trim() || typedName.trim() === c.name.trim();
        const blocked = live || !nameOk || (!!held && !ack);

        return (
          <Overlay onClose={() => setConfirmDelete(null)} title={`حذف ${label}`}>
            <div className="rounded-xl px-3.5 py-3 mb-4"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
              <p className="text-[12.5px]" style={{ color: "#fda4b4" }}>
                يُحذف كل شيء: لوحات المدير والأطباء والاستقبال والمحاسبة، حسابات الدخول،
                المرضى والمواعيد والفواتير والمخزون والتقارير. لا تراجع بعد التأكيد.
              </p>
            </div>

            {/* Step 1 — suspension is the reversible half of the same decision. */}
            {live ? (
              <div className="rounded-xl px-3.5 py-3 mb-3"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)" }}>
                <p className="text-[12.5px] mb-2.5" style={{ color: "#fbbf24" }}>
                  العيادة ما زالت تعمل. أوقفها أولاً — إن كان الإيقاف كافياً فلا داعي للحذف أصلاً.
                </p>
                <button className="btn-ghost" disabled={pending}
                  onClick={() => { setConfirmDelete(null); setConfirmSuspend(c); }}>
                  <Power className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} /> إيقاف العيادة أولاً
                </button>
              </div>
            ) : (
              <>
                {/* Step 2 — what will be lost, straight from the database. */}
                {held && (
                  <div className="rounded-xl px-3.5 py-3 mb-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--hairline)" }}>
                    <p className="eyebrow mb-2">ما تحتفظ به هذه العيادة</p>
                    <div className="flex items-center gap-5 mb-3">
                      <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
                        <Users className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                        <span className="font-black ltr-nums text-white">{held.patients}</span> مريض
                      </span>
                      <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
                        <FileText className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                        <span className="font-black ltr-nums text-white">{held.invoices}</span> فاتورة
                      </span>
                    </div>
                    <p className="text-[11.5px] mb-2.5" style={{ color: "var(--text-4)" }}>
                      سجلات طبية ومالية. صدّرها للعيادة قبل الحذف —
                      <Link href={`/platform-admin/clinics/${c.id}`} className="underline mx-1"
                        style={{ color: "var(--accent-1)" }}>افتح ملف العيادة</Link>
                      إن لم تفعل بعد.
                    </p>
                    <label className="flex items-start gap-2 text-[12.5px] cursor-pointer" style={{ color: "var(--text-2)" }}>
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)}
                        className="mt-0.5" style={{ accentColor: "#f87171" }} />
                      أؤكد أنني صدّرت البيانات أو أوافق على فقدانها نهائياً
                    </label>
                  </div>
                )}

                {/* Step 3 — typing the name is not muscle memory; a confirm click is. */}
                <label className="block text-[12px] mb-1.5" style={{ color: "var(--text-3)" }}>
                  اكتب اسم العيادة للتأكيد: <span className="font-bold text-white">{label}</span>
                </label>
                <input className="field" value={typedName} onChange={(e) => setTypedName(e.target.value)}
                  placeholder={label} autoComplete="off" />
              </>
            )}

            {delErr && !held && (
              <div className="flex items-start gap-2 text-[12.5px] px-3.5 py-2.5 rounded-xl mt-3"
                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {delErr}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>إلغاء</button>
              <button className="btn-danger" disabled={pending || blocked} onClick={() => runDelete(c)}
                style={blocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}>
                <Trash2 className="w-3.5 h-3.5" />
                {pending ? "جارٍ الحذف…" : "حذف نهائي"}
              </button>
            </div>
          </Overlay>
        );
      })()}

      {/* the impersonation link, once the clinic has approved */}
      {link && (
        <Overlay onClose={() => setLink(null)} title={`الدخول إلى ${link.clinic}`}>
          <p className="text-[12.5px] mb-3" style={{ color: "var(--text-2)" }}>
            رابط دخول لمرة واحدة بحساب <span className="ltr-nums font-bold text-white">{link.email}</span>.
            افتحه في نافذة خاصة حتى لا تُنهي جلستك الحالية.
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-primary flex-1" onClick={() => { void navigator.clipboard.writeText(link.url); ok("نُسخ الرابط"); }}>
              <Copy className="w-4 h-4" /> نسخ الرابط
            </button>
            <a className="btn-ghost" href={link.url} target="_blank" rel="noreferrer">فتح</a>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] mt-3" style={{ color: "var(--text-4)" }}>
            <ShieldQuestion className="w-3 h-3" /> الدخول مسجَّل، ولا يعمل إلا بموافقة سارية من العيادة
          </p>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full glass" style={{ maxWidth: 480, borderRadius: "1.25rem", padding: "1.5rem" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-black text-white">{title}</h3>
          <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
