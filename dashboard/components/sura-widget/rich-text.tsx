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

type Line = { kind: "bullet" | "number" | "text"; text: string; marker?: string };

function classify(raw: string): Line {
  const line = raw.trimEnd();
  const bullet = /^\s*[*\-•]\s+(.*)$/.exec(line);
  if (bullet) return { kind: "bullet", text: bullet[1] };
  const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
  if (numbered) return { kind: "number", text: numbered[2], marker: numbered[1] };
  return { kind: "text", text: line };
}

/** `**bold**` and `*bold*` → <b>. Everything else stays literal. */
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

export function RichText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map(classify);

  /* Consecutive list lines become one list, so the spacing between items
     is list spacing rather than paragraph spacing. */
  const blocks: { kind: Line["kind"]; items: Line[] }[] = [];
  for (const line of lines) {
    if (line.kind === "text" && !line.text.trim()) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.kind === line.kind && line.kind !== "text") last.items.push(line);
    else blocks.push({ kind: line.kind, items: [line] });
  }

  return (
    <div className="space-y-2">
      {blocks.map((b, bi) => {
        if (b.kind === "text") {
          return (
            <p key={bi} className="leading-relaxed">
              {b.items.map((l, li) => inline(l.text, `${bi}-${li}`))}
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
