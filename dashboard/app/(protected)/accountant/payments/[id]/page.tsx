import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PrintInvoiceButton } from "@/components/invoices/print-button";
import { METHOD_AR } from "@/lib/payment-methods";
import { fmt3 as fmt } from "@/lib/invoice-meta";
import { arDateTime } from "@/lib/ar-format";
import { ArrowRight } from "lucide-react";
import { SendEmailButton } from "@/components/email/send-email-button";
import { emailStatus } from "@/lib/email";

export const metadata = { title: "سند قبض — طود" };
export const dynamic = "force-dynamic";

/* سند قبض — the piece of paper a patient asks for.

   The clinic could take money and hand back nothing. The tax invoice proves what
   was charged; a receipt proves what was paid, by which method, on which date, and
   by whom — and it is what a patient produces when they say "I already paid this".
   Without one the clinic's word is the only record, which is not a position to
   argue an amount from. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const [{ data: pay }, { data: clinic }] = await Promise.all([
    sb.from("payments")
      .select("id, amount, gateway, transaction_id, paid_at, status, voided_at, void_reason, received_by, invoices!invoice_id(invoice_number, total, patients!patient_id(name, phone, email))")
      .eq("id", id).eq("clinic_id", claims.clinic_id).maybeSingle(),
    sb.from("tawd_clinics")
      .select("name, name_ar, vat_number, phone, address").eq("id", claims.clinic_id).maybeSingle(),
  ]);
  if (!pay) notFound();

  const email = await emailStatus(claims.clinic_id);

  const inv = pay.invoices as unknown as
    { invoice_number?: string; total?: number; patients?: { name?: string; phone?: string } | null } | null;

  const { data: staff } = pay.received_by
    ? await sb.from("tawd_staff_users").select("name, name_ar").eq("id", pay.received_by).maybeSingle()
    : { data: null };

  const clinicName = (clinic?.name_ar ?? clinic?.name ?? "العيادة") as string;
  const voided = !!pay.voided_at || pay.status === "voided";

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between mb-4 no-print">
        <Link href="/accountant/payments" className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-3)" }}>
          <ArrowRight className="w-3.5 h-3.5" /> رجوع للدفعات
        </Link>
        <div className="flex items-center gap-2">
          <SendEmailButton kind="receipt" id={id}
            patientEmail={(pay.invoices as unknown as { patients?: { email?: string | null } | null } | null)?.patients?.email ?? null}
            enabled={email.configured && email.enabled} />
          <PrintInvoiceButton />
        </div>
      </div>

      {/* A voided receipt must never be handed over as if it were live. */}
      {voided && (
        <div className="panel mb-4" style={{ padding: "1rem 1.2rem", borderColor: "rgba(248,113,113,0.35)" }}>
          <p className="text-[13px] font-bold" style={{ color: "#fda4b4" }}>
            هذه الدفعة ملغاة — لا تُعتبر سنداً صالحاً
          </p>
          {pay.void_reason && (
            <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>{pay.void_reason as string}</p>
          )}
        </div>
      )}

      <div className="panel print:bg-white" style={{ padding: "2rem", maxWidth: 720 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="eyebrow">سند قبض · PAYMENT RECEIPT</p>
            <h1 className="text-2xl font-black text-white print:text-black leading-none mt-1">{clinicName}</h1>
            {clinic?.phone && (
              <p className="text-[12px] ltr-nums mt-1" style={{ color: "var(--text-3)" }}>{clinic.phone as string}</p>
            )}
            {clinic?.address && (
              <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{clinic.address as string}</p>
            )}
            {clinic?.vat_number && (
              <p className="text-[12px] ltr-nums" style={{ color: "var(--text-3)" }}>
                الرقم الضريبي: {clinic.vat_number as string}
              </p>
            )}
          </div>
          <div className="text-end">
            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>رقم السند</p>
            <p className="text-lg font-black ltr-nums text-white print:text-black">
              {String(pay.id).slice(0, 8).toUpperCase()}
            </p>
            <p className="text-[11px] ltr-nums mt-1" style={{ color: "var(--text-3)" }}>
              {arDateTime.format(new Date(pay.paid_at as string))}
            </p>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3 mb-5"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
          <Row label="استلمنا من" value={inv?.patients?.name ?? "—"} />
          {inv?.patients?.phone && <Row label="الجوال" value={inv.patients.phone} ltr />}
          <Row label="عن الفاتورة" value={inv?.invoice_number ?? "—"} ltr />
          <Row label="طريقة الدفع" value={METHOD_AR(pay.gateway as string)} />
          {pay.transaction_id && <Row label="الرقم المرجعي" value={pay.transaction_id as string} ltr />}
          {staff && <Row label="استلمها" value={(staff.name_ar ?? staff.name) as string} />}
        </div>

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>المبلغ المستلم</p>
          <p className="text-3xl font-black ltr-nums text-white print:text-black">
            {fmt(Number(pay.amount ?? 0))}{" "}
            <span className="text-sm" style={{ color: "var(--text-3)" }}>ر.ع</span>
          </p>
        </div>

        <p className="text-[10.5px] mt-8 pt-4" style={{ color: "var(--text-4)", borderTop: "1px solid var(--hairline)" }}>
          هذا السند إثبات استلام المبلغ المذكور أعلاه فقط، ولا يعني سداد الفاتورة بالكامل.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[12px]" style={{ color: "var(--text-4)" }}>{label}</span>
      <span className={`text-[13px] font-bold text-white print:text-black ${ltr ? "ltr-nums" : ""}`}
        dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}
