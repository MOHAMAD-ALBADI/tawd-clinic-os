"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check, X, AlertTriangle, Trash2, CheckCircle2, Plus, Baby, Smile,
} from "lucide-react";
import {
  PERMANENT, PRIMARY, SURFACES, CODES, CODE_BY_KEY, toothLabel,
  type ChartEntry, type SurfaceKey,
} from "@/lib/dental";
import { addChartEntry, resolveChartEntry, deleteChartEntry } from "@/app/actions/dental-chart";

import { arDateShort as AR_DATE } from "@/lib/ar-format";

/** The odontogram.

    The mouth is drawn the way the dentist faces it — the patient's right on the
    viewer's left within each arch — and every tooth carries its open findings
    and its completed work as coloured marks, so the state of a mouth is one
    glance rather than a scroll through notes.

    Clicking a tooth opens the record for that tooth alone: what is open on it,
    what has been done to it, and the form to add to either. */
export function DentalChart({
  patientId, entries, canEdit,
}: { patientId: string; entries: ChartEntry[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<number | null>(null);
  const [showPrimary, setShowPrimary] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byTooth = useMemo(() => {
    const m = new Map<number, ChartEntry[]>();
    for (const e of entries) {
      const l = m.get(e.tooth) ?? [];
      l.push(e);
      m.set(e.tooth, l);
    }
    return m;
  }, [entries]);

  const openCount = entries.filter((e) => e.status === "active").length;
  const treatedCount = entries.filter((e) => e.kind === "treatment").length;

  /* If anything is charted on a primary tooth, the child view is the relevant
     one and opens by default rather than hiding the record. */
  const hasPrimary = useMemo(() => entries.some((e) => e.tooth >= 51), [entries]);
  const quadrants = showPrimary || (hasPrimary && !showPrimary && entries.every((e) => e.tooth >= 51))
    ? PRIMARY : (showPrimary ? PRIMARY : PERMANENT);

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="section-title">
          <Smile className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>مخطط الأسنان</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {openCount > 0 && (
            <span className="badge badge-bad">
              <AlertTriangle className="w-3 h-3" /> <span className="ltr-nums">{openCount}</span> موجودة مفتوحة
            </span>
          )}
          {treatedCount > 0 && (
            <span className="badge badge-ok"><span className="ltr-nums">{treatedCount}</span> إجراء منفَّذ</span>
          )}
          <button className="btn-ghost" onClick={() => setShowPrimary((v) => !v)}>
            <Baby className="w-3.5 h-3.5" />
            {showPrimary ? "الأسنان الدائمة" : "الأسنان اللبنية"}
          </button>
        </div>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        ترقيم FDI — اضغط أي سن لعرض ما عليه وتسجيل موجودة أو إجراء
      </p>

      {err && (
        <div className="flex items-center gap-2 text-[12.5px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {/* ── the mouth ── */}
      <div className="space-y-2" dir="ltr">
        {[quadrants.slice(0, 2), quadrants.slice(2, 4)].map((arch, ai) => (
          <div key={ai} className="flex items-center justify-center gap-1 flex-wrap">
            {/* upper arch: right quadrant reversed so the midline meets in the centre */}
            {(ai === 0 ? [...arch[0].teeth].reverse() : [...arch[0].teeth].reverse()).map((t) => (
              <Tooth key={t} n={t} entries={byTooth.get(t) ?? []} onClick={() => setSelected(t)} active={selected === t} />
            ))}
            <div className="w-2" />
            {arch[1].teeth.map((t) => (
              <Tooth key={t} n={t} entries={byTooth.get(t) ?? []} onClick={() => setSelected(t)} active={selected === t} />
            ))}
          </div>
        ))}
      </div>

      {/* ── legend ── */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-4 pt-3" style={{ borderTop: "1px solid var(--hairline)" }}>
        {CODES.filter((c) => entries.some((e) => e.code === c.code)).map((c) => (
          <span key={c.code} className="flex items-center gap-1 text-[10.5px]" style={{ color: "var(--text-4)" }}>
            <span className="w-2 h-2 rounded-sm" style={{ background: c.colour }} />
            {c.label}
          </span>
        ))}
        {entries.length === 0 && (
          <span className="text-[11px]" style={{ color: "var(--text-4)" }}>
            لا موجودات مسجّلة على هذا المريض بعد
          </span>
        )}
      </div>

      {selected !== null && (
        <ToothPanel
          tooth={selected}
          entries={byTooth.get(selected) ?? []}
          patientId={patientId}
          canEdit={canEdit}
          pending={pending}
          onClose={() => { setSelected(null); setErr(null); }}
          onAdd={(payload) => start(async () => {
            setErr(null);
            const r = await addChartEntry({ patientId, tooth: selected, ...payload });
            if (!r.ok) { setErr(r.reason); return; }
            router.refresh();
          })}
          onResolve={(id) => start(async () => {
            setErr(null);
            const r = await resolveChartEntry(id, patientId);
            if (!r.ok) { setErr(r.reason); return; }
            router.refresh();
          })}
          onDelete={(id) => start(async () => {
            setErr(null);
            const r = await deleteChartEntry(id, patientId);
            if (!r.ok) { setErr(r.reason); return; }
            router.refresh();
          })}
        />
      )}
    </div>
  );
}

function Tooth({
  n, entries, onClick, active,
}: { n: number; entries: ChartEntry[]; onClick: () => void; active: boolean }) {
  const open = entries.filter((e) => e.status === "active");
  const treated = entries.filter((e) => e.kind === "treatment");
  const missing = entries.some((e) => (e.code === "missing" || e.code === "extraction"));

  /* One tooth shows at most two marks: the newest open finding and the newest
     completed work. More than that on a 40px square is decoration. */
  const topFinding = open[0] ? CODE_BY_KEY[open[0].code] : null;
  const topTreatment = treated[0] ? CODE_BY_KEY[treated[0].code] : null;

  return (
    <button onClick={onClick} title={`${n} — ${toothLabel(n)}`}
      className="flex flex-col items-center gap-0.5 rounded-lg transition-colors"
      style={{
        width: 34, padding: "3px 0",
        background: active ? "rgb(var(--accent-1-rgb) / 0.16)" : "transparent",
        border: `1px solid ${active ? "rgb(var(--accent-1-rgb) / 0.4)" : "transparent"}`,
      }}>
      <span className="text-[9px] ltr-nums" style={{ color: "var(--text-4)" }}>{n}</span>
      <span className="relative flex items-center justify-center rounded"
        style={{
          width: 26, height: 30,
          background: missing ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${topFinding ? topFinding.colour : "rgba(255,255,255,0.14)"}`,
          opacity: missing ? 0.45 : 1,
        }}>
        {topFinding && (
          <span className="text-[11px] font-black leading-none" style={{ color: topFinding.colour }}>
            {topFinding.glyph}
          </span>
        )}
        {topTreatment && (
          <span className="absolute rounded-full"
            style={{ width: 6, height: 6, background: topTreatment.colour, bottom: 2, insetInlineEnd: 2 }} />
        )}
      </span>
    </button>
  );
}

function ToothPanel({
  tooth, entries, patientId, canEdit, pending, onClose, onAdd, onResolve, onDelete,
}: {
  tooth: number;
  entries: ChartEntry[];
  patientId: string;
  canEdit: boolean;
  pending: boolean;
  onClose: () => void;
  onAdd: (p: { surfaces: string[]; code: string; note?: string }) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [code, setCode] = useState<string>("caries");
  const [surfaces, setSurfaces] = useState<SurfaceKey[]>([]);
  const [note, setNote] = useState("");

  const toggleSurface = (s: SurfaceKey) =>
    setSurfaces((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const open = entries.filter((e) => e.status === "active");
  const history = entries.filter((e) => e.status !== "active");

  return (
    <div className="mt-4 rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)" }}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <p className="text-[14px] font-black text-white">
            سن <span className="ltr-nums">{tooth}</span>
            <span className="font-normal text-[12px]" style={{ color: "var(--text-3)" }}> · {toothLabel(tooth)}</span>
          </p>
        </div>
        <button className="btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
      </div>

      {entries.length === 0 && (
        <p className="text-[12px] mb-3" style={{ color: "var(--text-4)" }}>لا شيء مسجَّل على هذا السن</p>
      )}

      {open.length > 0 && (
        <div className="mb-3">
          <p className="eyebrow mb-1.5">مفتوح</p>
          <div className="space-y-1">
            {open.map((e) => <EntryRow key={e.id} e={e} canEdit={canEdit} pending={pending}
              onResolve={() => onResolve(e.id)} onDelete={() => onDelete(e.id)} />)}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mb-3">
          <p className="eyebrow mb-1.5">السجل</p>
          <div className="space-y-1">
            {history.map((e) => <EntryRow key={e.id} e={e} canEdit={canEdit} pending={pending}
              onResolve={() => onResolve(e.id)} onDelete={() => onDelete(e.id)} />)}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="pt-3" style={{ borderTop: "1px solid var(--hairline)" }}>
          <p className="eyebrow mb-2">تسجيل جديد</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {CODES.map((c) => {
              const on = code === c.code;
              return (
                <button key={c.code} type="button" onClick={() => setCode(c.code)}
                  className="text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: on ? `${c.colour}22` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? `${c.colour}66` : "var(--hairline)"}`,
                    color: on ? c.colour : "var(--text-3)",
                  }}>
                  {c.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] mb-1.5" style={{ color: "var(--text-4)" }}>الأسطح المصابة (اختياري)</p>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap" dir="ltr">
            {SURFACES.map((s) => {
              const on = surfaces.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggleSurface(s.key)} title={s.hint}
                  className="text-[12px] font-black rounded-lg transition-colors"
                  style={{
                    width: 34, height: 30,
                    background: on ? "rgb(var(--accent-1-rgb) / 0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.4)" : "var(--hairline)"}`,
                    color: on ? "var(--accent-1)" : "var(--text-4)",
                  }}>
                  {s.label}
                </button>
              );
            })}
          </div>

          <input className="field mb-3" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة (اختياري) — مثال: عميق قريب من العصب" />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10.5px]" style={{ color: "var(--text-4)" }}>
              {CODE_BY_KEY[code]?.kind === "treatment"
                ? "الإجراءات تُسجَّل كمنفَّذة الآن"
                : "الموجودة تبقى مفتوحة حتى تُعالَج"}
            </p>
            <button className="btn-primary" disabled={pending}
              onClick={() => { onAdd({ surfaces, code, note }); setNote(""); setSurfaces([]); }}>
              <Plus className="w-4 h-4" /> {pending ? "جارٍ…" : "تسجيل"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntryRow({
  e, canEdit, pending, onResolve, onDelete,
}: { e: ChartEntry; canEdit: boolean; pending: boolean; onResolve: () => void; onDelete: () => void }) {
  const def = CODE_BY_KEY[e.code];
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl flex-wrap"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: def?.colour ?? "#71717a" }} />
      <span className="text-[12.5px] font-bold text-white">{def?.label ?? e.code}</span>
      {e.surfaces.length > 0 && (
        <span className="text-[11px] font-black ltr-nums" style={{ color: "var(--text-3)" }} dir="ltr">
          {e.surfaces.join("")}
        </span>
      )}
      {e.note && <span className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>{e.note}</span>}
      <span className="text-[10.5px] ms-auto shrink-0" style={{ color: "var(--text-4)" }}>
        {AR_DATE.format(new Date(e.createdAt))}
        {e.doctorName ? ` · ${e.doctorName}` : ""}
      </span>
      {e.status === "resolved" && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#34d399" }} />}
      {canEdit && e.status === "active" && (
        <button className="btn-ghost" disabled={pending} title="أُغلقت / عولجت" onClick={onResolve}>
          <Check className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
        </button>
      )}
      {canEdit && (
        <button className="btn-ghost" disabled={pending} title="حذف (خلال ساعة من التسجيل)" onClick={onDelete}>
          <Trash2 className="w-3 h-3" style={{ color: "#fda4b4" }} />
        </button>
      )}
    </div>
  );
}
