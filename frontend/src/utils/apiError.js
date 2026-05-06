/**
 * Build a user-visible Arabic message from a failed API response body + status.
 * Handles FastAPI 422 validation arrays and string `detail`.
 */
export function dishSaveErrorMessage(status, body) {
  if (status === 401) {
    return "انتهت الجلسة أو بيانات الدخول غير صالحة. سجّل الدخول مرة أخرى.";
  }
  if (status === 403) {
    if (body?.detail && typeof body.detail === "string") return body.detail;
    return "ليس لديك صلاحية لتسجيل هذا الطبق.";
  }
  if (status === 422) {
    const detail = body?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      const loc = Array.isArray(first?.loc) ? first.loc.filter((x) => x !== "body").join(" › ") : "";
      const msg = typeof first?.msg === "string" ? first.msg : "";
      const type = first?.type || "";
      if (type === "int_from_float" || msg.includes("fractional")) {
        return "الكمية يجب أن تكون عدداً صحيحاً بدون كسور، وأكبر من أو تساوي 1.";
      }
      if (msg.includes("at least 1 character") || type === "string_too_short") {
        return "يرجى تعبئة جميع الحقول المطلوبة (رابط الصورة، التسمية، المصدر، الكمية).";
      }
      if (msg.includes("String should have at most")) {
        if (loc.includes("image_url") || msg.includes("6000000")) {
          return "صورة الطبق كبيرة جدًا عن حد التخزين. جرّب صورة أصغر أو أقل دقة.";
        }
        return "أحد الحقول أطول من المسموح. اختصر المصدر أو البيانات وحاول مرة أخرى.";
      }
      const suffix = loc ? ` (${loc})` : "";
      return `البيانات غير صالحة${suffix}: ${msg || "راجع الحقول المرسلة."}`;
    }
  }
  if (body?.detail && typeof body.detail === "string") {
    return body.detail;
  }
  if (status >= 500) {
    return "خطأ في الخادم أثناء الحفظ. حاول لاحقاً أو تواصل مع الدعم.";
  }
  return `تعذر حفظ الطبق (رمز ${status}). حاول مرة أخرى.`;
}
