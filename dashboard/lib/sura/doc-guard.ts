/* What a document is not allowed to be.
 *
 * Every rule below started life as a sentence in the prompt, and every
 * one of them was ignored. A model handed a hundred instructions follows
 * the shape of them, not the letter — so the ones that actually matter
 * have to stop being advice and start being a return value.
 *
 * Three specific failures, all observed in documents Sura produced:
 *
 *   She described the method instead of performing it — "سنقوم بتحليل
 *   بيانات المواعيد لتحديد الأطباء الأكثر تأثراً" is a plan to do the
 *   work, printed as though it were the work.
 *
 *   She promised. "سيتم تفعيل هذا الإجراء" for something that was never
 *   executed, and "تم تفعيل هذا الإجراء" for something that does not
 *   exist. That is the worst of the three: indistinguishable from
 *   working software until somebody checks.
 *
 *   She invented a chart. "نسيان الموعد ٤٠٪، ظرف طارئ ٣٠٪" — the system
 *   holds no data on why patients miss appointments, so those numbers
 *   came from nowhere and arrived dressed as analysis. Giving her charts
 *   handed fabrication a better costume.
 */

export type GuardVerdict = { ok: true } | { ok: false; reason: string };

/* Future-tense commitments. Arabic marks these clearly enough that a
   literal list catches them without catching legitimate prose. */
const PROMISES = [
  "سنقوم", "سأقوم", "سيتم", "سوف نقوم", "سوف أقوم", "سنعمل", "سأعمل",
  "سنحلل", "سأحلل", "سنبحث", "سأبحث", "سنركز", "سنحدد", "سأحدد",
  "سنتأكد", "سنراجع", "سنطلق", "سنقدم",
];

/* Phrases that mean "I did not look". */
const EXCUSES = [
  "نحتاج إلى بيانات", "نحتاج بيانات", "نحتاج معرفة", "نحتاج إلى معرفة",
  "بيانات إضافية", "لتحديد الأسباب الجذرية", "قد تحتوي",
];

export function guardDocument(
  body: string,
  gathered: unknown[],
): GuardVerdict {
  /* A document with no query behind it is an essay. The whole claim of
     this product is that the numbers come from the clinic's own data,
     and that claim is only true if data was actually read. */
  const results = gathered.filter(
    (g) => g && typeof g === "object" && ("rows" in g || "count" in g || "aggregate" in g || "table" in g),
  );
  if (results.length < 2) {
    return {
      ok: false,
      reason:
        "لم تستعلمي بيانات كافية قبل كتابة المستند. استعلمي أولاً (الإيراد لكل خدمة، أنماط عدم الحضور، الفترة مقابل الفترة) ثم اكتبي المستند من النتائج.",
    };
  }

  const hit = PROMISES.find((p) => body.includes(p));
  if (hit) {
    return {
      ok: false,
      reason:
        `المستند يحتوي وعداً بصيغة المستقبل («${hit}»). المستند يعرض ما وجدتِه ونفّذتِه، لا ما تنوين فعله. ` +
        "نفّذي الإجراء الآن واذكري نتيجته، أو اكتبه تحت «ينتظر موافقتك» بصيغة الاسم لا الفعل المستقبلي.",
    };
  }

  const excuse = EXCUSES.find((p) => body.includes(p));
  if (excuse) {
    return {
      ok: false,
      reason:
        `المستند يقول «${excuse}» — وأنتِ متّصلة بقاعدة البيانات. استعلمي عمّا ينقصك بدل أن تطلبيه، ثم أعيدي الكتابة.`,
    };
  }

  /* Every section has to carry a figure.

     One run produced a no-show section that was four recommendations
     and not a single number, next to a services section built entirely
     from real revenue. Same document, same data available — the
     difference was that nothing required the first one to look. */
  const bare = barrenSection(body);
  if (bare) {
    return {
      ok: false,
      reason:
        `القسم «${bare}» بلا رقم واحد. كل قسم يبدأ برقم استخرجتِه من البيانات، ثم معناه، ثم التوصية — ` +
        "استعلمي ما ينقص هذا القسم وأعيدي كتابته.",
    };
  }

  const chart = fabricatedChart(body, gathered);
  if (chart) return { ok: false, reason: chart };

  return { ok: true };
}

/* Do the numbers in a chart appear anywhere in what was actually read?
 *
 * Not exact — a percentage derived from two counts will not appear
 * literally, and it should not have to. But a chart where NONE of the
 * values trace back to anything queried was not computed from data, and
 * that is the signature worth refusing. */
function fabricatedChart(body: string, gathered: unknown[]): string | null {
  const blocks = [...body.matchAll(/```\s*(?:chart|رسم)\s*\n([\s\S]*?)```/g)];
  if (blocks.length === 0) return null;

  const known = numbersIn(JSON.stringify(gathered));
  if (known.size === 0) return null;

  for (const [, block] of blocks) {
    const values: number[] = [];
    for (const line of block.split("\n")) {
      const cut = line.lastIndexOf("|");
      if (cut < 1) continue;
      const n = Number(
        line.slice(cut + 1).trim()
          .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
          .replace(/[٫,]/g, ".")
          .replace(/[^\d.-]/g, ""),
      );
      if (Number.isFinite(n)) values.push(n);
    }
    if (values.length < 2) continue;

    const traced = values.filter((v) => near(v, known)).length;
    if (traced / values.length < 0.5) {
      return (
        "أرقام أحد المخطّطات لا توجد في البيانات التي قرأتِها — لا ترسمي مخطّطاً من تقدير. " +
        "ارسمي فقط ما حسبتِه من استعلام فعلي، وإن لم يكن النظام يحتفظ بالبيانات (مثل سبب عدم الحضور) فقولي ذلك صراحةً ولا ترسميه."
      );
    }
  }
  return null;
}

function numbersIn(json: string): Set<number> {
  const out = new Set<number>();
  for (const m of json.matchAll(/-?\d+(?:\.\d+)?/g)) {
    const n = Number(m[0]);
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

/** Tolerant of rounding, because a figure shown to the reader usually is. */
function near(v: number, known: Set<number>): boolean {
  if (known.has(v)) return true;
  for (const k of known) {
    if (k === 0) continue;
    if (Math.abs(k - v) <= Math.max(0.51, Math.abs(k) * 0.02)) return true;
  }
  return false;
}

/* The first heading whose body carries no digit at all.
 *
 * Deliberately crude: any numeral counts. A section that says "٢٥ حالة"
 * has looked at something; one with no digit anywhere is recommendations
 * wearing a heading, which is the failure this catches. */
function barrenSection(body: string): string | null {
  const lines = body.split(/\r?\n/);
  let title: string | null = null;
  let hasFigure = false;

  const barren = () => (title && !hasFigure ? title : null);

  for (const line of lines) {
    const h = /^\s*#{1,3}\s+(.*)$/.exec(line);
    if (h) {
      const found = barren();
      if (found) return found;
      title = h[1].trim();
      hasFigure = false;
      continue;
    }
    if (title && /[\d\u0660-\u0669]/.test(line)) hasFigure = true;
  }
  return barren();
}
