"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, CheckCircle2, BookOpen, MessageSquareText, Stethoscope } from "lucide-react";
import { updateSuraSettings, type SuraSettings } from "@/app/actions/sura-settings";

export function SuraSettingsForm({ initial }: { initial: SuraSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identity, setIdentity] = useState(initial.identity);
  const [tone, setTone] = useState(initial.tone);
  const [payment, setPayment] = useState(initial.payment_info);
  const [doctors, setDoctors] = useState((initial.doctors ?? []).join("\n"));
  const [instructions, setInstructions] = useState(initial.custom_instructions);
  const [knowledge, setKnowledge] = useState(initial.knowledge_base);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateSuraSettings({
          identity,
          tone,
          payment_info: payment,
          doctors: doctors.split("\n"),
          custom_instructions: instructions,
          knowledge_base: knowledge,
        });
        router.refresh();
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  const fieldStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(226,232,240,0.92)",
    borderRadius: "0.6rem",
    padding: "0.6rem 0.8rem",
    fontSize: "13px",
    outline: "none",
    width: "100%",
  };

  const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
    <div className="mb-1.5">
      <span className="text-sm font-semibold text-white">{children}</span>
      {hint && <span className="text-[11px] mr-2" style={{ color: "rgba(148,163,184,0.5)" }}>{hint}</span>}
    </div>
  );

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "#5dd9cb" }} />
          </div>
          <div>
            <h3 className="font-bold text-white">إعدادات سُرى — المساعدة الذكية</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>
              شخصية سُرى وتعليماتها ومعرفتها عن عيادتك — تنعكس فوراً على واتساب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {done && (
            <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl" style={{ color: "#34D399", background: "rgba(16,185,129,0.1)" }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> تم الحفظ
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-bold disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "white" }}
          >
            <Save className="w-3.5 h-3.5" />
            {pending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm py-2.5 px-4 rounded-xl mb-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label hint="من هي سُرى لعيادتك">هوية سُرى</Label>
            <input style={fieldStyle} value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="سُرى، موظفة الاستقبال الذكية في عيادة ..." />
          </div>
          <div>
            <Label hint="أسلوب ونبرة الردود">النبرة والأسلوب</Label>
            <input style={fieldStyle} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="احترافية ودودة، مقتضبة، خليجية مهذبة" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label hint="كيف يدفع المريض">طريقة الدفع</Label>
            <input style={fieldStyle} value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="الدفع عند الحضور في العيادة" />
          </div>
          <div>
            <Label hint="طبيب في كل سطر"><Stethoscope className="inline w-3.5 h-3.5 ml-1" />الأطباء</Label>
            <textarea style={{ ...fieldStyle, minHeight: "80px", resize: "vertical" }} value={doctors} onChange={(e) => setDoctors(e.target.value)} placeholder={"د. محمد البادي — طب عام\nد. سارة — أسنان"} />
          </div>
        </div>

        <div>
          <Label hint="أوامر سُرى الخاصة بعيادتك (احترافية)"><MessageSquareText className="inline w-3.5 h-3.5 ml-1" />التعليمات والبرومبت الاحترافي</Label>
          <textarea style={{ ...fieldStyle, minHeight: "120px", resize: "vertical", lineHeight: "1.7" }} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="اكتبي هنا أي تعليمات تريدين سُرى تلتزم بها (الأسلوب، ما يجب فعله وتجنّبه، عروض، تأمينات...)" />
        </div>

        <div>
          <Label hint="الصق هنا معلومات وملفات عيادتك النصية — سُرى تجاوب منها"><BookOpen className="inline w-3.5 h-3.5 ml-1" />قاعدة معرفة العيادة</Label>
          <textarea style={{ ...fieldStyle, minHeight: "180px", resize: "vertical", lineHeight: "1.8" }} value={knowledge} onChange={(e) => setKnowledge(e.target.value)} placeholder={"سياسة الإلغاء، التأمينات المقبولة، الأسئلة الشائعة، تفاصيل الخدمات، مواقف السيارات...\nالصق محتوى ملفات العيادة هنا وسُرى تجاوب منها مباشرة."} />
          <p className="text-[11px] mt-1.5" style={{ color: "rgba(148,163,184,0.45)" }}>
            💡 الخدمات والأسعار تُدار من صفحة «الخدمات»، والدوام من «ساعات العمل». هنا للمعلومات النصية فقط.
          </p>
        </div>
      </div>
    </div>
  );
}
