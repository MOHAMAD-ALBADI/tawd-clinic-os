/* Getting a screen into Excel.

   The VAT return could be exported and nothing else could, so answering "send me
   June's collections" meant reading figures off a screen and retyping them. An
   accountant works in a spreadsheet; a finance screen that cannot leave the
   browser is a screen they will keep their own parallel copy of, and then the two
   disagree.

   Two things that are easy to get wrong and ruin the file:

   The BOM. Without it Excel reads UTF-8 as the system codepage and every Arabic
   name in the file becomes mojibake.

   Escaping. A patient called "محمد, أحمد" or a void reason containing a comma or
   a newline silently shifts every later column on that row. Anything with a
   comma, a quote or a line break is quoted, and quotes inside are doubled. */

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], footer: string[][] = []): string {
  const lines = [
    columns.map((c) => cell(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(",")),
    ...footer.map((f) => f.map(cell).join(",")),
  ];
  return "﻿" + lines.join("\r\n");
}

/** Hand the file to the browser. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  /* Revoked on the next tick — Safari has not started reading it yet when the
     click returns, and freeing it immediately gives an empty file. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
