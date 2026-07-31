"use client";

import Link from "next/link";
import { Lock, ShieldCheck, Eye, Download, FileLock2, ServerCog,  KeyRound } from "lucide-react";
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
      { t: "نسخ احتياطية يومية", d: "قاعدة بيانات مُدارة على بنية مؤسسية، بنسخ يومية وإمكانية الاسترجاع إلى نقطة زمنية محدّدة.", i: ServerCog },
      { t: "تشفير وحماية على الحافّة", d: "كل اتصال مُشفّر بشهادات TLS، وحماية من هجمات الحجب الموزّع على مستوى الشبكة.", i: ShieldCheck },
      { t: "أسرار خارج الكود", d: "لا مفتاح في المستودع. مفاتيح المنصّة في جدول لا تقرؤه أي جلسة متصفّح.", i: KeyRound },
      { t: "لا بطاقات بنكية عندنا", d: "الدفع يتمّ لدى مزوّد الدفع؛ يصلنا رقم العملية ونتيجتها فقط.", i: Lock },
    ],
    honestT: "الامتثال والحوكمة",
    honestLede: "نعمل تحت القانون العُماني، ونطبّق ضوابطه على كل عيادة منذ اليوم الأول لا عند الطلب.",
    honest: [
      "التزام كامل بقانون حماية البيانات الشخصية العُماني (المرسوم السلطاني ٦/٢٠٢٢)",
      "موافقات المرضى موقّعة رقمياً ومحفوظة في ملفّ المريض",
      "مراجعات أمنية داخلية دورية على الصلاحيات وسياسات الوصول",
      "إشعار فوري للعيادة المعنيّة عند أي حدث أمني يخصّها",
    ],
    foundT: "مصمَّم للتدقيق",
    foundLede: "كل صلاحية وكل سياسة وصول قابلة للمراجعة والإثبات، وكل عملية حسّاسة لها أثر في سجلّ لا يُعدَّل. حين يسألك مدقّق أو جهة تنظيمية من فتح هذا الملفّ ومتى، الجواب موجود.",
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
      { t: "Daily backups", d: "A managed database on enterprise infrastructure, backed up daily with point-in-time recovery.", i: ServerCog },
      { t: "Encryption and edge protection", d: "Every connection is TLS encrypted, with distributed denial-of-service protection at the network layer.", i: ShieldCheck },
      { t: "Secrets outside the code", d: "No key in the repository. Platform keys live in a table no browser session can read.", i: KeyRound },
      { t: "We never hold card data", d: "Payment happens at the provider; we receive the transaction reference and its result.", i: Lock },
    ],
    honestT: "Compliance and governance",
    honestLede: "We operate under Omani law, and its controls are applied to every clinic from day one rather than on request.",
    honest: [
      "Full compliance with Oman's Personal Data Protection Law (Royal Decree 6/2022)",
      "Patient consents signed digitally and held on the patient file",
      "Regular internal security reviews of permissions and access policies",
      "Immediate notification to the clinic concerned in the event of a security incident",
    ],
    foundT: "Built to be audited",
    foundLede: "Every permission and every access policy is reviewable and provable, and every sensitive action leaves a trace in a log that cannot be edited. When an auditor or a regulator asks who opened a file and when, the answer exists.",
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

      {/* Audit readiness, as a card rather than a list. It is the last thing a
          buyer reads on this page and the thing a regulator asks about first. */}
      <section className="sec">
        <div className="wrap">
          <Reveal className="card" style={{ padding: "clamp(2rem, 4.5vw, 3rem)", maxWidth: "80ch" }}>
            <span className="ico" style={{ color: "var(--blue-lit)" }}>
              <FileLock2 size={20} />
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
