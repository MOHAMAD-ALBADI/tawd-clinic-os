"use client";

import { useEffect } from "react";
import { toAsciiNumber } from "@/components/ui/num-field";

/* Makes EVERY numeric field in the dashboard accept Arabic-Indic digits.

   The bug: an Arabic keyboard types ٠١٢٣٤٥٦٧٨٩, and a native number input only
   accepts ASCII — the browser discarded each keystroke, so fields looked like they
   "take one digit then stop". It affected every money/quantity input in the app.

   The fix is one global listener instead of 30+ per-field changes: numeric fields
   are now `type="text" inputMode="decimal"`, and this rewrites the element's value
   to ASCII in the CAPTURE phase — i.e. BEFORE React's own onChange handler reads
   `e.target.value` — so every existing handler keeps working untouched, and any
   field added later is covered automatically. */
export function ArabicNumerals() {
  useEffect(() => {
    function normalize(e: Event) {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.tagName !== "INPUT") return;
      // only numeric-intent fields; never touch names, notes, phones, dates
      if (el.inputMode !== "decimal" && el.inputMode !== "numeric") return;

      const fixed = toAsciiNumber(el.value);
      if (fixed !== el.value) {
        const pos = el.selectionStart;
        el.value = fixed;
        // keep the caret where the user was typing
        try { if (pos !== null) el.setSelectionRange(pos, pos); } catch { /* ignore */ }
      }
    }
    // capture: true → runs before React's synthetic handler sees the value
    document.addEventListener("input", normalize, true);
    return () => document.removeEventListener("input", normalize, true);
  }, []);

  return null;
}
