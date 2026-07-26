/* The module catalogue — what a clinic can actually be sold.

   This lives in code, not in a table, because every entry is coupled to routes
   that exist. A modules table would let an operator invent "الأشعة" in a
   dropdown, sell it, and discover afterwards that nothing was built. Adding a
   module here is a deliberate act by whoever built the pages it unlocks.

   Core capability is deliberately absent: appointments, patients, invoices,
   services, staff, settings, reception and the daily cash close are the product,
   not an upsell. A clinic that cannot invoice is not running on TAWD. */

export type ModuleKey =
  | "sura"
  | "sura_voice"
  | "online_booking"
  | "waitlist"
  | "treatment_plans"
  | "inventory"
  | "payroll"
  | "expenses"
  | "commissions"
  | "insurance"
  | "loyalty"
  | "marketing"
  | "online_payments"
  | "reports";

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  /** what the clinic loses without it, in the words a manager would use */
  blurb: string;
  group: "سُرى والحجز" | "العيادة" | "المال" | "النمو";
  /** route prefixes gated by this module */
  routes: string[];
};

export const MODULES: ModuleDef[] = [
  {
    key: "sura", label: "سُرى — موظفة الاستقبال الذكية",
    blurb: "ترد على واتساب وتحجز المواعيد بدل الموظف",
    group: "سُرى والحجز",
    routes: ["/clinic-admin/sura-analytics"],
  },
  {
    key: "sura_voice", label: "الرسائل الصوتية",
    blurb: "سُرى تفهم الرسائل الصوتية وترد عليها",
    group: "سُرى والحجز", routes: [],
  },
  {
    key: "online_booking", label: "صفحة الحجز الإلكتروني",
    blurb: "رابط حجز عام يشاركه المريض ويحجز بنفسه",
    group: "سُرى والحجز", routes: [],
  },
  {
    key: "waitlist", label: "قائمة الانتظار الذكية",
    blurb: "تملأ المواعيد الملغاة تلقائياً من قائمة الانتظار",
    group: "سُرى والحجز", routes: [],
  },
  {
    key: "treatment_plans", label: "خطط العلاج",
    blurb: "خطة متعددة الزيارات بسعر وموافقة ومتابعة تنفيذ",
    group: "العيادة",
    routes: ["/clinic-admin/treatment-plans", "/doctor/treatment-plans"],
  },
  {
    key: "inventory", label: "المخزون والصيدلية",
    blurb: "أصناف ودفعات وتواريخ صلاحية وخصم تلقائي عند الفوترة",
    group: "العيادة",
    routes: ["/clinic-admin/inventory"],
  },
  {
    key: "payroll", label: "الرواتب والحضور",
    blurb: "حضور يومي ومسيّر رواتب شهري وقسائم رواتب",
    group: "المال",
    routes: ["/clinic-admin/finance/payroll"],
  },
  {
    key: "expenses", label: "المصروفات والأرباح",
    blurb: "مصروفات العيادة وصافي الربح، لا الإيراد وحده",
    group: "المال",
    routes: ["/clinic-admin/finance/expenses"],
  },
  {
    key: "commissions", label: "عمولات الأطباء",
    blurb: "احتساب العمولة عند الفوترة واعتمادها وصرفها",
    group: "المال",
    routes: ["/clinic-admin/finance/commissions"],
  },
  {
    key: "insurance", label: "التأمين والمطالبات",
    blurb: "شركات التأمين وتغطية المرضى ودورة المطالبة",
    group: "المال",
    routes: ["/clinic-admin/insurance"],
  },
  {
    key: "online_payments", label: "الدفع الإلكتروني",
    blurb: "روابط دفع ثواني تُرسَل للمريض على واتساب",
    group: "المال",
    routes: ["/clinic-admin/finance/online"],
  },
  {
    key: "loyalty", label: "نقاط الولاء",
    blurb: "نقاط تُكتسب بالإنفاق وتُستبدل عند الدفع",
    group: "النمو",
    routes: ["/accountant/loyalty"],
  },
  {
    key: "marketing", label: "التسويق والحملات",
    blurb: "حملات واتساب للمرضى واسترجاع المنقطعين",
    group: "النمو",
    routes: ["/clinic-admin/marketing"],
  },
  {
    key: "reports", label: "التقارير المتقدمة",
    blurb: "نسبة التحصيل، الغياب، قبول الخطط، إنتاجية الأطباء",
    group: "النمو",
    routes: ["/clinic-admin/reports"],
  },
];

export const MODULE_BY_KEY: Record<string, ModuleDef> =
  Object.fromEntries(MODULES.map((m) => [m.key, m]));

export const MODULE_GROUPS = ["سُرى والحجز", "العيادة", "المال", "النمو"] as const;

/** Which module owns a path, if any. Longest prefix wins so
    /clinic-admin/finance/payroll is payroll and not the finance hub. */
export function moduleForPath(path: string): ModuleDef | null {
  let best: ModuleDef | null = null;
  let bestLen = 0;
  for (const m of MODULES) {
    for (const r of m.routes) {
      if ((path === r || path.startsWith(`${r}/`)) && r.length > bestLen) {
        best = m; bestLen = r.length;
      }
    }
  }
  return best;
}

export type Entitlements = {
  clinicId: string;
  sourcePlan: string | null;
  modules: ModuleKey[];
  maxDoctors: number | null;
  maxStaff: number | null;
  maxPatients: number | null;
  maxWhatsappMsgs: number | null;
  basePriceOmr: number;
  perDoctorOmr: number;
  setupFeeOmr: number;
  contractedDoctors: number;
  discountPct: number;
  notes: string | null;
};

/** Monthly total as agreed: base, plus per-doctor for the contracted headcount,
    less any negotiated discount. Rounded to baisa — Oman prices to three
    decimals and a half-baisa on an invoice is not a number. */
export function monthlyTotal(e: {
  basePriceOmr: number; perDoctorOmr: number; contractedDoctors: number; discountPct: number;
}): number {
  const gross = e.basePriceOmr + e.perDoctorOmr * Math.max(0, e.contractedDoctors);
  const net = gross * (1 - Math.min(100, Math.max(0, e.discountPct)) / 100);
  return Math.round(net * 1000) / 1000;
}

/** A clinic with no entitlements row is not a clinic with no modules.

    It is a clinic created before this existed, or one whose row failed to seed.
    Locking it out of everything on the strength of a missing row would take a
    working customer offline over a data gap, so the fallback is everything on
    and unlimited. Under-charging is recoverable; a dark dashboard is not. */
export const OPEN_ENTITLEMENTS = (clinicId: string): Entitlements => ({
  clinicId,
  sourcePlan: null,
  modules: MODULES.map((m) => m.key),
  maxDoctors: null, maxStaff: null, maxPatients: null, maxWhatsappMsgs: null,
  basePriceOmr: 0, perDoctorOmr: 0, setupFeeOmr: 0,
  contractedDoctors: 1, discountPct: 0,
  notes: null,
});
