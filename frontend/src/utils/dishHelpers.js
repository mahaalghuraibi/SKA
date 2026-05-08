/** Coerce a raw value to a positive integer >= 1 (used for quantities). */
export function positiveIntQuantity(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function staffStatusText(status, needsReview) {
  if (status === "approved") return "تم الاعتماد";
  if (status === "rejected") return "مرفوض";
  if (status === "pending_review" || status === "needs_review" || needsReview) return "يحتاج مراجعة";
  return needsReview ? "يحتاج مراجعة" : "موثوق";
}

export function staffStatusTone(statusText) {
  if (statusText === "تم الاعتماد" || statusText === "موثوق") return "text-teal-200/95";
  if (statusText === "مرفوض") return "text-rose-200/90";
  return "text-amber-200/90";
}

/** True when the string is a renderable <img src> (same-origin /api/, blob:, data:, http(s):). */
export function isRenderableImageSrc(src) {
  if (typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:") ||
    s.startsWith("data:") ||
    s.startsWith("/api/")
  );
}

/** Resolve the best thumbnail src from a dish record object. */
export function dishRecordThumbSrc(record) {
  if (record.localPreviewUrl) return record.localPreviewUrl;
  const u = record.imageUrl || record.imageDataUrl || "";
  if (isRenderableImageSrc(u)) return u.trim();
  return "";
}

export function supervisorStatusText(status) {
  if (status === "approved") return "تم الاعتماد";
  if (status === "rejected") return "مرفوض";
  return "يحتاج مراجعة";
}

export function displayAiConfidence(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return "غير متوفر";
  const pct = n <= 1 ? n * 100 : n;
  if (pct <= 0) return "غير متوفر";
  return `${Math.round(pct * 10) / 10}%`;
}

export function roleAr(role) {
  if (role === "staff") return "موظف";
  if (role === "supervisor") return "سوبر فايزر";
  if (role === "admin") return "أدمن";
  return role || "—";
}
