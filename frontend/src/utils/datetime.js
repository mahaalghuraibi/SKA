/** Saudi Arabia — Riyadh (AST, UTC+3, no DST). */
export const RIYADH_TIMEZONE = "Asia/Riyadh";

/**
 * Backend stores naive UTC (no tz in ISO). Treat as UTC for correct Riyadh display.
 * @param {string | number | Date} value
 */
export function parseDishRecordedAt(value) {
  if (value instanceof Date) return value;
  if (value == null || value === "") return new Date(NaN);
  const s = String(value).trim();
  if (s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s);
  }
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  return new Date(`${normalized}Z`);
}

/**
 * Full date + time in Saudi locale and Riyadh zone.
 * @param {string | number | Date} value
 */
export function formatSaudiDateTime(value) {
  const d = value instanceof Date ? value : parseDishRecordedAt(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString("ar-SA-u-ca-gregory", {
    timeZone: RIYADH_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Time only (for compact lists).
 * @param {string | number | Date} value
 * @param {Intl.DateTimeFormatOptions} [overrides]
 */
export function formatTimeInRiyadh(value, overrides = {}) {
  const d = value instanceof Date ? value : parseDishRecordedAt(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleTimeString("ar-SA", {
    timeZone: RIYADH_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...overrides,
  });
}

/**
 * Long Arabic weekday + calendar date in Riyadh (lighter label line).
 * @param {string | number | Date} value
 */
export function formatSaudiDateLine(value) {
  const d = value instanceof Date ? value : parseDishRecordedAt(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString("ar-SA-u-ca-gregory", {
    timeZone: RIYADH_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Time in Riyadh with ص/م (for bold display line).
 * @param {string | number | Date} value
 */
export function formatSaudiTimeLine(value) {
  const d = value instanceof Date ? value : parseDishRecordedAt(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleTimeString("ar-SA", {
    timeZone: RIYADH_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
