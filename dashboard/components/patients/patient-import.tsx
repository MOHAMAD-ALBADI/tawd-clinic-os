"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowRight } from "lucide-react";
import { importPatients, type ImportRow } from "@/app/actions/patients-import";

/* minimal robust CSV parser: quotes, escaped quotes, commas, CRLF, BOM */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c === "\r") { /* skip */ }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const FIELDS: { key: keyof ImportRow; label: string; kw: RegExp }[] = [
  { key: "name",        label: "الاسم *",       kw: /name|الاسم|اسم/i },
  { key: "phone",       label: "الجوال",        kw: /phone|mobile|جوال|هاتف|رقم/i },
  { key: "dob",         label: "تاريخ الميلاد", kw: /dob|birth|ميلاد|تاريخ/i },
  { key: "gender",      label: "الجنس",         kw: /gender|sex|جنس/i },
  { key: "email",       label: "البريد",        kw: /email|mail|بريد|ايميل/i },
  { key: "national_id", label: "الهوية",        kw: /national|id|هوية|مدني/i },
];

export function PatientImport({ clinicId, onClose }: { clinicId?: string; onClose?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null); setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setErr("الملف يجب أن يكون CSV — من Excel: حفظ باسم → CSV UTF-8");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result ?? ""));
      if (parsed.length < 2) { setErr("الملف فارغ أو بلا بيانات"); return; }
      const hdr = parsed[0].map((h) => h.trim());
      setHeaders(hdr);
      setRows(parsed.slice(1));
      /* auto-map columns by header keywords */
      const auto: Record<string, number> = {};
      for (const f of FIELDS) {
        const idx = hdr.findIndex((h) => f.kw.test(h));
        if (idx >= 0) auto[f.key] = idx;
      }
      setMap(auto);
    };
    reader.readAsText(file, "utf-8");
  }

  const buildRows = (): ImportRow[] =>
    rows.map((r) => {
      const o: Record<string, string> = {};
      for (const f of FIELDS) {
        const idx = map[f.key];
        if (idx !== undefined && r[idx] !== undefined) o[f.key] = r[idx].trim();
      }
      return o as ImportRow;
    }).filter((r) => (r.name ?? "").trim());

  function submit() {
    if (map.name === undefined) { setErr("لازم تحدد عمود الاسم على الأقل"); return; }
    const data = buildRows();
    if (data.length === 0) { setErr("لا صفوف صالحة"); return; }
    setErr(null);
    start(async () => {
      const r = await importPatients(data, clinicId);
      if (!r.ok) { setErr(r.reason); return; }
      setResult({ inserted: r.inserted, skipped: r.skipped, total: r.total });
      router.refresh();
    });
  }

  if (result) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-11 h-11 mx-auto mb-3" style={{ color: "var(--accent-1)" }} />
        <p className="text-lg font-bold text-white mb-1">تم الاستيراد ✓</p>
        <p className="text-sm" style={{ color: "var(--text-2)" }}>
          أُضيف <span className="font-bold text-white ltr-nums">{result.inserted}</span> مريض
          {result.skipped > 0 && <> · تجاهل <span className="font-bold ltr-nums" style={{ color: "#fcd34d" }}>{result.skipped}</span> مكرر</>}
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <button onClick={() => { setResult(null); setRows([]); setHeaders([]); setMap({}); if (fileRef.current) fileRef.current.value = ""; }} className="btn-ghost">استيراد ملف آخر</button>
          {onClose && <button onClick={onClose} className="btn-primary">تم</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <FileSpreadsheet className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
          استيراد مرضى من ملف
        </h3>
        {onClose && <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--text-3)" }}><X className="w-4 h-4" /></button>}
      </div>

      {/* upload */}
      <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl cursor-pointer mb-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.14)" }}>
        <Upload className="w-6 h-6" style={{ color: "var(--text-3)" }} />
        <span className="text-[13px] font-semibold text-white">اختر ملف CSV</span>
        <span className="text-[11px]" style={{ color: "var(--text-4)" }}>من Excel/Google Sheets: حفظ باسم → CSV UTF-8</span>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      </label>

      {err && (
        <p className="text-[12px] font-semibold flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3"
          style={{ background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)", color: "#fda4b4" }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
        </p>
      )}

      {/* column mapping + preview */}
      {headers.length > 0 && (
        <>
          <p className="eyebrow mb-2">طابق الأعمدة ({rows.length} صف)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: f.key === "name" ? "#5dd9cb" : "var(--text-3)" }}>{f.label}</label>
                <select
                  value={map[f.key] ?? -1}
                  onChange={(e) => setMap((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  className="field" style={{ fontSize: 12 }}>
                  <option value={-1} style={{ background: "#131315" }}>— تجاهل —</option>
                  {headers.map((h, i) => <option key={i} value={i} style={{ background: "#131315" }}>{h || `عمود ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* preview first 3 */}
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-3 py-1.5 text-[10px]" style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-4)" }}>معاينة أول 3 صفوف</div>
            {buildRows().slice(0, 3).map((r, i) => (
              <div key={i} className="px-3 py-1.5 text-[12px] flex gap-3 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="font-semibold text-white">{r.name}</span>
                {r.phone && <span className="ltr-nums" style={{ color: "var(--text-3)" }}>{r.phone}</span>}
                {r.gender && <span style={{ color: "var(--text-4)" }}>{r.gender}</span>}
              </div>
            ))}
          </div>

          <button onClick={submit} disabled={pending} className="btn-primary w-full">
            <ArrowRight className="w-4 h-4" />
            {pending ? "جارٍ الاستيراد…" : `استيراد ${buildRows().length} مريض`}
          </button>
          <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-4)" }}>
            المكرر (بنفس الجوال) يُتجاهل تلقائياً — لن يُضاف مريض مرتين
          </p>
        </>
      )}
    </div>
  );
}
