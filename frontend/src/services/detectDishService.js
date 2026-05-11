import { normalizeConfidenceRatio, rawConfidenceFromSuggestion } from "../utils/confidence.js";
import { apiUrl } from "../config/apiBase.js";

export const UNKNOWN_DISH_TEXT = "طبق غير محدد";

const DETECT_DISH_URL = apiUrl("/api/v1/detect-dish");

/**
 * Map detect-dish JSON body to the normalized shape consumed by the staff dish UI.
 * @param {Record<string, unknown>} data
 */
function buildNormalizedDetectResult(data) {
  const apiDishNameAr = String(data?.dish_name_ar || "").trim();
  const apiDishName = String(data?.dish_name || "").trim();
  const suggestedName = String(data?.suggested_name || "").trim();
  const preferredDishName = apiDishNameAr || apiDishName || suggestedName;
  const detectedDishName =
    preferredDishName === "غير متأكد" ? UNKNOWN_DISH_TEXT : preferredDishName || UNKNOWN_DISH_TEXT;
  const rawSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
  const apiTopConf = normalizeConfidenceRatio(data?.confidence);
  let suggestions = rawSuggestions
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const ratio = normalizeConfidenceRatio(rawConfidenceFromSuggestion(s));
      return {
        name: String(s.name || s.Name || "").trim(),
        confidence: ratio,
        reason: String(s.reason || s.Reason || "").trim(),
      };
    })
    .filter((s) => s.name)
    .slice(0, 3);
  suggestions = suggestions.map((s, idx) => {
    if (s.confidence != null) return { ...s, confidence: s.confidence };
    if (apiTopConf == null) return { ...s, confidence: null };
    if (idx === 0) return { ...s, confidence: apiTopConf };
    return { ...s, confidence: Math.max(0.02, apiTopConf * (0.9 - idx * 0.12)) };
  });
  const suggestedOptions = Array.isArray(data?.suggested_options) ? data.suggested_options : [];
  const optionList =
    suggestions.length > 0
      ? suggestions.map((s) => s.name)
      : (suggestedOptions.length > 0 ? suggestedOptions : data?.labels || []).slice(0, 3);
  if (suggestions.length === 0 && optionList.length > 0) {
    const top = apiTopConf;
    suggestions = optionList.slice(0, 3).map((name, i) => ({
      name,
      confidence:
        top != null && Number.isFinite(top) && top > 0
          ? i === 0
            ? top
            : Math.max(0.02, top * (0.9 - i * 0.12))
          : null,
      reason: "",
    }));
  }
  if (detectedDishName && detectedDishName !== UNKNOWN_DISH_TEXT) {
    const _CAT = {
      برجر: "burger",
      "تشيز برجر": "burger",
      "برجر دجاج": "burger",
      "بيتزا": "pizza",
      "مكرونة": "pasta",
      "ساندويتش": "sandwich",
      "ستيك": "steak",
      "كباب": "grilled",
      "كفتة": "grilled",
      "مشويات": "grilled",
      "دجاج مشوي": "grilled",
      "شاورما": "grilled",
      "دجاج": "grilled",
      "لحم": "grilled",
      "سمك": "seafood",
      "روبيان": "seafood",
      "كبسة دجاج": "rice",
      "كبسة لحم": "rice",
      "مندي": "rice",
      "رز بخاري": "rice",
      "برياني": "rice",
      "مقلوبة": "rice",
      "رز": "rice",
      "ورق عنب": "stuffed",
      "محشي": "stuffed",
      "سلطة": "salad",
      "شوربة": "soup",
      "خبز": "bread",
      "حلويات": "dessert",
      "بطاطس مقلية": "sides",
    };
    const _FILL = {
      burger: ["برجر", "تشيز برجر", "برجر دجاج"],
      pizza: ["بيتزا", "مكرونة", "ساندويتش"],
      pasta: ["مكرونة", "بيتزا", "خبز"],
      steak: ["ستيك", "كباب", "مشويات"],
      grilled: ["كباب", "مشويات", "دجاج مشوي"],
      seafood: ["سمك", "روبيان", "مشويات"],
      rice: ["كبسة دجاج", "مندي", "رز بخاري"],
      stuffed: ["ورق عنب", "محشي", "مقلوبة"],
    };
    const topCat = _CAT[detectedDishName];
    if (topCat) {
      const same = suggestions.filter((s) => _CAT[s.name] === topCat || s.name === detectedDishName);
      if (same.length < suggestions.length) {
        const seen = new Set(same.map((s) => s.name));
        const fills = _FILL[topCat] || [];
        for (const name of fills) {
          if (same.length >= 3) break;
          if (!seen.has(name)) {
            same.push({ name, confidence: 0, reason: "" });
            seen.add(name);
          }
        }
        suggestions = same.slice(0, 3);
      }
    }
  }

  const visualReason = String(data?.visual_reason || data?.suggestion_reason || "").trim();
  const topFromFirst = suggestions.length > 0 ? suggestions[0].confidence : null;
  const topFromApi = apiTopConf;
  const topConfRatio =
    topFromFirst != null && Number.isFinite(topFromFirst)
      ? topFromFirst
      : topFromApi != null && Number.isFinite(topFromApi)
        ? topFromApi
        : null;
  const topConfidencePct =
    topConfRatio != null ? Math.round(Math.max(0, Math.min(1, topConfRatio)) * 100 * 10) / 10 : null;
  const proteinConflict = Boolean(data?.protein_conflict);
  const needsReviewLowConf =
    (topConfRatio != null && Number.isFinite(topConfRatio) && topConfRatio < 0.45) ||
    (topConfRatio == null && Boolean(data?.needs_review));
  return {
    detected: detectedDishName,
    confidence: topConfidencePct,
    topConfRatio,
    suggestions,
    alternatives: optionList,
    experimental: Boolean(data?.experimental),
    suggestedName: suggestedName || null,
    suggestionReason: String(data?.suggestion_reason || "").trim(),
    visualReason,
    needsReview: Boolean(data?.needs_review),
    needsReviewLowConf,
    proteinConflict,
    visionModel: String(data?.vision_model || "").trim(),
    proteinType: String(data?.protein_type || "").trim(),
  };
}

/**
 * POST multipart image to detect-dish. No React state; same URL/headers/body as before.
 */
export async function detectDish(token, file) {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(DETECT_DISH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, body: data };
  }
  const normalized = buildNormalizedDetectResult(data);
  return { ok: true, normalized };
}
