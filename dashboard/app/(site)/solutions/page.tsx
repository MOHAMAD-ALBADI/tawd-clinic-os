"use client";

import { useSite } from "@/components/site/lang";
import { PageHero, CardGrid, CtaBand } from "@/components/site/kit";
import { SECTORS } from "@/lib/site/content/solutions";

export default function SolutionsIndex() {
  const { lang } = useSite();
  return (
    <>
      <PageHero
        tag={lang === "ar" ? "الحلول" : "Solutions"}
        title={lang === "ar" ? "الأساس واحد، وما فوقه يختلف" : "One foundation, different practices on top"}
        lede={lang === "ar"
          ? "عيادة الأسنان تحتاج مخطّط أسنان، والجلدية تحتاج جلسات متسلسلة، والمجموعة تحتاج فروعاً معزولة. اختر تخصّصك وشوف ما يتغيّر."
          : "A dental clinic needs a tooth chart, dermatology needs session courses, a group needs isolated branches. Pick your practice and see what changes."}
      />
      <section className="sec">
        <div className="wrap">
          <CardGrid items={SECTORS.map((s) => ({
            t: s[lang].name, d: s[lang].lede, href: `/solutions/${s.slug}`,
          }))} />
        </div>
      </section>
      <CtaBand
        title={lang === "ar" ? "تخصّصك غير مذكور؟" : "Practice not listed?"}
        lede={lang === "ar"
          ? "الأساس يخدم أي عيادة. تحدّث معنا ونقول لك بصراحة إن كان يناسبك."
          : "The foundation serves any clinic. Talk to us and we'll tell you straight whether it fits."}
      />
    </>
  );
}
