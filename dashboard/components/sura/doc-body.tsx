import { Fragment } from "react";
import { DocChart, parseChart, type ChartSpec } from "./doc-chart";

/* Markdown, on paper.
 *
 * The chat renderer is tuned for a dark bubble; a printed document wants
 * different weights, real heading hierarchy and tables with rules. Same
 * parsing idea, different typography — and the same rule that matters
 * most: elements are built, never HTML strings, so nothing the model
 * writes can become markup in a page a clinic prints and emails.
 */

type Block =
  | { k: "h"; level: 1 | 2 | 3; text: string }
  | { k: "p"; lines: string[] }
  | { k: "ul"; items: string[] }
  | { k: "ol"; items: string[] }
  | { k: "table"; rows: string[][] }
  | { k: "chart"; spec: ChartSpec }
  | { k: "hr" };

function parse(md: string): Block[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: Block[] = [];
  let i = 0;

  const isRow = (l = "") => /^\s*\|.*\|\s*$/.test(l);
  const isRule = (l = "") => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push({ k: "hr" }); i++; continue; }

    /* A fenced block. Only charts are rendered; anything else fenced is
       dropped rather than printed raw — a document should never show its
       own scaffolding to the clinic that prints it. */
    const fence = /^\s*```\s*(\S*)/.exec(line);
    if (fence) {
      const lang = fence[1].toLowerCase();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++; }
      i++;
      if (lang === "chart" || lang === "رسم") {
        const spec = parseChart(body.join("\n"));
        if (spec) out.push({ k: "chart", spec });
      }
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      out.push({ k: "h", level: h[1].length as 1 | 2 | 3, text: h[2].trim() });
      i++;
      continue;
    }

    if (isRow(line) && isRule(lines[i + 1])) {
      const rows = [cells(line)];
      i += 2;
      while (i < lines.length && isRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push({ k: "table", rows });
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i++;
      }
      out.push({ k: "ul", items });
      continue;
    }

    if (/^\s*[\d٠-٩]+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[\d٠-٩]+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[\d٠-٩]+[.)]\s+/, ""));
        i++;
      }
      out.push({ k: "ol", items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•#|]|\d+[.)])/.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push({ k: "p", lines: para });
    else i++;
  }

  return out;
}

function inline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <b key={`${key}-${i}`}>{p.slice(2, -2)}</b>
      : <Fragment key={`${key}-${i}`}>{p}</Fragment>,
  );
}

export function DocBody({ md }: { md: string }) {
  const blocks = parse(md);

  return (
    <div className="docbody">
      {blocks.map((b, i) => {
        switch (b.k) {
          case "h":
            return b.level === 1
              ? <h2 key={i} className="db-h1">{b.text}</h2>
              : b.level === 2
                ? <h3 key={i} className="db-h2">{b.text}</h3>
                : <h4 key={i} className="db-h3">{b.text}</h4>;
          case "p":
            return <p key={i} className="db-p">{b.lines.map((l, j) => inline(l, `${i}-${j}`))}</p>;
          case "ul":
            return (
              <ul key={i} className="db-ul">
                {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="db-ol">
                {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}
              </ol>
            );
          case "chart":
            return <DocChart key={i} spec={b.spec} />;
          case "hr":
            return <hr key={i} className="db-hr" />;
          case "table":
            return (
              <div key={i} className="db-tablewrap">
                <table className="db-table">
                  <thead>
                    <tr>{b.rows[0].map((c, j) => <th key={j}>{inline(c, `${i}h${j}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.slice(1).map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td
                            key={ci}
                            style={{
                              fontVariantNumeric: /^[\d٠-٩.,٫\s%٪-]+$/.test(c) ? "tabular-nums" : undefined,
                              textAlign: /^[\d٠-٩.,٫\s%٪-]+$/.test(c) ? "end" : undefined,
                            }}
                          >
                            {inline(c, `${i}c${ri}${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}

      <style>{`
        .docbody { }
        .db-h1 { font-size: 1.15rem; font-weight: 800; margin: 2rem 0 .7rem; padding-bottom: .4rem; border-bottom: 1px solid #dfe2e7; break-after: avoid; }
        .db-h1:first-child { margin-top: 0; }
        .db-h2 { font-size: 1rem; font-weight: 800; margin: 1.5rem 0 .5rem; break-after: avoid; }
        .db-h3 { font-size: .92rem; font-weight: 700; color: #3b4453; margin: 1.2rem 0 .4rem; break-after: avoid; }
        .db-p  { margin: 0 0 .85rem; }
        .db-ul, .db-ol { margin: 0 0 .95rem; padding-inline-start: 1.3rem; }
        .db-ul { list-style: disc; }
        .db-ol { list-style: decimal; }
        .db-ul li, .db-ol li { margin-bottom: .3rem; }
        .db-hr { border: 0; border-top: 1px solid #dfe2e7; margin: 1.6rem 0; }
        .db-tablewrap { overflow-x: auto; margin: 0 0 1.1rem; break-inside: avoid; }
        .db-table { width: 100%; border-collapse: collapse; font-size: .86rem; }
        .db-table th { text-align: start; font-weight: 800; padding: .5rem .4rem; border-bottom: 2px solid #14161a; }
        .db-table td { padding: .45rem .4rem; border-bottom: 1px solid #eceef1; }
      `}</style>
    </div>
  );
}
