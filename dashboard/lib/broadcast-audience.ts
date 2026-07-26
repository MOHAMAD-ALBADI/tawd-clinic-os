/* Shared between the broadcast screen and the server action.

   These live outside app/actions because a "use server" file may only export
   async functions — a plain const there compiles and then throws at runtime. */

export type AudienceFilter = {
  statuses?: string[];
  plans?: string[];
  /** only clinics with WhatsApp actually connected */
  whatsappLinkedOnly?: boolean;
  /** no appointment booked in this many days */
  idleDays?: number;
  /** subscription or trial ending within this many days (negative = expired) */
  expiringWithinDays?: number;
};

export type Recipient = {
  clinicId: string;
  label: string;
  phone: string;
  plan: string;
  status: string;
  daysLeft: number | null;
};

export const STATUS_AR: Record<string, string> = {
  trial: "تجريبية", active: "نشطة", suspended: "موقوفة", cancelled: "ملغاة",
};

/* Personalisation is deliberately three tokens, not a template language.
   Anything longer than this list is a mail-merge product, and the failure mode
   of a half-built one is a customer receiving "مرحباً {{clinic}}". */
export const TOKENS: { token: string; label: string; example: string }[] = [
  { token: "{{clinic}}", label: "اسم العيادة", example: "عيادة النور" },
  { token: "{{plan}}",   label: "الباقة",      example: "Pro" },
  { token: "{{days}}",   label: "أيام متبقية", example: "٧" },
];

export function resolveBody(body: string, r: Recipient): string {
  return body
    .replaceAll("{{clinic}}", r.label)
    .replaceAll("{{plan}}", r.plan)
    .replaceAll("{{days}}", r.daysLeft == null ? "—" : String(Math.max(0, r.daysLeft)));
}

/** A one-line description of the segment, stored with the send so a broadcast
    from three months ago can still be explained. */
export function audienceLabel(f: AudienceFilter): string {
  const parts: string[] = [];
  if (f.statuses?.length) parts.push(f.statuses.map((s) => STATUS_AR[s] ?? s).join(" أو "));
  if (f.plans?.length) parts.push(`باقة ${f.plans.join(" أو ")}`);
  if (f.expiringWithinDays != null) {
    parts.push(f.expiringWithinDays <= 0 ? "منتهية" : `تنتهي خلال ${f.expiringWithinDays} يوم`);
  }
  if (f.idleDays) parts.push(`خاملة ${f.idleDays}+ يوم`);
  if (f.whatsappLinkedOnly) parts.push("واتساب مربوط");
  return parts.length ? parts.join(" · ") : "كل العيادات";
}

/** The sends a founder actually makes, as one click each. */
export const PRESETS: { key: string; label: string; hint: string; filter: AudienceFilter; body: string }[] = [
  {
    key: "renewal",
    label: "تذكير تجديد",
    hint: "اشتراك أو تجربة تنتهي خلال ٧ أيام",
    filter: { expiringWithinDays: 7 },
    body: "مرحباً {{clinic}} 👋\nاشتراككم في طود ({{plan}}) ينتهي خلال {{days}} أيام.\nللتجديد أو تغيير الباقة ردّوا على هذه الرسالة وسنكمل معكم.",
  },
  {
    key: "winback",
    label: "عيادات خاملة",
    hint: "لم تُسجَّل مواعيد منذ ١٤ يوماً",
    filter: { idleDays: 14, statuses: ["active", "trial"] },
    body: "مرحباً {{clinic}} 👋\nلاحظنا أن النظام لم يُستخدم منذ فترة. إن كان هناك ما يعيقكم — إعداد، تدريب، أو ربط واتساب — ردّوا علينا ونحلّه معكم اليوم.",
  },
  {
    key: "feature",
    label: "إعلان ميزة",
    hint: "كل العيادات النشطة والتجريبية",
    filter: { statuses: ["active", "trial"] },
    body: "تحديث جديد في طود 🎉\n{{clinic}} — أضفنا ميزة جديدة تجدونها في لوحتكم الآن.\nللشرح أو التدريب ردّوا على هذه الرسالة.",
  },
  {
    key: "overdue",
    label: "متأخرة السداد",
    hint: "انتهى اشتراكها ولم تجدّد",
    filter: { expiringWithinDays: 0 },
    body: "مرحباً {{clinic}}\nانتهى اشتراككم في طود. الحساب والبيانات محفوظة، ويعود العمل فور التجديد.\nردّوا على هذه الرسالة وسنساعدكم.",
  },
];
