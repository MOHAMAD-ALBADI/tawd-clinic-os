import { Fragment } from "react";

/* Renders the small amount of Markdown a language model actually emits.
 *
 * The widget printed `m.content` straight into a div, so an answer like
 * "* **الإيرادات:** ٧٬٥٨٢" arrived on screen with its asterisks intact and
 * every bullet run together on one line. It read like a parsing failure,
 * which is precisely what it was.
 *
 * No Markdown library. This handles the four constructs that show up in
 * practice — bold, bullets, numbered lists, and paragraph breaks — in
 * about eighty lines, against adding a dependency and a bundle to a chat
 * bubble. It also builds React elements rather than HTML strings, so
 * there is no path from model output to dangerouslySetInnerHTML.
 */

type Line = { kind: "head" | "bullet" | "number" | "text"; text: string; marker?: string };

function classify(raw: string): Line {
  const line = raw.trimEnd();

  /* A heading. Sura is told to use "## " when an answer covers two
     separate subjects; a bold line on its own does the same job and she
     reaches for it about as often, so both are accepted. */
  const hashed = /^\s*#{1,4}\s+(.*)$/.exec(line);
  if (hashed) return { kind: "head", text: hashed[1] };
  const boldOnly = /^\s*\*\*([^*]+)\*\*\s*:?\s*$/.exec(line);
  if (boldOnly) return { kind: "head", text: boldOnly[1] };

  const bullet = /^\s*[*\-•]\s+(.*)$/.exec(line);
  if (bullet) return { kind: "bullet", text: bullet[1] };
  const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
  if (numbered) return { kind: "number", text: numbered[2], marker: numbered[1] };

  /* Arabic-Indic numerals are what she actually writes for ordered
     lists, and ١. would otherwise render as body text next to a 1. */
  const arabicNum = /^\s*([٠-٩]+)[.)]\s+(.*)$/.exec(line);
  if (arabicNum) return { kind: "number", text: arabicNum[2], marker: arabicNum[1] };

  return { kind: "text", text: line };
}

/** `**bold**` and `*bold*` → <b>. Everything else stays literal. */
function Table({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="border-b px-2.5 py-1.5 text-start font-bold"
                style={{ borderColor: "var(--hairline)", color: "var(--accent-1)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className="border-b px-2.5 py-1.5"
                  style={{
                    borderColor: "rgba(255,255,255,0.05)",
                    /* Numbers line up on tabular figures; names do not
                       want them. */
                    fontVariantNumeric: /^[\d٠-٩.,٫\s%٪ر.ع-]+$/.test(c) ? "tabular-nums" : undefined,
                  }}
                >
                  {inline(c, `t${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function inline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <b key={`${keyBase}-${i}`} className="font-bold text-white">
          {p.slice(2, -2)}
        </b>
      );
    }
    if (/^\*[^*\n]+\*$/.test(p)) {
      return (
        <b key={`${keyBase}-${i}`} className="font-bold text-white">
          {p.slice(1, -1)}
        </b>
      );
    }
    return <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>;
  });
}

/* A pipe table, the one structure worth parsing beyond lines.
 *
 * Asked to compare two months or list patients with three attributes,
 * the model reaches for a Markdown table. Rendered as raw text it is the
 * ugliest thing on the page; rendered properly it is the clearest. */
function tableAt(lines: string[], i: number): { rows: string[][]; next: number } | null {
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isRule = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  if (!isRow(lines[i]) || !isRow(lines[i + 1] ?? "") || !isRule(lines[i + 1] ?? "")) return null;

  const cells = (l: string) =>
    l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  const rows: string[][] = [cells(lines[i])];
  let j = i + 2;
  while (j < lines.length && isRow(lines[j])) {
    rows.push(cells(lines[j]));
    j++;
  }
  return { rows, next: j };
}

export function RichText({ text }: { text: string }) {
  const raw = text.split(/\r?\n/);

  /* Tables are pulled out first — they span lines and the line
     classifier below would shred them into bullets. */
  const chunks: ({ table: string[][] } | { lines: string[] })[] = [];
  let buf: string[] = [];
  for (let i = 0; i < raw.length; ) {
    const t = tableAt(raw, i);
    if (t) {
      if (buf.length) { chunks.push({ lines: buf }); buf = []; }
      chunks.push({ table: t.rows });
      i = t.next;
    } else {
      buf.push(raw[i]);
      i++;
    }
  }
  if (buf.length) chunks.push({ lines: buf });

  if (chunks.some((c) => "table" in c)) {
    return (
      <div className="space-y-3">
        {chunks.map((c, i) =>
          "table" in c ? <Table key={i} rows={c.table} /> : <RichText key={i} text={c.lines.join("\n")} />,
        )}
      </div>
    );
  }

  const lines = raw.map(classify);

  /* Consecutive list lines become one list, so the spacing between items
     is list spacing rather than paragraph spacing. */
  const blocks: { kind: Line["kind"]; items: Line[] }[] = [];
  /* A blank line ends the current block. Without this, two paragraphs
     separated by an empty line merged into one, which is exactly the
     "wall of text" the answer rules now tell Sura to avoid. */
  let broken = true;
  for (const line of lines) {
    if (line.kind === "text" && !line.text.trim()) { broken = true; continue; }
    const last = blocks[blocks.length - 1];
    const joins = last && last.kind === line.kind && !(broken && line.kind === "text");
    if (joins) last.items.push(line);
    else blocks.push({ kind: line.kind, items: [line] });
    broken = false;
  }

  return (
    <div className="space-y-2.5">
      {blocks.map((b, bi) => {
        if (b.kind === "head") {
          return (
            <p
              key={bi}
              className="pt-1 text-[13px] font-bold first:pt-0"
              style={{ color: "var(--accent-1)" }}
            >
              {b.items.map((l) => l.text).join(" ")}
            </p>
          );
        }
        if (b.kind === "text") {
          return (
            <p key={bi} className="leading-relaxed">
              {b.items.map((l, li) => (
                <Fragment key={li}>
                  {li > 0 && <br />}
                  {inline(l.text, `${bi}-${li}`)}
                </Fragment>
              ))}
            </p>
          );
        }
        return (
          <ul key={bi} className="space-y-1.5">
            {b.items.map((l, li) => (
              <li key={li} className="flex gap-2 leading-relaxed">
                <span
                  className="shrink-0 select-none"
                  style={{ color: "var(--accent-1)", minWidth: b.kind === "number" ? "1.2em" : undefined }}
                >
                  {b.kind === "number" ? `${l.marker}.` : "•"}
                </span>
                <span className="min-w-0">{inline(l.text, `${bi}-${li}`)}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
