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
