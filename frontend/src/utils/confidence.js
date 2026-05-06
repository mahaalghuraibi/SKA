/** Pull confidence value from an API suggestion object (handles snake_case / loose providers). */
export function rawConfidenceFromSuggestion(s) {
  if (!s || typeof s !== "object") return null;
  const v =
    s.confidence ??
    s.Confidence ??
    s.score ??
    s.Score ??
    s.probability ??
    s.confidence_score;
  if (v == null || v === "") return null;
  return v;
}

/** Normalize to 0–1: 0.615 stays 0.615; 61.5 → 0.615. No double scaling. */
export function normalizeConfidenceRatio(raw) {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return Math.min(1, n / 100);
  if (n > 100) return 1;
  return null;
}

/** Display as one-decimal percent; unknown → em dash (not 0%). */
export function formatConfidencePercentDisplay(raw) {
  const r = normalizeConfidenceRatio(raw);
  if (r == null) return "—";
  if (r <= 0) return "0%";
  return `${Math.round(r * 100 * 10) / 10}%`;
}
