export const metadata = { title: "حذف البيانات" };

/* Meta asks for this URL before it will review an app, and asks a specific
   question with it: what happens when a person wants their data gone.

   The honest answer here is not "click this button". TAWD holds patient records
   on behalf of a clinic — the clinic is the controller, and a clinic cannot
   simply erase a treatment record on request because Omani medical and tax rules
   require it to be kept for a period. Offering a one-click delete would be
   promising something the law does not permit us to do. So this page says who to
   ask, what will happen, and how long it takes. */

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-white font-bold mt-8 mb-2" style={{ fontSize: "1.05rem" }}>
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] leading-7 mb-3">{children}</p>;
}

export default function DataDeletionPage() {
  return (
    <>
      <p className="eyebrow">DATA DELETION</p>
      <h1 className="text-2xl font-black text-white tracking-tight mt-1">طلب حذف البيانات</h1>

      <H>إن كنت مريضاً</H>
      <P>
        بياناتك محفوظة لدى <strong>عيادتك</strong>، وهي المتحكّم فيها. طَود تحفظها نيابةً عنها فقط.
        وجّه طلبك للعيادة مباشرةً — بالاتصال أو برسالة على رقمها — وستنفّذه طَود فور توجيهها.
      </P>
      <P>
        وإن تعذّر عليك الوصول للعيادة، راسلنا على{" "}
        <span dir="ltr">playmoham19@gmail.com</span> من الرقم أو البريد المسجّل لديها، وسنوصل طلبك
        إليها ونتابعه.
      </P>

      <H>ما الذي يُحذف فعلاً</H>
      <P>
        تُحذف بياناتك الشخصية ومحادثاتك ووسائل التواصل معك نهائياً. أمّا السجلّ الطبي والفواتير
        فيُحتفظ بهما للمدّة التي تفرضها الأنظمة الطبية والضريبية في سلطنة عُمان، ثم يُتلفان. هذا قيد
        نظامي لا خيار لنا فيه، ونذكره صراحةً بدل أن نَعِد بحذفٍ كامل لا نملكه.
      </P>
      <P>
        يبقى في سجلّ المراجعة أثرٌ يثبت أن الحذف تمّ ومتى — دون بياناتك — لأن حذفاً لا يمكن إثباته لا
        يحمي أحداً.
      </P>

      <H>المدّة</H>
      <P>يُنفَّذ الطلب خلال ثلاثين يوماً من استلامه، ويصلك تأكيد عند تنفيذه.</P>

      <H>إن كنت عيادة مشتركة</H>
      <P>
        اطلب حذف بيانات عيادتك بالكامل من <span dir="ltr">playmoham19@gmail.com</span>. تُسلَّم لك نسخة
        كاملة أولاً، ثم تُحذف نهائياً من كل الأنظمة.
      </P>

      <hr className="my-10" style={{ borderColor: "var(--hairline)" }} />

      <div dir="ltr" className="text-start">
        <p className="eyebrow">ENGLISH</p>
        <h2 className="text-xl font-black text-white tracking-tight mt-1 mb-4">
          Data Deletion Request
        </h2>

        <H>If you are a patient</H>
        <P>
          Your data is held by <strong>your clinic</strong>, which is its controller. TAWD stores it on
          the clinic&apos;s behalf. Send your request to the clinic directly — by phone or by messaging
          its number — and TAWD carries it out as soon as the clinic instructs us.
        </P>
        <P>
          If you cannot reach the clinic, write to playmoham19@gmail.com from the phone number or email
          registered with it and we will pass the request on and follow it up.
        </P>

        <H>What is actually deleted</H>
        <P>
          Your personal details, your conversations and your contact information are permanently
          deleted. Clinical records and invoices are retained for the period Omani medical and tax
          rules require, and destroyed after it. That is a legal obligation rather than a choice, and
          we state it plainly instead of promising a complete erasure we are not permitted to perform.
        </P>
        <P>
          The audit log keeps a record that the deletion happened and when — without your data — because
          a deletion nobody can prove protects nobody.
        </P>

        <H>Timing</H>
        <P>Requests are carried out within thirty days, and you are told when it is done.</P>

        <H>If you are a subscribing clinic</H>
        <P>
          Request full deletion of your clinic&apos;s data at playmoham19@gmail.com. You receive a
          complete export first, after which everything is permanently removed from all systems.
        </P>
      </div>
    </>
  );
}
