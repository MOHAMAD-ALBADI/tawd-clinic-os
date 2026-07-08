"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, FileText, ImageIcon, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordAttachment, getAttachmentUrl, deleteAttachment } from "@/app/actions/attachments";

export type Attachment = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string;
  created_at: string;
};

const CAT_LABEL: Record<string, string> = {
  xray: "أشعة", report: "تقرير", image: "صورة", document: "مستند", general: "ملف",
};

const humanSize = (b: number | null) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

/** Patient files — client uploads straight to the clinic's isolated storage folder
    (Storage RLS enforces clinic_id), then we record metadata. */
export function PatientAttachments({
  patientId,
  clinicId,
  attachments,
}: {
  patientId: string;
  clinicId: string;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("xray");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (file.size > 25 * 1024 * 1024) { setErr("الحد الأقصى 25 ميجابايت"); return; }
    setUploading(true);
    try {
      const sb = createClient();
      const safe = file.name.replace(/[^\w.\-؀-ۿ]/g, "_");
      const path = `${clinicId}/${patientId}/${Date.now()}-${safe}`;
      const { error: upErr } = await sb.storage.from("patient-files").upload(path, file, { upsert: false });
      if (upErr) { setErr(`تعذّر الرفع: ${upErr.message}`); setUploading(false); return; }
      const r = await recordAttachment({
        patientId, filePath: path, fileName: file.name,
        mimeType: file.type, sizeBytes: file.size, category,
      });
      if (!r.ok) { setErr(r.reason); }
      else router.refresh();
    } catch {
      setErr("تعذّر الرفع — حاول مجدداً");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function open(id: string) {
    start(async () => {
      const r = await getAttachmentUrl(id);
      if (r.ok) window.open(r.url, "_blank", "noopener");
      else setErr(r.reason);
    });
  }
  function remove(id: string) {
    start(async () => {
      const r = await deleteAttachment(id);
      if (r.ok) router.refresh(); else setErr(r.reason);
    });
  }

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <Paperclip className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          الملفات والمرفقات
        </h3>
        <div className="flex items-center gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field" style={{ fontSize: 11, padding: "0.3rem 0.6rem", width: "auto" }}>
            {["xray", "report", "image", "document", "general"].map((c) => (
              <option key={c} value={c} style={{ background: "#131315" }}>{CAT_LABEL[c]}</option>
            ))}
          </select>
          <label className="btn-primary" style={{ padding: "0.4rem 0.9rem", fontSize: 12, cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "جارٍ الرفع…" : "رفع ملف"}
            <input ref={fileRef} type="file" onChange={onFile} disabled={uploading} className="hidden"
              accept="image/*,.pdf,.doc,.docx,.dcm" />
          </label>
        </div>
      </div>

      {err && <p className="text-[12px] mb-2" style={{ color: "#fda4b4" }}>{err}</p>}

      {attachments.length === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: "var(--text-4)" }}>لا ملفات — ارفع أشعة أو تقارير أو صور</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => {
            const isImg = (a.mime_type ?? "").startsWith("image/");
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {isImg ? <ImageIcon className="w-3.5 h-3.5" style={{ color: "var(--text-2)" }} /> : <FileText className="w-3.5 h-3.5" style={{ color: "var(--text-2)" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-white truncate">{a.file_name}</p>
                  <p className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>
                    {CAT_LABEL[a.category] ?? a.category} · {humanSize(a.size_bytes)}
                  </p>
                </div>
                <button onClick={() => open(a.id)} disabled={pending} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--accent-1)" }} aria-label="فتح">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(a.id)} disabled={pending} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "#fda4b4" }} aria-label="حذف">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
