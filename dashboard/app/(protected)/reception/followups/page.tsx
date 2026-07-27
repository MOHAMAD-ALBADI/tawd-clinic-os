import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { getFollowUps } from "@/lib/reception-followups";
import { FollowUpBoardView } from "@/components/reception/followup-board";

export const metadata = { title: "المتابعة — طود" };
export const dynamic = "force-dynamic";

/* What the front desk does between patients.

   The day board shows who is here. This shows who is not, and should be:
   tomorrow's unconfirmed appointments, today's no-shows, treatment the patient
   accepted and nobody booked, patients overdue a check-up, unpaid invoices, and
   the waitlist. Every dental practice-management product measured against this
   one leads with these lists, because they are what keeps a chair full. */
export default async function ReceptionFollowUpsPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const board = await getFollowUps(claims.clinic_id);
  const total =
    board.confirmTomorrow.length + board.rebookNoShows.length + board.recallDue.length +
    board.unscheduledTreatment.length + board.waitlist.length + board.outstanding.length;

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">FOLLOW-UPS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">المتابعة</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          {total > 0
            ? `${total} مكالمة تملأ الكراسي — مرتّبة حسب ما يستحق الاتصال أولاً`
            : "لا متابعات مطلوبة الآن"}
        </p>
      </div>

      <FollowUpBoardView board={board} />
    </div>
  );
}
