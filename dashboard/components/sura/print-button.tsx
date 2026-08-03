"use client";

import { Printer, ArrowRight } from "lucide-react";
import Link from "next/link";

/* Screen furniture for a page that is really a document.
 *
 * The print dialog is where the PDF actually gets made — "Save as PDF"
 * is a destination in it on every desktop browser — so this is the whole
 * export feature, and it costs one button and no dependency. */
export function PrintButton() {
  return (
    <div className="noprint mx-auto mb-4 flex max-w-[820px] items-center justify-between gap-3">
      <Link
        href="/clinic-admin/sura-agent"
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium"
        style={{ background: "#fff", color: "#14161a", border: "1px solid #d9dde3" }}
      >
        <ArrowRight className="size-3.5" />
        رجوع
      </Link>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold text-white"
        style={{ background: "#1e52d6" }}
      >
        <Printer className="size-4" />
        طباعة أو حفظ PDF
      </button>
    </div>
  );
}
