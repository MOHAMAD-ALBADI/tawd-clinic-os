import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { TawdLogoMark } from "@/components/shell/tawd-logo";

/* Where a PATIENT lands after paying a clinic invoice by card.

   Public and deliberately thin. The payment is settled by WF-16's webhook from
   Thawani, not by this page — a patient's browser is not evidence, and anyone can
   open this URL. So it says what happened to the card and nothing about the
   invoice: claiming "your invoice is settled" from an unverified redirect would
   be a lie the clinic then has to explain.

   It exists because the checkout used to send patients back to Thawani's own
   domain, where nothing told them their clinic had been informed. */

export const dynamic = "force-dynamic";

const STATES = {
  done: {
    title: "تم الدفع",
    body: "وصلت عمليتكم إلى بوابة الدفع. سيظهر السداد في حساب العيادة خلال لحظات، "
        + "وإن تأخر فأبلغوا العيادة برقم الفاتورة.",
    ok: true,
  },
  cancelled: {
    title: "أُلغيت العملية",
    body: "لم يُخصم أي مبلغ من بطاقتكم. يمكنكم المحاولة من نفس الرابط، "
        + "أو السداد في العيادة مباشرة.",
    ok: false,
  },
} as const;

type State = keyof typeof STATES;

export async function generateMetadata(
  { params }: { params: Promise<{ state: string }> },
): Promise<Metadata> {
  const { state } = await params;
  const s = STATES[state as State];
  return { title: s ? `${s.title} — طَود` : "طَود", robots: { index: false } };
}

export default async function PayResultPage({
  params,
}: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const s = STATES[state as State];
  if (!s) notFound();

  const Icon = s.ok ? CheckCircle2 : XCircle;
  const colour = s.ok ? "#34d399" : "var(--text-3)";

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16">
      <div className="w-full text-center" style={{ maxWidth: 420 }}>
        <div className="flex justify-center mb-7">
          <TawdLogoMark />
        </div>

        <Icon className="w-11 h-11 mx-auto mb-4" style={{ color: colour }} strokeWidth={1.6} />

        <h1 className="text-[22px] font-black text-white tracking-tight leading-tight">
          {s.title}
        </h1>
        <p className="text-[13px] mt-3 leading-relaxed" style={{ color: "var(--text-3)" }}>
          {s.body}
        </p>

        <p className="text-[11px] mt-8" style={{ color: "var(--text-4)" }}>
          هذه الصفحة تخصّ عملية الدفع فقط — لا تحتوي أي بيانات طبية
        </p>
      </div>
    </main>
  );
}
