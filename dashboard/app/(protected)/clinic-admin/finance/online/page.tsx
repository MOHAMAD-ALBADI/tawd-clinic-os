import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ThawaniBoard, type LinkRow, type PayableInvoice } from "@/components/finance/thawani-board";
import { thawaniStatus } from "@/app/actions/thawani";
import { Smartphone, CheckCircle2, Clock, Percent, AlertTriangle } from "lucide-react";

export const metadata = { title: "الدفع الإلكتروني — طود" };
export const dynamic = "force-dynamic";

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

type InvJoin = { invoice_number?: string; patients?: { name?: string } | null } | null;

export default async function OnlinePaymentsPage() {
  const claims = (await getUserClaims())!;
  const sb = await createServerSupabaseClient();

  const [status, linkRes, payableRes] = await Promise.all([
    thawaniStatus(),
    sb.from("payment_links")
      .select("id, link_url, amount, status, created_at, expires_at, paid_at, invoices(invoice_number, patients(name))")
      .eq("clinic_id", claims.clinic_id).order("created_at", { ascending: false }).limit(100),
    sb.from("invoices").select("id, invoice_number, total, patients(name)")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .in("status", ["draft", "sent", "partially_paid", "overdue"])
      .order("created_at", { ascending: false }).limit(50),
  ]);

  const links: LinkRow[] = (linkRes.data ?? []).map((l) => {
    const inv = l.invoices as unknown as InvJoin;
    return {
      id: l.id, url: l.link_url as string, amount: n(l.amount), status: l.status as string,
      created_at: l.created_at as string, expires_at: (l.expires_at as string) ?? null,
      paid_at: (l.paid_at as string) ?? null,
      invoice_number: inv?.invoice_number ?? "—",
      patient_name: inv?.patients?.name ?? "—",
    };
  });

  const payable: PayableInvoice[] = (payableRes.data ?? []).map((i) => ({
    id: i.id, invoice_number: i.invoice_number as string, total: n(i.total),
    patient_name: (i.patients as unknown as { name?: string } | null)?.name ?? "—",
  }));

  const paid = links.filter((l) => l.status === "paid");
  const pending = links.filter((l) => l.status === "pending");
  const collected = paid.reduce((s, l) => s + l.amount, 0);
  const awaiting = pending.reduce((s, l) => s + l.amount, 0);
  /* Conversion measures links that reached a decision — a link still waiting
     hasn't failed yet, so counting it as a miss would understate the gateway. */
  const decided = links.filter((l) => l.status !== "pending").length;
  const conversion = decided > 0 ? Math.round((paid.length / decided) * 100) : 0;

  const kpis = [
    { label: "محصَّل إلكترونياً", value: fmt(collected), Icon: CheckCircle2, color: "var(--accent-1)" },
    { label: "بانتظار الدفع", value: fmt(awaiting), Icon: Clock, color: "#fbbf24" },
    { label: "روابط مرسلة", value: String(links.length), Icon: Smartphone, color: "var(--accent-1)" },
    { label: "نسبة الإتمام", value: decided > 0 ? `${conversion}%` : "—", Icon: Percent, color: "var(--accent-1)" },
  ];

  return (
    <div className="space-y-5">
      <p className="text-[11px] -mt-1" style={{ color: "var(--text-4)" }}>
        ثواني — بوابة الدفع بالبطاقة في عُمان. الرابط صالح ٣٠ دقيقة، وعند الدفع تُقيَّد الفاتورة مدفوعة تلقائياً
      </p>

      {!status.configured ? (
        <div className="panel flex items-start gap-3" style={{ padding: "1.1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
          <div>
            <p className="text-[13px] font-bold text-white mb-1">ثواني غير مفعّلة</p>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
              أضف <span className="font-mono ltr-nums">THAWANI_SECRET_KEY</span> و
              <span className="font-mono ltr-nums"> THAWANI_PUBLIC_KEY</span> في متغيّرات البيئة، ثم أعد النشر.
              حتى ذلك الحين يبقى التحصيل نقداً وتحويلاً بنكياً.
            </p>
          </div>
        </div>
      ) : !status.live ? (
        <div className="panel flex items-center gap-3" style={{ padding: "0.9rem 1.2rem", borderColor: "rgba(56,189,248,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#38bdf8" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            بيئة تجريبية (UAT) — المدفوعات هنا غير حقيقية. للتحويل إلى الإنتاج غيّر
            <span className="font-mono ltr-nums"> THAWANI_BASE_URL</span> إلى نطاق ثواني المباشر.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      <ThawaniBoard links={links} payable={payable} configured={status.configured} />
    </div>
  );
}
