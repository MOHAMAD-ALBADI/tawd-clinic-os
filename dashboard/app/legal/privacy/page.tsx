export const metadata = { title: "سياسة الخصوصية" };

/* Written to be true, not to be reassuring. Meta reads this before granting
   advanced WhatsApp access and a clinic's lawyer reads it before signing, and
   both notice when a policy describes a product that does not exist.

   Bilingual on one URL on purpose: the review form takes a single link, and a
   reviewer who cannot read Arabic must still be able to check it. */

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

export default function PrivacyPage() {
  return (
    <>
      <p className="eyebrow">PRIVACY</p>
      <h1 className="text-2xl font-black text-white tracking-tight mt-1">سياسة الخصوصية</h1>
      <p className="text-[12px] mt-2" style={{ color: "var(--text-4)" }}>
        آخر تحديث: ٢٩ يوليو ٢٠٢٦ · تسري على منصّة طَود وقنواتها (واتساب، إنستغرام، الويب، البريد)
      </p>

      <H>مَن نحن، ودورنا</H>
      <P>
        طَود منصّة برمجية تُشغّل العيادات الطبية في سلطنة عُمان. العيادة هي <strong>المتحكّم</strong> في
        بيانات مرضاها، وطَود <strong>معالِج</strong> يعمل بتوجيهها ونيابةً عنها. لا نستخدم بيانات مرضى
        أي عيادة لأغراضنا، ولا نبيعها، ولا نشاركها مع عيادة أخرى.
      </P>

      <H>ما الذي نجمعه</H>
      <L
        items={[
          "بيانات المريض التي تُدخلها العيادة: الاسم، رقم الهاتف، تاريخ الميلاد، والمواعيد.",
          "البيانات الصحية التي يسجّلها الطبيب: التشخيص، خطة العلاج، الوصفات، ومخطط الأسنان.",
          "الرسائل الواردة والصادرة عبر واتساب وإنستغرام والمحادثة على الموقع، بما فيها الرسائل الصوتية.",
          "البيانات المالية: الفواتير، المدفوعات، وطريقة الدفع — دون أي بيانات بطاقة بنكية.",
          "بيانات موظفي العيادة: الاسم، البريد، الدور الوظيفي، وسجلّ العمليات التي ينفّذها كلٌّ منهم.",
        ]}
      />
      <P>
        <strong>لا نخزّن بيانات البطاقات البنكية إطلاقاً.</strong> عند تفعيل الدفع الإلكتروني تتم
        العملية لدى مزوّد الدفع، ولا يصلنا منها إلا نتيجة العملية ورقمها المرجعي.
      </P>

      <H>لماذا نعالجها</H>
      <L
        items={[
          "حجز المواعيد وتأكيدها والتذكير بها.",
          "ردّ المساعد الذكي «سُرى» على استفسارات المرضى نيابةً عن العيادة.",
          "إصدار الفواتير والإيصالات وحساب ضريبة القيمة المضافة كما يوجبه القانون العُماني.",
          "تشغيل العيادة: المخزون، الرواتب، المطالبات التأمينية، والتقارير الإدارية.",
          "الأمن وتتبّع الأخطاء — بسجلّ عمليات لا يُعدَّل ولا يُحذف.",
        ]}
      />

      <H>المساعد الذكي وما يُرسَل إليه</H>
      <P>
        تعتمد سُرى على نماذج لغوية من Google (Gemini). عند ردّها على رسالة، يُرسَل نصّ الرسالة وسياق
        العيادة اللازم للإجابة — الخدمات، أوقات الدوام، وتوفّر الأطباء — إضافةً إلى معلومات موجزة عن
        المريض عند الحاجة لتمييز المراجع من الجديد. <strong>لا تُرسَل السجلات الطبية التفصيلية ولا
        البيانات المالية إلى النموذج.</strong> ولا تُستخدم هذه المعطيات لتدريب أي نموذج.
      </P>
      <P>
        سُرى لا تشخّص ولا تصف علاجاً. وعند اشتباه حالة طارئة تتوقّف وتُنبّه فريق العيادة فوراً.
      </P>

      <H>الأطراف التي نستعين بها</H>
      <L
        items={[
          "Supabase — استضافة قاعدة البيانات والمصادقة.",
          "Vercel — استضافة التطبيق.",
          "Meta (WhatsApp Business Platform وInstagram) — إيصال الرسائل.",
          "Google — النماذج اللغوية وتحويل النص إلى صوت.",
          "Resend — البريد الصادر.",
          "n8n — تشغيل الأتمتة (تذكير المواعيد، المتابعة، قوائم الانتظار).",
        ]}
      />
      <P>
        كلٌّ منهم يعالج البيانات بتوجيهنا وبقدر ما تتطلّبه خدمته فقط.
      </P>

      <H>العزل بين العيادات</H>
      <P>
        كل صفّ بيانات مرتبط بعيادة واحدة، والعزل مفروض في قاعدة البيانات نفسها لا في واجهة التطبيق —
        بحيث ترفض القاعدة الوصول حتى لو أخطأ الكود. ولكل موظف دور يحدّد ما يراه، فموظف الاستقبال لا
        يرى السجلّ الطبي، ولا يرى المحاسب ما لا يخصّ المال.
      </P>

      <H>الاحتفاظ والحذف</H>
      <P>
        نحتفظ ببيانات المريض ما دامت العيادة مشتركة، ثم لمدّة تفرضها الأنظمة الطبية والضريبية في
        عُمان. عند حذف سجلّ من داخل النظام يُعلَّم كمحذوف ويختفي من كل الشاشات، ويُحتفظ به في السجلّ
        غير القابل للتعديل للمراجعة والمساءلة. وعند انتهاء علاقتنا بالعيادة، تُسلَّم لها بياناتها ثم
        تُحذف نهائياً بطلب منها.
      </P>

      <H>حقوقك</H>
      <P>
        وفق قانون حماية البيانات الشخصية العُماني (المرسوم السلطاني ٦/٢٠٢٢)، للمريض أن يطلب الاطّلاع
        على بياناته أو تصحيحها أو حذفها أو الاعتراض على معالجتها. <strong>وجّه الطلب إلى عيادتك</strong> —
        فهي المتحكّم في بياناتك. وتلتزم طَود بتنفيذ ما تطلبه العيادة خلال المدد النظامية.
      </P>

      <H>التواصل</H>
      <P>
        لأي سؤال يخصّ هذه السياسة: <span dir="ltr">playmoham19@gmail.com</span>
      </P>

      <hr className="my-10" style={{ borderColor: "var(--hairline)" }} />

      <div dir="ltr" className="text-start">
        <p className="eyebrow">ENGLISH</p>
        <h2 className="text-xl font-black text-white tracking-tight mt-1 mb-4">Privacy Policy</h2>

        <H>Who we are</H>
        <P>
          TAWD is software that runs medical clinics in the Sultanate of Oman. The clinic is the{" "}
          <strong>controller</strong> of its patients&apos; data; TAWD is a <strong>processor</strong>{" "}
          acting on the clinic&apos;s instructions. We do not use one clinic&apos;s patient data for our
          own purposes, do not sell it, and never share it with another clinic.
        </P>

        <H>What we collect</H>
        <L
          items={[
            "Patient details entered by the clinic: name, phone, date of birth, appointments.",
            "Clinical records written by the doctor: diagnosis, treatment plan, prescriptions, dental chart.",
            "Messages sent and received over WhatsApp, Instagram and web chat, including voice notes.",
            "Financial records: invoices, payments and payment method — never card details.",
            "Clinic staff details and an audit trail of the actions each of them performs.",
          ]}
        />
        <P>
          <strong>We never store bank card data.</strong> Where online payment is enabled, the
          transaction happens at the payment provider and we receive only its result and reference.
        </P>

        <H>Why we process it</H>
        <L
          items={[
            "Booking, confirming and reminding patients of appointments.",
            "Letting the AI assistant «Sura» answer patient enquiries on the clinic's behalf.",
            "Issuing invoices and receipts and computing VAT as Omani law requires.",
            "Running the clinic: inventory, payroll, insurance claims and management reporting.",
            "Security and error tracking, through an audit log that cannot be edited or deleted.",
          ]}
        />

        <H>The AI assistant</H>
        <P>
          Sura is built on Google Gemini. To answer a message we send the message text and the clinic
          context needed to reply — services, working hours, doctor availability — plus a brief patient
          summary where needed to tell a returning patient from a new one.{" "}
          <strong>Detailed medical records and financial data are never sent to the model</strong>, and
          none of it is used to train any model. Sura does not diagnose or prescribe, and stops and
          alerts clinic staff when a message suggests an emergency.
        </P>

        <H>Processors we rely on</H>
        <L
          items={[
            "Supabase — database hosting and authentication.",
            "Vercel — application hosting.",
            "Meta (WhatsApp Business Platform and Instagram) — message delivery.",
            "Google — language models and text-to-speech.",
            "Resend — outbound email.",
            "n8n — automation (reminders, follow-ups, waitlists).",
          ]}
        />

        <H>Isolation between clinics</H>
        <P>
          Every row belongs to exactly one clinic, and that isolation is enforced by the database
          itself rather than by the application — so access is refused even if application code is
          wrong. Each staff member has a role that limits what they see: reception cannot open the
          clinical record, and accounting sees only what concerns money.
        </P>

        <H>Retention and deletion</H>
        <P>
          Patient data is kept while the clinic is subscribed, and thereafter for the period Omani
          medical and tax rules require. Deleting a record inside the system marks it deleted and
          removes it from every screen while retaining it in the immutable audit log. When our
          relationship with a clinic ends, its data is exported to it and then permanently deleted on
          request.
        </P>

        <H>Your rights</H>
        <P>
          Under Oman&apos;s Personal Data Protection Law (Royal Decree 6/2022) a patient may request
          access, correction, deletion, or object to processing.{" "}
          <strong>Address the request to your clinic</strong> — it is the controller. TAWD carries out
          what the clinic instructs within the statutory periods.
        </P>

        <H>Contact</H>
        <P>playmoham19@gmail.com</P>
      </div>
    </>
  );
}
