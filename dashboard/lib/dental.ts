/* FDI tooth notation and the clinical vocabulary of the chart.

   Kept in one place because the numbers are not arbitrary: the first digit is
   the quadrant (1 upper-right … 4 lower-left for permanent, 5–8 for primary)
   and the second is the position from the midline. Anything that draws a mouth
   has to agree on that or the chart lies. */

export type Quadrant = { key: string; label: string; teeth: number[] };

const seq = (q: number, n = 8) => Array.from({ length: n }, (_, i) => q * 10 + i + 1);

/** Permanent dentition, drawn as the dentist sees the patient: upper row
    right-to-left across the midline, then lower. */
export const PERMANENT: Quadrant[] = [
  { key: "ur", label: "علوي أيمن", teeth: seq(1) },
  { key: "ul", label: "علوي أيسر", teeth: seq(2) },
  { key: "lr", label: "سفلي أيمن", teeth: seq(4) },
  { key: "ll", label: "سفلي أيسر", teeth: seq(3) },
];

/** Primary dentition — five teeth per quadrant, numbered 51-85. */
export const PRIMARY: Quadrant[] = [
  { key: "ur", label: "علوي أيمن", teeth: seq(5, 5) },
  { key: "ul", label: "علوي أيسر", teeth: seq(6, 5) },
  { key: "lr", label: "سفلي أيمن", teeth: seq(8, 5) },
  { key: "ll", label: "سفلي أيسر", teeth: seq(7, 5) },
];

export type SurfaceKey = "M" | "O" | "D" | "B" | "L" | "I";

export const SURFACES: { key: SurfaceKey; label: string; hint: string }[] = [
  { key: "M", label: "M", hint: "إنسي (Mesial)" },
  { key: "O", label: "O", hint: "طاحن (Occlusal)" },
  { key: "D", label: "D", hint: "وحشي (Distal)" },
  { key: "B", label: "B", hint: "دهليزي (Buccal)" },
  { key: "L", label: "L", hint: "لساني (Lingual)" },
  { key: "I", label: "I", hint: "قاطع (Incisal)" },
];

export type ChartCode = {
  code: string;
  label: string;
  kind: "finding" | "treatment";
  colour: string;
  /** short mark drawn on the tooth */
  glyph: string;
};

/* The set a general dentist reaches for daily. Deliberately short — a code list
   nobody can scan is a code list nobody uses, and free text stays available on
   every entry for the rest. */
export const CODES: ChartCode[] = [
  { code: "caries",       label: "تسوّس",            kind: "finding",   colour: "#f87171", glyph: "C" },
  { code: "fracture",     label: "كسر",              kind: "finding",   colour: "#fb923c", glyph: "F" },
  { code: "missing",      label: "مفقود",            kind: "finding",   colour: "#71717a", glyph: "✕" },
  { code: "impacted",     label: "منطمر",            kind: "finding",   colour: "#a78bfa", glyph: "I" },
  { code: "mobility",     label: "قلقلة",            kind: "finding",   colour: "#fbbf24", glyph: "M" },
  { code: "perio",        label: "التهاب لثة/دواعم", kind: "finding",   colour: "#fb7185", glyph: "P" },
  { code: "sensitivity",  label: "حساسية",           kind: "finding",   colour: "#fcd34d", glyph: "S" },

  { code: "filling",      label: "حشوة",             kind: "treatment", colour: "#60a5fa", glyph: "◼" },
  { code: "crown",        label: "تاج",              kind: "treatment", colour: "#34d399", glyph: "♛" },
  { code: "bridge",       label: "جسر",              kind: "treatment", colour: "#2dd4bf", glyph: "≡" },
  { code: "rct",          label: "علاج عصب",         kind: "treatment", colour: "#c084fc", glyph: "R" },
  { code: "extraction",   label: "خلع",              kind: "treatment", colour: "#94a3b8", glyph: "✕" },
  { code: "implant",      label: "زرعة",             kind: "treatment", colour: "#38bdf8", glyph: "⌷" },
  { code: "sealant",      label: "مادة مانعة",       kind: "treatment", colour: "#4ade80", glyph: "•" },
  { code: "scaling",      label: "تنظيف/تقليح",      kind: "treatment", colour: "#22d3ee", glyph: "~" },
  { code: "veneer",       label: "فينير",            kind: "treatment", colour: "#f0abfc", glyph: "▭" },
];

export const CODE_BY_KEY: Record<string, ChartCode> =
  Object.fromEntries(CODES.map((c) => [c.code, c]));

export type ChartEntry = {
  id: string;
  tooth: number;
  surfaces: string[];
  kind: "finding" | "treatment";
  code: string;
  note: string | null;
  status: "active" | "resolved" | "planned";
  createdAt: string;
  doctorName: string | null;
};

/** Arabic name for a tooth position — what a dentist would dictate. */
export function toothLabel(tooth: number): string {
  const pos = tooth % 10;
  const primary = tooth >= 51;
  const names = primary
    ? ["", "ثنية", "رباعية", "ناب", "طاحن أول", "طاحن ثاني"]
    : ["", "ثنية", "رباعية", "ناب", "ضاحك أول", "ضاحك ثاني", "رحى أولى", "رحى ثانية", "رحى ثالثة"];
  return names[pos] ?? `سن ${tooth}`;
}
