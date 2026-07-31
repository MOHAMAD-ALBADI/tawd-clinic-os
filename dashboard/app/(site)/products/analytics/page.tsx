"use client";

import Link from "next/link";
import { BarChart3, TrendingUp, Building2, Target, LineChart, Sigma } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CardGrid, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";

/* TAWD Analytics — in development, and the page says so at the top.

   The honest version of a "coming soon" page is not a countdown and an email
   box. It is: here is what already exists, here is the specific thing being
   built on top of it, and here is why it does not exist yet. A clinic owner
   who reads that trusts the pages that do claim something. */
export default function ProductAnalyticsPage() {
  const { lang } = useSite();
  const ar = lang === "ar";

  return (
    <>
      <PageHero
        tag={ar ? "قيد التطوير" : "In development"}
        title={ar ? "الأرقام التي لا تظهر إلا حين تجمع العيادات" : "The numbers that only appear when clinics are compared"}
        lede={ar
          ? "تقارير كل عيادة تعمل اليوم داخل ClinicOS. Analytics هو الطبقة فوقها: مقارنة الفروع، والتنبّؤ بالطلب، والمقارنة بمتوسّط السوق. نُصارحك أنه لم يُشحن بعد."
          : "Per-clinic reporting already works inside ClinicOS. Analytics is the layer above it: branch comparison, demand forecasting and market benchmarks. It has not shipped yet, and we say so."}
        cta={{ href: "/products/clinic", label: ar ? "التقارير المتاحة اليوم" : "The reports available today" }}
        cta2={{ href: "/contact", label: ar ? "أخبرنا بما تحتاجه" : "Tell us what you need" }}
      />

      <section className="sec">
        <div className="wrap">
          <Head
            tag={ar ? "المتاح الآن" : "Available now"}
            title={ar ? "ما تعطيه لوحتك اليوم" : "What your dashboard already gives you"}
            lede={ar
              ? "هذه ليست وعوداً — كلّها تعمل في ClinicOS وتُحسب من عملك الفعلي، لا من تقديرات."
              : "These are not promises — all of them run in ClinicOS today, computed from your actual work rather than estimated."}
          />
          <CardGrid cols={3} items={[
            { i: TrendingUp, t: ar ? "نسبة التحصيل" : "Collection rate",
              d: ar ? "كم فُوتر وكم حُصّل فعلاً، والفرق بينهما بالاسم والتاريخ لا كرقم مجمّع." : "What was invoiced against what was actually collected, with the gap itemised by name and date rather than shown as one figure." },
            { i: Target, t: ar ? "عدم الحضور" : "No-show rate",
              d: ar ? "نسبة المواعيد التي لم تُحضر، وأثرها بالريال، وأي طبيب وأي يوم تتركّز فيه." : "The share of appointments not attended, what it costs in riyals, and which doctor and which day it concentrates on." },
            { i: BarChart3, t: ar ? "إنتاجية الأطباء" : "Doctor productivity",
              d: ar ? "المواعيد والإيراد لكل طبيب، وكم من وقته المتاح استُخدم فعلاً." : "Appointments and revenue per doctor, and how much of their available time was actually used." },
            { i: Sigma, t: ar ? "الربح الشهري" : "Monthly profit",
              d: ar ? "الإيراد ناقص المصروفات والرواتب — محسوب من القيود لا مقدَّراً على ورقة." : "Revenue less expenses and payroll — computed from the ledger, not estimated on a sheet." },
            { i: LineChart, t: ar ? "قبول الخطط العلاجية" : "Treatment plan acceptance",
              d: ar ? "كم خطة عُرضت وكم قُبلت وكم تُركت في منتصفها — وهو أوضح مؤشّر على دخل مؤجّل." : "How many plans were presented, accepted, and abandoned half-finished — the clearest signal of deferred revenue there is." },
            { i: Building2, t: ar ? "أثر سُرى" : "Sura's contribution",
              d: ar ? "كم موعداً حجزته المحادثات، وكم ساعة فارغة ملأتها قائمة الانتظار، بالريال." : "How many appointments the conversations booked, and how many empty hours the waitlist filled, in riyals." },
          ]} />
        </div>
      </section>

      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <Head
            tag={ar ? "قيد البناء" : "Being built"}
            title={ar ? "ثلاثة أشياء لا تُبنى بلا بيانات كافية" : "Three things that cannot be built without enough data"}
            lede={ar
              ? "لا نستطيع بناءها بصدق اليوم، ونفضّل قول ذلك على شحن رقم لا يعني شيئاً."
              : "We cannot build these honestly today, and we would rather say that than ship a number that means nothing."}
          />

          <div className="grid3">
            {[
              { t: ar ? "مقارنة الفروع" : "Branch comparison",
                d: ar ? "لوحة واحدة تُقارن الفروع على نفس المقاييس وتُظهر أين يتسرّب الدخل." : "One board that compares branches on the same measures and shows where revenue leaks.",
                w: ar ? "جاهز حين تُشغّل مجموعة متعدّدة الفروع النظام كاملاً — البنية موجودة، والبيانات الحقيقية للمقارنة ليست." : "Ready when a multi-branch group runs the full system — the structure exists, the real data to compare does not." },
              { t: ar ? "التنبّؤ بالطلب" : "Demand forecasting",
                d: ar ? "أي أسبوع سيمتلئ وأيّه سيفرغ، فتُوزَّع نوبات الأطباء قبل لا بعد." : "Which week will fill and which will empty, so rotas are set before rather than after.",
                w: ar ? "يحتاج موسماً كاملاً من مواعيد عيادة واحدة على الأقل. التنبّؤ من ثلاثة أشهر تخمين بواجهة جميلة." : "Needs at least one full season of one clinic's appointments. A forecast from three months is a guess with a nice interface." },
              { t: ar ? "المقارنة بالسوق" : "Market benchmarks",
                d: ar ? "أين تقف عيادتك من متوسّط تخصّصها في عُمان." : "Where your clinic stands against the average for its speciality in Oman.",
                w: ar ? "يتطلّب عيادات كثيرة تعمل على النظام، وموافقة صريحة منها على المشاركة المجهّلة. لا يُبنى بغير ذلك." : "Requires many clinics running the system and their explicit consent to anonymous pooling. It does not get built any other way." },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 60} className="card">
                <span className="clog__tag clog__tag--new" style={{ display: "inline-block", minWidth: 0 }}>
                  {ar ? "قيد البناء" : "In development"}
                </span>
                <h3 className="card__t" style={{ marginTop: "1rem" }}>{x.t}</h3>
                <p className="card__d">{x.d}</p>
                <p className="card__d" style={{ marginTop: "0.9rem", paddingTop: "0.9rem", borderTop: "1px solid var(--line)", color: "var(--tx-3)", fontSize: "0.78rem" }}>
                  {ar ? "لماذا لم يُشحن: " : "Why it has not shipped: "}{x.w}
                </p>
              </Reveal>
            ))}
          </div>

          <Reveal className="card" style={{ marginTop: "2.4rem", maxWidth: "72ch" }}>
            <h3 className="card__t">{ar ? "ماذا يعني هذا لك الآن" : "What this means for you today"}</h3>
            <p className="card__d">
              {ar
                ? "بياناتك تُجمع من اليوم الأول. حين تُشحن هذه الطبقة، تعمل على تاريخك أنت لا من صفر — بلا هجرة ولا إدخال من جديد. ولن نطلب منك دفع شيء عن ميزة لم تُشحن."
                : "Your data accumulates from day one. When this layer ships it runs on your own history rather than from zero — no migration, no re-entry. And you will not be asked to pay for a feature that has not shipped."}
            </p>
            <Link href="/resources/changelog" className="btn btn--out btn--sm" style={{ marginTop: "1.2rem" }}>
              {ar ? "تابع ما يُشحن" : "Follow what ships"}
            </Link>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title={ar ? "أي رقم تريده أنت؟" : "Which number do you want?"}
        lede={ar
          ? "الطبقة تُبنى الآن. قل لنا ما الذي تريد أن تعرفه عن عيادتك، ونبنيه أوّلاً."
          : "The layer is being built now. Tell us what you want to know about your clinic, and it gets built first."}
      />
    </>
  );
}
