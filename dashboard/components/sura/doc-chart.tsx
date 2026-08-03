/* Charts, drawn as SVG.
 *
 * "أنا آسفة، لا أستطيع إنشاء صور أو رسومات بيانية" was the one honest
 * refusal in the document she produced — and it was only honest because
 * nothing here could draw. A bar chart is not an image; it is arithmetic
 * and rectangles, and the browser draws it better than any raster would
 * print.
 *
 * SVG rather than a chart library: this renders inside a document that
 * gets printed, so it has to survive @media print and carry no runtime.
 * No axes libraries, no tooltips, no interactivity — a printed chart is
 * read, not hovered.
 */

export type ChartSpec = {
  kind: "bar" | "donut";
  title?: string;
  unit?: string;
  rows: { label: string; value: number }[];
};

/* ```chart
   type: bar
   title: الإيراد لكل خدمة
   unit: ر.ع
   تركيب تاج | 240
   تبييض     | 180
   ``` */
export function parseChart(body: string): ChartSpec | null {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  let kind: ChartSpec["kind"] = "bar";
  let title: string | undefined;
  let unit: string | undefined;
  const rows: { label: string; value: number }[] = [];

  for (const line of lines) {
    const meta = /^(type|نوع|title|عنوان|unit|وحدة)\s*:\s*(.+)$/i.exec(line);
    if (meta) {
      const key = meta[1].toLowerCase();
      const val = meta[2].trim();
      if (key === "type" || key === "نوع") kind = /donut|دائر|كعك/i.test(val) ? "donut" : "bar";
      else if (key === "title" || key === "عنوان") title = val;
      else unit = val;
      continue;
    }

    /* A row is "label | number". Arabic-Indic digits are what she writes
       as often as not, so they are translated before parsing. */
    const cut = line.lastIndexOf("|");
    if (cut < 1) continue;
    const label = line.slice(0, cut).trim();
    const raw = line.slice(cut + 1).trim()
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[٫,]/g, ".")
      .replace(/[^\d.-]/g, "");
    const value = Number(raw);
    if (label && Number.isFinite(value)) rows.push({ label, value });
  }

  return rows.length >= 2 ? { kind, title, unit, rows } : null;
}

const PALETTE = ["#1e52d6", "#3b6fe0", "#5b8ce8", "#7aa4ee", "#98bbf3", "#b4cff7", "#cfe1fb"];

const fmt = (n: number) =>
  n.toLocaleString("ar-OM", { maximumFractionDigits: n < 10 ? 1 : 0 });

export function DocChart({ spec }: { spec: ChartSpec }) {
  return spec.kind === "donut" ? <Donut spec={spec} /> : <Bars spec={spec} />;
}

function Bars({ spec }: { spec: ChartSpec }) {
  const rows = [...spec.rows].sort((a, b) => b.value - a.value).slice(0, 12);
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  const rowH = 26;
  const gap = 8;
  const labelW = 160;
  const valueW = 74;
  const w = 700;
  const barMax = w - labelW - valueW - 16;
  const h = rows.length * (rowH + gap);

  return (
    <figure className="chart">
      {spec.title && <figcaption className="chart__t">{spec.title}</figcaption>}
      {/* direction: ltr on the canvas, deliberately.
       *
       * text-anchor is resolved against the inline base direction, so
       * inside an Arabic page "end" means the LEFT edge — every label was
       * anchored at x=700 and drawn rightward, off the viewBox, leaving
       * exactly one visible letter. Forcing ltr makes the anchor
       * geometric; the Arabic inside each label still shapes and orders
       * itself correctly, because that is bidi and not anchoring. */}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img"
        style={{ direction: "ltr" }}
        aria-label={spec.title ?? "رسم بياني"}>
        {rows.map((r, i) => {
          const y = i * (rowH + gap);
          const bw = Math.max(2, (Math.abs(r.value) / max) * barMax);
          /* RTL: the label sits at the right edge and bars grow leftward,
             which is the direction the rest of the document reads. */
          const x = w - labelW - bw;
          return (
            <g key={r.label}>
              <text x={w} y={y + rowH * 0.7} textAnchor="end"
                fontSize="12.5" fill="#3b4453">{r.label}</text>
              <rect x={x} y={y} width={bw} height={rowH} rx="3"
                fill={PALETTE[i % PALETTE.length]} />
              <text x={x - 8} y={y + rowH * 0.7} textAnchor="end"
                fontSize="12" fill="#14161a" fontWeight="700"
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(r.value)}{spec.unit ? ` ${spec.unit}` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <style>{`
        .chart { margin: 1.2rem 0 1.5rem; break-inside: avoid; }
        .chart__t { font-size: .92rem; font-weight: 700; margin-bottom: .6rem; color: #14161a; }
      `}</style>
    </figure>
  );
}

function Donut({ spec }: { spec: ChartSpec }) {
  const rows = [...spec.rows].sort((a, b) => b.value - a.value).slice(0, 7);
  const total = rows.reduce((s, r) => s + Math.abs(r.value), 0) || 1;

  const R = 70;
  const STROKE = 26;
  const C = 2 * Math.PI * R;

  /* Each arc's start is the sum of the ones before it. Computed up front
     rather than accumulated inside the map — a running variable mutated
     during render is the kind of thing that works until it does not. */
  const arcs = rows.reduce<{ label: string; dash: number; offset: number }[]>((acc, r) => {
    const dash = (Math.abs(r.value) / total) * C;
    const prev = acc[acc.length - 1];
    acc.push({ label: r.label, dash, offset: prev ? prev.offset + prev.dash : 0 });
    return acc;
  }, []);

  return (
    <figure className="chart chart--donut">
      {spec.title && <figcaption className="chart__t">{spec.title}</figcaption>}
      <div className="chart__row">
        <svg viewBox="0 0 180 180" width="180" height="180" role="img"
          aria-label={spec.title ?? "رسم دائري"}>
          <g transform="rotate(-90 90 90)">
            {arcs.map((a, i) => (
              <circle key={a.label} cx="90" cy="90" r={R} fill="none"
                stroke={PALETTE[i % PALETTE.length]} strokeWidth={STROKE}
                strokeDasharray={`${a.dash} ${C - a.dash}`} strokeDashoffset={-a.offset} />
            ))}
          </g>
        </svg>
        <ul className="chart__legend">
          {rows.map((r, i) => (
            <li key={r.label}>
              <span className="chart__swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="chart__label">{r.label}</span>
              <span className="chart__val">
                {fmt(r.value)}{spec.unit ? ` ${spec.unit}` : ""}
                <em>{Math.round((Math.abs(r.value) / total) * 100)}٪</em>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .chart--donut .chart__row { display: flex; align-items: center; gap: 1.6rem; flex-wrap: wrap; }
        .chart__legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 220px; }
        .chart__legend li { display: flex; align-items: center; gap: .55rem; padding: .28rem 0; font-size: .84rem; }
        .chart__swatch { width: 11px; height: 11px; border-radius: 3px; flex: none; }
        .chart__label { flex: 1; color: #3b4453; }
        .chart__val { font-weight: 700; font-variant-numeric: tabular-nums; }
        .chart__val em { font-style: normal; color: #6b7280; font-weight: 500; margin-inline-start: .4rem; }
      `}</style>
    </figure>
  );
}
