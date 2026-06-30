"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Send, Loader2, Lock } from "lucide-react";
import { addClinicalNote } from "@/app/actions/doctor";

export function AddNoteForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await addClinicalNote(patientId, text, isPrivate);
        setText("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2 mb-3">
        <NotebookPen className="w-4 h-4" style={{ color: "#5dd9cb" }} />
        <h3 className="font-bold text-white text-sm">إضافة ملاحظة سريرية</h3>
      </div>
      {error && <div className="text-xs py-2 px-3 rounded-lg mb-3" style={{ background: "rgba(239,68,68,0.08)", color: "#F87171" }}>{error}</div>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="التشخيص، الملاحظات، خطة العلاج..."
        style={{ width: "100%", minHeight: 90, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(226,232,240,0.92)", borderRadius: 12, padding: "0.7rem 0.85rem", fontSize: 13, outline: "none", lineHeight: 1.7, resize: "vertical" }}
      />
      <div className="flex items-center justify-between mt-3">
        <button onClick={() => setIsPrivate((p) => !p)} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg"
          style={{ background: isPrivate ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${isPrivate ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.08)"}`, color: isPrivate ? "#38bdf8" : "rgba(148,163,184,0.6)" }}>
          <Lock className="w-3 h-3" /> {isPrivate ? "خاصة (للطبيب فقط)" : "مرئية للكادر"}
        </button>
        <button onClick={save} disabled={pending || !text.trim()} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", color: "white" }}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} حفظ الملاحظة
        </button>
      </div>
    </div>
  );
}
