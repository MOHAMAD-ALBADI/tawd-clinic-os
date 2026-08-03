import { notFound, redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { rolesOf } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/sura/print-button";
import { DocBody } from "@/components/sura/doc-body";

export const dynamic = "force-dynamic";

/* A document Sura wrote, on paper.
 *
 * Same approach as the monthly report and for the same reason: the
 * browser is the only Arabic typesetter in the stack that gets bidi and
 * glyph shaping right, so the document is a page and its print dialog
 * is the export.
 */
export default async function SuraDoc({ params }: { params: Promise<{ id: string }> }) {
  const claims = await getUserClaims();
  if (!claims || !rolesOf(claims).includes("clinic_admin")) redirect("/login");

  const { id } = await params;
  const sb = await createServerSupabaseClient();
  const { data } = await sb
    .from("sura_documents")
    .select("title, body_md, prompt, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const clinicRes = await sb
    .from("tawd_clinics")
    .select("name, name_ar, vat_number, phone")
    .limit(1)
    .maybeSingle();
  const clinic = clinicRes.data;

  return (
    <div className="doc">
      <PrintButton />

      <article className="sheet">
        <header className="doc__head">
          <div>
            <h1>{data.title}</h1>
            <p className="doc__sub">{clinic?.name_ar ?? clinic?.name ?? "العيادة"}</p>
          </div>
          <div className="doc__meta">
            {clinic?.vat_number && <p>الرقم الضريبي: {clinic.vat_number}</p>}
            {clinic?.phone && <p>{clinic.phone}</p>}
            <p>
              {new Date(data.created_at as string).toLocaleDateString("ar-OM", {
                timeZone: "Asia/Muscat", day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
        </header>

        <DocBody md={data.body_md as string} />

        <footer className="doc__foot">
          {data.prompt && <p className="doc__ask">طُلب: {data.prompt}</p>}
          <p>
            أعدّته سُرى من بيانات النظام لحظة إصداره. الأرقام محسوبة من
            السجلات المسجّلة، لا من إدخال يدوي.
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
          font-size: 14px; line-height: 1.95;
        }
        .doc__head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 2rem; padding-bottom: 1.4rem; margin-bottom: 2rem;
          border-bottom: 2px solid #14161a;
        }
        .sheet h1 { font-size: 1.6rem; font-weight: 800; margin: 0; line-height: 1.4; }
        .doc__sub { color: #5b6472; margin: .35rem 0 0; font-size: .95rem; }
        .doc__meta { text-align: left; font-size: .78rem; color: #5b6472; white-space: nowrap; }
        .doc__meta p { margin: 0 0 .2rem; }
        .doc__foot {
          margin-top: 2.6rem; padding-top: 1.2rem; border-top: 1px solid #dfe2e7;
          font-size: .74rem; color: #6b7280;
        }
        .doc__ask { font-style: italic; margin-bottom: .5rem; }
        .doc__brand { font-weight: 800; color: #14161a; margin-top: .5rem; }

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
