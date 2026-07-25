"use client";

/* Arabic-first numeric input.

   Why this exists: a native number input only accepts ASCII digits. An Arabic
   keyboard produces Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩), which the browser treats as
   an invalid number — it silently discards the value, so the field looks like it
   "accepts one digit then stops". Every money/quantity field in the app hit this.

   So: a text input with inputMode="decimal" (still shows the numeric keypad on
   mobile) that normalises Arabic-Indic and Persian digits to ASCII, keeps at most
   one decimal separator, and reports a clean ASCII string to the caller. */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert Arabic-Indic / Persian digits + Arabic decimal mark to ASCII. */
export function toAsciiNumber(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const ar = AR_DIGITS.indexOf(ch);
    if (ar >= 0) { out += String(ar); continue; }
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) { out += String(fa); continue; }
    if (ch === "٫" || ch === ",") { out += "."; continue; } // Arabic decimal separator
    out += ch;
  }
  // keep digits + a single dot (and a leading minus if allowed by the caller)
  const neg = out.startsWith("-");
  const parts = out.replace(/[^0-9.]/g, "").split(".");
  const cleaned = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];
  return (neg ? "-" : "") + cleaned;
}

export function NumField({
  value,
  onChange,
  placeholder,
  className = "field ltr-nums",
  style,
  allowDecimal = true,
  max,
  disabled,
  title,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  allowDecimal?: boolean;
  max?: number;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      dir="ltr"
      className={className}
      style={style}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      value={String(value ?? "")}
      onChange={(e) => {
        let v = toAsciiNumber(e.target.value);
        if (!allowDecimal) v = v.replace(/\./g, "");
        if (max !== undefined && v !== "" && Number(v) > max) v = String(max);
        onChange(v);
      }}
    />
  );
}
