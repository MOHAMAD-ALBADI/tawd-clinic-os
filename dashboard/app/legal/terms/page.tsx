export const metadata = { title: "شروط الاستخدام" };

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
function L({ items }: { items: string[] }) {
  return (
    <ul className="text-[13.5px] leading-7 mb-3 space-y-1">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span style={{ color: "var(--accent-1)" }}>•</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <>
      <p className="eyebrow">TERMS</p>
      <h1 className="text-2xl font-black text-white tracking-tight mt-1">شروط الاستخدام</h1>
      <p className="text-[12px] mt-2" style={{ color: "var(--text-4)" }}>
        آخر تحديث: ٢٩ يوليو ٢٠٢٦ · بين طَود والعيادة المشتركة
      </p>

      <H>الخدمة</H>
      <P>
        تمنح طَود العيادة حقّ استخدام المنصّة طوال مدّة الاشتراك: إدارة المرضى والمواعيد والفواتير
        والمخزون، ومساعداً ذكياً يردّ على المرضى عبر القنوات المفعّلة. ما تشمله الباقة محدَّد في العرض
        المتّفق عليه، لا في هذه الصفحة.
      </P>

      <H>المسؤولية الطبية</H>
      <P>
        <strong>طَود أداة تشغيل، لا جهة طبية.</strong> القرار السريري للطبيب المرخّص وحده. المساعد
        الذكي لا يشخّص ولا يصف علاجاً ولا يقدّم استشارة طبية، وما يكتبه لا يُعتمد عليه في قرار علاجي.
        وتظلّ العيادة مسؤولة عن صحّة ما يُدخَل في النظام وعن كل قرار يُتّخذ بناءً عليه.
      </P>

      <H>التزامات العيادة</H>
      <L
        items={[
          "الحصول على موافقة المريض على معالجة بياناته والتواصل معه عبر القنوات المفعّلة.",
          "الالتزام بسياسات واتساب وإنستغرام من Meta — ولا تُستخدم القنوات في رسائل غير مرغوبة.",
          "حفظ سرّية حسابات الموظفين، وإلغاء حساب من ينتهي عمله فوراً.",
          "صحّة البيانات الضريبية والفوترة المُدخَلة، وتقديم إقراراتها للجهات المختصة.",
          "عدم استخدام المنصّة في أي غرض مخالف لأنظمة سلطنة عُمان.",
        ]}
      />

      <H>ملكية البيانات</H>
      <P>
        <strong>بيانات المرضى ملك للعيادة، لا لطَود.</strong> تستطيع العيادة طلب نسخة منها في أي وقت.
        ولا نستخدمها لأغراضنا ولا نشاركها مع طرف ثالث إلا بقدر ما يلزم لتشغيل الخدمة كما هو مبيّن في
        سياسة الخصوصية.
      </P>

      <H>الاشتراك والدفع</H>
      <P>
        الاشتراك شهري ما لم يُتّفق على خلافه. عند التأخّر عن السداد يُنبَّه المشترك، ثم يُوقف الحساب
        مؤقتاً بعد ثلاثة أيام من تاريخ الاستحقاق. <strong>الإيقاف لا يحذف شيئاً</strong> — تُستأنف
        الخدمة بكامل البيانات عند السداد.
      </P>

      <H>التوفّر</H>
      <P>
        نبذل جهدنا لإبقاء الخدمة متاحة، لكنها تعتمد على أطراف خارجية — Meta وGoogle ومزوّدي الاستضافة —
        وانقطاعٌ لديهم ينعكس علينا. ولذلك تبقى القدرة على تشغيل العيادة يدوياً مسؤولية العيادة.
      </P>

      <H>حدود المسؤولية</H>
      <P>
        لا تتحمّل طَود أي ضرر غير مباشر أو تبعي. وفي كل الأحوال لا تتجاوز مسؤوليتها الإجمالية ما دفعته
        العيادة خلال الاثني عشر شهراً السابقة للحادثة. ولا يشمل هذا الحدّ ما لا يجوز تحديده نظاماً.
      </P>

      <H>الإنهاء</H>
      <P>
        لأيّ من الطرفين إنهاء الاتفاق بإشعار مدّته ثلاثون يوماً. وعند الإنهاء تُسلَّم العيادة نسخة
        كاملة من بياناتها، ثم تُحذف نهائياً بطلبها.
      </P>

      <H>القانون الواجب التطبيق</H>
      <P>تخضع هذه الشروط لأنظمة سلطنة عُمان، وتختصّ محاكمها بأي نزاع.</P>

      <hr className="my-10" style={{ borderColor: "var(--hairline)" }} />

      <div dir="ltr" className="text-start">
        <p className="eyebrow">ENGLISH</p>
        <h2 className="text-xl font-black text-white tracking-tight mt-1 mb-4">Terms of Service</h2>

        <H>The service</H>
        <P>
          TAWD grants the clinic the right to use the platform for the term of its subscription:
          patients, appointments, invoicing, inventory, and an AI assistant that answers patients on
          the enabled channels. What a plan includes is set by the agreed quote, not by this page.
        </P>

        <H>Medical responsibility</H>
        <P>
          <strong>TAWD is operational software, not a medical provider.</strong> Clinical decisions
          belong to the licensed clinician alone. The AI assistant does not diagnose, prescribe or give
          medical advice, and nothing it writes may be relied on for a treatment decision. The clinic
          remains responsible for the accuracy of what is entered and for every decision taken on it.
        </P>

        <H>Clinic obligations</H>
        <L
          items={[
            "Obtain patient consent to process their data and to contact them on the enabled channels.",
            "Comply with Meta's WhatsApp and Instagram policies — the channels are not to be used for unsolicited messaging.",
            "Keep staff credentials confidential and disable accounts as soon as employment ends.",
            "Ensure the accuracy of tax and billing data entered, and file its own returns.",
            "Not use the platform for any purpose contrary to the laws of Oman.",
          ]}
        />

        <H>Data ownership</H>
        <P>
          <strong>Patient data belongs to the clinic, not to TAWD.</strong> A clinic may request an
          export at any time. We do not use it for our own purposes and share it with third parties
          only as far as running the service requires, as set out in the Privacy Policy.
        </P>

        <H>Subscription and payment</H>
        <P>
          Billing is monthly unless otherwise agreed. On late payment the subscriber is notified, and
          the account is suspended three days after the due date.{" "}
          <strong>Suspension deletes nothing</strong> — service resumes with all data intact on payment.
        </P>

        <H>Availability</H>
        <P>
          We work to keep the service available, but it depends on third parties — Meta, Google and
          hosting providers — and an outage at theirs is an outage at ours. Keeping the clinic able to
          operate manually therefore remains the clinic&apos;s responsibility.
        </P>

        <H>Limitation of liability</H>
        <P>
          TAWD is not liable for indirect or consequential loss. In any event its total liability does
          not exceed what the clinic paid in the twelve months preceding the event. This limit does not
          apply where liability cannot be limited by law.
        </P>

        <H>Termination</H>
        <P>
          Either party may terminate on thirty days&apos; notice. On termination the clinic receives a
          full export of its data, which is then permanently deleted at its request.
        </P>

        <H>Governing law</H>
        <P>These terms are governed by the laws of Oman, whose courts have jurisdiction.</P>
      </div>
    </>
  );
}
