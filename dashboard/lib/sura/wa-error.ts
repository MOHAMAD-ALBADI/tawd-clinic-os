/** Meta's numeric codes mean nothing to a clinic manager.
 *
 * This lived inside actions.ts and was used only on the path where a
 * human asks Sura to message someone. The autonomous tick had its own
 * send function that returned `(await res.text()).slice(0, 300)` — the
 * raw Graph API body, truncated mid-JSON — and that string was written
 * to sura_actions and rendered verbatim in the agent's own timeline. A
 * clinic owner opening the page saw a broken English `OAuthException`
 * blob where a sentence belonged.
 *
 * Shared here so a third send path cannot reintroduce it.
 */
export function waError(body: string): string {
  if (body.includes("131030")) return "رقم المريض غير مضاف لقائمة الأرقام المسموحة في حساب واتساب التجريبي";
  if (body.includes("131047")) return "خارج نافذة الـ٢٤ ساعة — واتساب يمنع الرسائل الحرة لمن لم يراسل العيادة مؤخراً";
  if (body.includes("131026")) return "الرقم غير مسجّل في واتساب";
  if (body.includes("131031")) return "حساب واتساب موقوف من Meta";
  if (body.includes("100")   ) return "طلب غير صالح إلى واتساب — راجع إعدادات القناة";
  if (body.includes("190")   ) return "انتهت صلاحية رمز واتساب — جدّده من الإعدادات";
  if (body.includes("80007") || body.includes("(#4)")) return "تجاوزت العيادة حدّ الرسائل المسموح حالياً — أعد المحاولة لاحقاً";
  return "تعذّر الإرسال عبر واتساب";
}
