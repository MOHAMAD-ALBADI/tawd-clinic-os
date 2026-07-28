import { clinicToday, clinicDayRange } from "@/lib/clinic-time";

/* The period every finance screen is looking at.

   Each of them was pinned to one window written into the query — today, or this
   month, or everything ever. An accountant does not work that way: closing June
   means looking at June, and the product had no way to be asked. The ledger
   showed the last five hundred invoices whenever they happened to be raised, and
   the payments register the last four hundred, so both silently changed meaning
   as the clinic got busier.

   The choice lives in the URL rather than in component state, so a period can be
   linked, bookmarked and sent to somebody — "look at this month's collections"
   is a message with a link in it. */

export type PeriodKey =
  | "today" | "week" | "month" | "last_month" | "quarter" | "year" | "all" | "custom";

export type Period = {
  key: PeriodKey;
  label: string;
  /** clinic-local dates, inclusive start and exclusive end */
  from: string | null;
  to: string | null;
  /** UTC instants for querying timestamptz columns */
  startUtc: string | null;
  endUtc: string | null;
};

const AR: Record<PeriodKey, string> = {
  today: "اليوم",
  week: "آخر ٧ أيام",
  month: "هذا الشهر",
  last_month: "الشهر الماضي",
  quarter: "هذا الربع",
  year: "هذه السنة",
  all: "كل الفترات",
  custom: "فترة محدّدة",
};

export const PERIOD_CHOICES: PeriodKey[] =
  ["today", "week", "month", "last_month", "quarter", "year", "all"];

export const periodLabel = (k: PeriodKey) => AR[k] ?? AR.month;

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* Date-only arithmetic, on the calendar rather than on an instant.

   clinicDatePlus shifts a moment in time and re-reads the clinic's date off it,
   which is the right tool for "90 days before now" and the wrong one here: these
   bounds are calendar dates already, and running them back through a timezone
   conversion is how a period quietly loses or gains a day. */
function shiftDate(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00.000Z`).getTime() + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** First day of the month `date` falls in. */
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

/** First day of the month after the one `date` falls in — an exclusive end. */
function monthAfter(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** Resolve ?period=&from=&to= into real bounds.

    Defaults to the current month: an accountant opening a finance screen is
    almost always inside the month they are closing, and "everything ever" is a
    figure nobody reconciles. */
export function resolvePeriod(sp: {
  period?: string; from?: string; to?: string;
}, now = new Date()): Period {
  const today = clinicToday(now);
  const key = (PERIOD_CHOICES as string[]).includes(sp.period ?? "")
    ? (sp.period as PeriodKey)
    : isDate(sp.from) || isDate(sp.to) ? "custom"
    : "month";

  let from: string | null;
  let to: string | null; // exclusive

  switch (key) {
    case "today":
      from = today; to = shiftDate(today, 1); break;
    case "week":
      from = shiftDate(today, -6); to = shiftDate(today, 1); break;
    case "month":
      from = monthStart(today); to = monthAfter(today); break;
    case "last_month": {
      const prev = shiftDate(monthStart(today), -1); // last day of last month
      from = monthStart(prev); to = monthStart(today); break;
    }
    case "quarter": {
      const m = Number(today.slice(5, 7));
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      from = `${today.slice(0, 4)}-${String(qStart).padStart(2, "0")}-01`;
      to = monthAfter(`${today.slice(0, 4)}-${String(qStart + 2).padStart(2, "0")}-01`);
      break;
    }
    case "year":
      from = `${today.slice(0, 4)}-01-01`; to = `${Number(today.slice(0, 4)) + 1}-01-01`; break;
    case "all":
      from = null; to = null; break;
    default: {
      /* A half-filled custom range is a range: an open start means "up to this
         date", an open end means "from this date onwards". Refusing it would
         make the commonest use — everything since we started — impossible. */
      from = isDate(sp.from) ? sp.from : null;
      /* The end date the user typed is the last day they mean to include, so the
         exclusive bound is the day after it. Off by one here silently drops the
         last day of every month an accountant ever looks at. */
      to = isDate(sp.to) ? shiftDate(sp.to, 1) : null;
    }
  }

  const label = key === "custom"
    ? from && to ? `${from} → ${shiftDate(to, -1)}`
      : from ? `من ${from}` : `حتى ${shiftDate(to!, -1)}`
    : AR[key];

  return {
    key, label, from, to,
    startUtc: from ? clinicDayRange(from).startUtc : null,
    /* clinicDayRange(to).startUtc is midnight at the START of the exclusive end
       date, which is exactly the boundary wanted. */
    endUtc: to ? clinicDayRange(to).startUtc : null,
  };
}

/** The same window, immediately before this one.

    A figure on its own says nothing — "collected 4,200" is only good or bad
    against what the clinic did last month. The comparison has to be the same
    LENGTH or it is not a comparison, so this walks back by the period's own span
    rather than by a calendar month.

    An unbounded period has no "before", and neither does a period with only one
    end filled in. */
export function previousPeriod(p: Period): Period {
  if (!p.from || !p.to) {
    return { ...p, key: "all", label: "—", from: null, to: null, startUtc: null, endUtc: null };
  }

  let from: string;
  const to = p.from;

  /* Calendar periods step back by a calendar unit, not by their own length.

     An accountant comparing March to "last month" means February, and everyone
     knows February is short. Stepping back 31 days instead would produce
     "29 Jan – 1 Mar", a window nobody thinks in and which double-counts the end
     of January. Equal-length is the right answer only where the period has no
     calendar meaning. */
  if (p.key === "month" || p.key === "last_month") {
    from = monthBefore(p.from);
  } else if (p.key === "quarter") {
    from = monthBefore(monthBefore(monthBefore(p.from)));
  } else if (p.key === "year") {
    from = `${Number(p.from.slice(0, 4)) - 1}${p.from.slice(4)}`;
  } else {
    /* today, week, custom — a rolling window, so the comparison is the same
       number of days immediately before it. */
    const spanDays = Math.max(1, Math.round(
      (new Date(`${p.to}T00:00:00.000Z`).getTime() - new Date(`${p.from}T00:00:00.000Z`).getTime())
      / 86_400_000));
    from = shiftDate(p.from, -spanDays);
  }

  return {
    key: p.key, label: "الفترة السابقة", from, to,
    startUtc: clinicDayRange(from).startUtc,
    endUtc: clinicDayRange(to).startUtc,
  };
}

/** First day of the month before the one `date` starts. */
function monthBefore(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

/** Apply the period to a timestamptz column, if it is bounded. */
export function withinPeriod<T extends {
  gte: (c: string, v: string) => T; lt: (c: string, v: string) => T;
}>(q: T, column: string, p: Period): T {
  let out = q;
  if (p.startUtc) out = out.gte(column, p.startUtc);
  if (p.endUtc) out = out.lt(column, p.endUtc);
  return out;
}

/** Apply the period to a plain date column (expense_date, close_date …). */
export function withinPeriodDate<T extends {
  gte: (c: string, v: string) => T; lt: (c: string, v: string) => T;
}>(q: T, column: string, p: Period): T {
  let out = q;
  if (p.from) out = out.gte(column, p.from);
  if (p.to) out = out.lt(column, p.to);
  return out;
}
