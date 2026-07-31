"use client";

import Link from "next/link";
import { Lock, ShieldCheck, Eye, Download, FileLock2, ServerCog, AlertTriangle, KeyRound } from "lucide-react";
import { useSite } from "@/components/site/lang";
import { PageHero, Head, CardGrid, SplitList, CtaBand } from "@/components/site/kit";
import { Reveal } from "@/components/site/reveal";

/* Security.

   The strongest page on this site, because every claim on it is a decision that
   was actually made in the code and can be checked. No badges, no compliance
   logos we do not hold — the honest version is more convincing to anyone who
   knows what to look for, and the ones who do not are not the ones deciding. */
const C = {
  ar: {
    tag: "الأمان",
    h1: "العزل مفروض في قاعدة البيانات، لا في الشاشة",
    lede: "الفرق جوهري. إخفاء البيانات في الواجهة يسقط مع أول خطأ برمجي؛ الرفض في قاعدة البيانات يصمد حتى لو أخطأ الكود بالكامل.",
    coreT: "أربع قواعد لا تُخترق",
    core: [
      { t: "كل صفّ لعيادة واحدة", d: "سياسة أمان على مستوى الصفّ (RLS) ترفض الاستعلام قبل أن يصل إلى التطبيق. عيادة لا تقدر تقرأ عيادة أخرى — لا بالخطأ ولا بالقصد.", i: Lock },
      { t: "سجلّ لا يُعدَّل", d: "كل عملية حسّاسة تُسجَّل، ولا يمكن تعديل السجلّ ولا حذفه — ولا من داخل النظام نفسه.", i: FileLock2 },
      { t: "أدوار تحدّ ما يُرى", d: "موظف الاستقبال لا يفتح السجلّ الطبي، والمحاسب لا يرى ما لا يخصّ المال، والطبيب لا يرى مرضى طبيب آخر.", i: Eye },
      { t: "بياناتك تخرج معك", d: "نسخة كاملة متى طلبت، ثم حذف نهائي. لا عقد يحتجز بياناتك رهينة.", i: Download },
    ],
    infraT: "البنية التحتية",
    infra: [
      { t: "قاعدة بيانات مُدارة", d: "Postgres على Supabase، بنسخ احتياطية يومية واسترجاع لنقطة زمنية.", i: ServerCog },
      { t: "شبكة حافّة عالمية", d: "التطبيق على Vercel، بشهادات TLS وحماية من الحجب الموزّع.", i: ShieldCheck },
      { t: "أسرار خارج الكود", d: "لا مفتاح في المستودع. مفاتيح المنصّة في جدول لا تقرؤه أي جلسة متصفّح.", i: KeyRound },
      { t: "لا بطاقات بنكية عندنا", d: "الدفع يتمّ لدى مزوّد الدفع؛ يصلنا رقم العملية ونتيجتها فقط.", i: Lock },
    ],
    honestT: "ما لا ندّعيه",
    honestLede: "شهادات الامتثال تُشترى بالوقت والتدقيق، لا بالنيّة. نقول أين نقف بالضبط.",
    honest: [
      "لسنا حاصلين على SOC 2 ولا ISO 27001 — ولن نضع شاراتهما",
      "نلتزم بقانون حماية البيانات الشخصية العُماني (المرسوم ٦/٢٠٢٢)",
      "بيانات العيادة تُخزَّن لدى مزوّدين عالميين، ونقول ذلك صراحةً في سياسة الخصوصية",
      "أي خلل أمني نكتشفه نبلّغ العيادة المتأثّرة به، لا ننتظر أن تسأل",
    ],
    foundT: "وجدنا ثغرة وأغلقناها",
    foundLede: "أثناء تدقيق داخلي وجدنا أن صلاحية ممنوحة تلقائياً في قاعدة البيانات كانت تتجاوز منعاً كتبناه بأنفسنا. أُغلقت، وأُعيد تدقيق كل الدوال المشابهة. نذكرها لأن شركة لا تجد ثغرات هي شركة لا تبحث عنها.",
    cta: "اسأل عن أي بند هنا",
  },
  en: {
    tag: "Security",
    h1: "Isolation enforced by the database, not the screen",
    lede: "The difference is fundamental. Hiding data in the interface fails the first time application code is wrong; refusing it in the database holds even if the code is wrong everywhere.",
    coreT: "Four rules that do not bend",
    core: [
      { t: "Every row belongs to one clinic", d: "A row-level security policy refuses the query before it reaches the application. One clinic cannot read another — by accident or on purpose.", i: Lock },
      { t: "An audit log that cannot be edited", d: "Every sensitive action is recorded, and the record cannot be altered or deleted — not even from inside the system.", i: FileLock2 },
      { t: "Roles bound what is visible", d: "Reception cannot open the clinical record, accounting sees only what concerns money, and a doctor does not see another doctor's patients.", i: Eye },
      { t: "Your data leaves with you", d: "A full export whenever you ask, then permanent deletion. No contract holds your data hostage.", i: Download },
    ],
    infraT: "Infrastructure",
    infra: [
      { t: "Managed database", d: "Postgres on Supabase, with daily backups and point-in-time recovery.", i: ServerCog },
      { t: "Global edge network", d: "The application runs on Vercel, with TLS and distributed denial-of-service protection.", i: ShieldCheck },
      { t: "Secrets outside the code", d: "No key in the repository. Platform keys live in a table no browser session can read.", i: KeyRound },
      { t: "We never hold card data", d: "Payment happens at the provider; we receive the transaction reference and its result.", i: Lock },
    ],
    honestT: "What we do not claim",
    honestLede: "Compliance certifications are bought with time and audit, not intent. Here is exactly where we stand.",
    honest: [
      "We are not SOC 2 or ISO 27001 certified — and we will not display their badges",
      "We operate under Oman's Personal Data Protection Law (Royal Decree 6/2022)",
      "Clinic data is stored with global providers, and our privacy policy says so plainly",
      "Any security fault we find, we tell the affected clinic — we do not wait to be asked",
    ],
    foundT: "We found a hole and closed it",
    foundLede: "During an internal audit we found that a grant applied automatically by the database was overriding a restriction we had written ourselves. It was closed, and every similar function re-audited. We mention it because a company that never finds holes is a company that is not looking.",
    cta: "Ask us about any line here",
  },
} as const;

export default function SecurityPage() {
  const { lang } = useSite();
  const c = C[lang];
  return (
    <>
      <PageHero
        tag={c.tag} title={c.h1} lede={c.lede}
        cta={{ href: "/contact", label: c.cta }}
        cta2={{ href: "/legal/privacy", label: lang === "ar" ? "سياسة الخصوصية" : "Privacy policy" }}
      />

      <section className="sec">
        <div className="wrap">
          <Head title={c.coreT} />
          <CardGrid cols={2} items={c.core} />
        </div>
      </section>

      <section className="sec" style={{ borderBlock: "1px solid var(--line)", background: "rgba(255,255,255,.012)" }}>
        <div className="wrap">
          <Head title={c.infraT} />
          <CardGrid cols={2} items={c.infra} />
        </div>
      </section>

      <SplitList
        tag={lang === "ar" ? "بصراحة" : "Plainly"}
        title={c.honestT} lede={c.honestLede} points={c.honest}
      />

      {/* Publishing a fault found and fixed is a stronger security signal than
          any badge. It says the code is examined, and it says we will tell you. */}
      <section className="sec">
        <div className="wrap">
          <Reveal className="card" style={{ padding: "clamp(2rem, 4.5vw, 3rem)", maxWidth: "80ch" }}>
            <span className="ico" style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,.28)", background: "rgba(245,158,11,.1)" }}>
              <AlertTriangle size={20} />
            </span>
            <h2 className="h2" style={{ fontSize: "clamp(1.3rem, 2.6vw, 1.9rem)" }}>{c.foundT}</h2>
            <p className="lede" style={{ marginTop: "1rem" }}>{c.foundLede}</p>
            <Link href="/legal/data-deletion" className="btn btn--out btn--sm" style={{ marginTop: "1.6rem" }}>
              {lang === "ar" ? "كيف نتعامل مع بياناتك" : "How we handle your data"}
            </Link>
          </Reveal>
        </div>
      </section>

      <CtaBand title={lang === "ar" ? "عندك سؤال أمني محدّد؟" : "Have a specific security question?"}
        lede={lang === "ar" ? "اسأله مباشرة — يجيبك من كتب الكود." : "Ask it directly — the person who wrote the code answers."} />
    </>
  );
}
