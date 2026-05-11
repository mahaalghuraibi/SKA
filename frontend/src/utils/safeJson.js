/**
 * Safe JSON.parse — avoids throwing when APIs return empty/non-JSON bodies.
 */
export function safeJsonParse(raw, fallback = null) {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
