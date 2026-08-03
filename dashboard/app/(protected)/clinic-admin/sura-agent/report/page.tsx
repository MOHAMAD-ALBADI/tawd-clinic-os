import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { rolesOf } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clinicMonthStart, clinicMonthRange, clinicToday } from "@/lib/clinic-time";
import { PrintButton } from "@/components/sura/print-button";

export const metadata = { title: "تقرير الشهر — طود" };
export const dynamic = "force-dynamic";

/* A document, produced by the browser.
 *
 * The obvious way to make a PDF is a PDF library, and in Arabic that is
 * the wrong way: the common ones do no bidirectional reordering and no
 * glyph shaping, so "تقرير الشهر" comes out as disconnected letters in
 * reverse. Fixing that means shipping a shaping engine to render a page
 * the browser already renders perfectly.
 *
 * So the document is a page, styled for paper, and Ctrl+P — or the
 * button — produces the PDF. The same engine that draws the dashboard
 * draws the report, which means the Arabic is right by construction and
 * the file weighs nothing.
 */

type Row = { total: number; status: string; created_at: string };

export default async function MonthReport({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const claims = await getUserClaims();
  if (!claims || !rolesOf(claims).includes("clinic_admin")) redirect("/login");

  const { month } = await searchParams;
  const monthStart = /^\d{4}-\d{2}-\d{2}$/.test(month ?? "")
    ? (month as string)
    : clinicMonthStart();
  const { startUtc, endUtc } = clinicMonthRange(monthStart);

  const sb = await createServerSupabaseClient();
  const [invRes, apptRes, clinicRes, noShowRes] = await Promise.all([
    sb.from("invoices").select("total, status, created_at")
      .gte("created_at", startUtc).lt("created_at", endUtc).is("deleted_at", null),
    sb.from("appointments").select("status")
      .gte("slot_time", startUtc).lt("slot_time", endUtc).is("deleted_at", null),
    sb.from("tawd_clinics").select("name, name_ar, vat_number, phone, address").limit(1).maybeSingle(),
    sb.from("sura_goals").select("value_omr, state, kind")
      .gte("created_at", startUtc).lt("created_at", endUtc),
  ]);

  const invoices = (invRes.data ?? []) as Row[];
  const appts = (apptRes.data ?? []) as { status: string }[];
  const clinic = clinicRes.data;
  const goals = (noShowRes.data ?? []) as { value_omr: number; state: string; kind: string }[];

  const billed = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const collected = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total || 0), 0);
  const collectionRate = billed > 0 ? (collected / billed) * 100 : 0;

  const done = appts.filter((a) => a.status === "completed").length;
  const noShow = appts.filter((a) => a.status === "no_show").length;
  const cancelled = appts.filter((a) => a.status === "cancelled").length;
  const noShowRate = appts.length > 0 ? (noShow / appts.length) * 100 : 0;

  const agentEarned = goals
    .filter((g) => g.state === "done")
    .reduce((s, g) => s + Number(g.value_omr || 0), 0);
  const agentWatching = goals
    .filter((g) => g.state === "open" || g.state === "waiting")
    .reduce((s, g) => s + Number(g.value_omr || 0), 0);

  const omr = (n: number) =>
    `${n.toLocaleString("ar-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ر.ع`;
  const pct = (n: number) => `${n.toLocaleString("ar-OM", { maximumFractionDigits: 1 })}٪`;

  const monthLabel = new Date(`${monthStart}T00:00:00+04:00`).toLocaleDateString("ar-OM", {
    month: "long", year: "numeric", timeZone: "Asia/Muscat",
  });

  return (
    <div className="doc">
      <PrintButton />

      <article className="sheet">
        <header className="doc__head">
          <div>
            <h1>{clinic?.name_ar ?? clinic?.name ?? "العيادة"}</h1>
            <p className="doc__sub">تقرير الأداء الشهري — {monthLabel}</p>
          </div>
          <div className="doc__meta">
            {clinic?.vat_number && <p>الرقم الضريبي: {clinic.vat_number}</p>}
            {clinic?.phone && <p>{clinic.phone}</p>}
            <p>صدر في {new Date().toLocaleDateString("ar-OM", { timeZone: "Asia/Muscat" })}</p>
          </div>
        </header>

        <section>
          <h2>المال</h2>
          <table>
            <tbody>
              <tr><th>إجمالي ما فُوتر</th><td>{omr(billed)}</td></tr>
              <tr><th>ما حُصّل فعلاً</th><td>{omr(collected)}</td></tr>
              <tr><th>المتبقّي</th><td>{omr(billed - collected)}</td></tr>
              <tr className="hi"><th>نسبة التحصيل</th><td>{pct(collectionRate)}</td></tr>
              <tr><th>عدد الفواتير</th><td>{invoices.length.toLocaleString("ar-OM")}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>المواعيد</h2>
          <table>
            <tbody>
              <tr><th>إجمالي المواعيد</th><td>{appts.length.toLocaleString("ar-OM")}</td></tr>
              <tr><th>مكتملة</th><td>{done.toLocaleString("ar-OM")}</td></tr>
              <tr><th>ملغاة</th><td>{cancelled.toLocaleString("ar-OM")}</td></tr>
              <tr><th>لم يحضر</th><td>{noShow.toLocaleString("ar-OM")}</td></tr>
              <tr className="hi"><th>نسبة عدم الحضور</th><td>{pct(noShowRate)}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>سُرى — ما فعلته بلا أن يُطلب منها</h2>
          <table>
            <tbody>
              <tr><th>أهداف رصدتها</th><td>{goals.length.toLocaleString("ar-OM")}</td></tr>
              <tr className="hi"><th>دخل استُرجع</th><td>{omr(agentEarned)}</td></tr>
              <tr><th>قيمة ما زالت قيد المتابعة</th><td>{omr(agentWatching)}</td></tr>
            </tbody>
          </table>
          <p className="doc__note">
            «دخل استُرجع» هو مجموع قيمة الأهداف التي أُغلقت بنجاح — كرسي فارغ
            أُعيد ملؤه، أو خطة علاجية متوقّفة استُؤنفت. القيمة مأخوذة من سعر
            الخدمة في قائمة العيادة، لا من تقدير.
          </p>
        </section>

        <footer className="doc__foot">
          <p>
            هذا التقرير مُولَّد آلياً من بيانات النظام لحظة إصداره. الأرقام
            محسوبة من الفواتير والمواعيد المسجّلة، لا من إدخال يدوي.
          </p>
          <p className="doc__brand">طَود — نظام إدارة العيادات</p>
        </footer>
      </article>

      <style>{`
        .doc { background: #f1f2f4; min-height: 100vh; padding: 2rem 1rem; }
        .sheet {
          background: #fff; color: #14161a;
          max-width: 820px; margin: 0 auto; padding: 3rem 3.2rem;
          border-radius: 4px; box-shadow: 0 10px 40px rgba(0,0,0,.18);
          font-size: 14px; line-height: 1.9;
        }
        .doc__head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 2rem; padding-bottom: 1.4rem; margin-bottom: 2rem;
          border-bottom: 2px solid #14161a;
        }
        .sheet h1 { font-size: 1.7rem; font-weight: 800; margin: 0; }
        .doc__sub { color: #5b6472; margin: .35rem 0 0; font-size: .95rem; }
        .doc__meta { text-align: left; font-size: .78rem; color: #5b6472; }
        .doc__meta p { margin: 0 0 .2rem; }
        .sheet section { margin-bottom: 2.2rem; break-inside: avoid; }
        .sheet h2 {
          font-size: 1rem; font-weight: 800; margin: 0 0 .8rem;
          padding-bottom: .45rem; border-bottom: 1px solid #dfe2e7;
        }
        .sheet table { width: 100%; border-collapse: collapse; }
        .sheet th, .sheet td { padding: .55rem .2rem; border-bottom: 1px solid #eceef1; }
        .sheet th { text-align: start; font-weight: 500; color: #4a5361; width: 60%; }
        .sheet td { text-align: end; font-weight: 700; font-variant-numeric: tabular-nums; }
        .sheet tr.hi th, .sheet tr.hi td { color: #1e52d6; font-weight: 800; }
        .doc__note { font-size: .76rem; color: #6b7280; margin-top: .9rem; line-height: 1.8; }
        .doc__foot {
          margin-top: 2.6rem; padding-top: 1.2rem; border-top: 1px solid #dfe2e7;
          font-size: .74rem; color: #6b7280;
        }
        .doc__brand { font-weight: 800; color: #14161a; margin-top: .5rem; }

        /* Paper. The shadow, the grey field and the button are screen
           furniture and have no business on a printed page. */
        @media print {
          .doc { background: #fff; padding: 0; }
          .sheet { box-shadow: none; max-width: none; padding: 0; border-radius: 0; }
          .noprint { display: none !important; }
          @page { margin: 18mm 16mm; }
        }
      `}</style>
    </div>
  );
}
