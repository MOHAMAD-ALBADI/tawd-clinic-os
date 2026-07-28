/* How money reaches the clinic, in one place.

   The method list was written out by hand in the cashier, the ledger, the
   day-close and the VAT export, and each copy had a slightly different idea —
   which is how «شبكة / تحويل» ended up as a single button covering two things
   that reconcile against different documents.

   Lives outside app/actions because a "use server" file may only export async
   functions: exporting a constant from one crashes at runtime while typecheck and
   build both pass. */

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "thawani" | "insurance";

/** Where the money physically ends up, which is what the day-close reconciles.

    drawer    notes in the till, counted by hand at close
    terminal  the clinic's own card machine, checked against its settlement report
    bank      money arriving in the account, checked against the statement
    none      never passes through the clinic's hands at all */
export type Settles = "drawer" | "terminal" | "bank" | "none";

export const METHODS: Record<PaymentMethod, {
  label: string;
  /** shown under the label at the cashier */
  hint: string;
  settles: Settles;
  /** a reference the clinic can reconcile against, and what to call it */
  refLabel: string | null;
  /** refuse to save without a reference — only where its absence makes the
      payment unmatchable rather than merely untidy */
  refRequired: boolean;
  colour: string;
}> = {
  cash: {
    label: "نقداً", hint: "يدخل الصندوق",
    settles: "drawer", refLabel: null, refRequired: false, colour: "#34d399",
  },
  card: {
    label: "بطاقة — مكينة العيادة", hint: "شبكة أو فيزا على المكينة",
    settles: "terminal", refLabel: "رقم العملية على الإيصال", refRequired: false,
    colour: "#38bdf8",
  },
  bank_transfer: {
    label: "تحويل بنكي", hint: "المريض يحوّل على حساب العيادة",
    settles: "bank",
    refLabel: "مرجع التحويل",
    /* Without it, a transfer is a claim that money arrived with nothing to check
       it against — and it is the one method where the money is not in the room. */
    refRequired: true,
    colour: "#a78bfa",
  },
  thawani: {
    label: "رابط دفع إلكتروني", hint: "دفع المريض عبر الرابط",
    settles: "bank", refLabel: "معرّف العملية", refRequired: false, colour: "#f0abfc",
  },
  insurance: {
    label: "تأمين", hint: "تُحصَّل من شركة التأمين",
    settles: "none", refLabel: "رقم المطالبة", refRequired: false, colour: "#fbbf24",
  },
};

export const METHOD_AR = (m: string) =>
  METHODS[m as PaymentMethod]?.label ?? m;

/** What the cashier may offer. A clinic that has not configured its methods gets
    all of them rather than none — a missing setting must never take a desk
    offline, the same rule entitlements follow. */
export function offeredMethods(accepted: string[] | null | undefined): PaymentMethod[] {
  const all: PaymentMethod[] = ["cash", "card", "bank_transfer", "insurance"];
  if (!accepted?.length) return all;
  const set = new Set(accepted);
  const kept = all.filter((m) => set.has(m));
  /* Configured down to nothing is a mistake, not an instruction to stop taking
     money. */
  return kept.length ? kept : all;
}

/** The three figures a day-close is checked against, plus what it cannot check. */
export function bucketOf(method: string): Settles {
  return METHODS[method as PaymentMethod]?.settles ?? "none";
}
