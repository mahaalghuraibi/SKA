"""
Image-only dish classification for SKA using Gemini Vision.
Pipeline: Gemini Vision only — no Roboflow, no OpenAI, no local models.
"""

from __future__ import annotations

import io
import json
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_DISHES: tuple[str, ...] = (
    # ── Arabic grilled / meat ────────────────────────────────────
    "كباب",
    "كفتة",
    "مشويات",
    "شاورما",
    "دجاج مشوي",
    "دجاج",
    "لحم",
    "سمك",
    "روبيان",
    # ── Arabic rice dishes ───────────────────────────────────────
    "كبسة دجاج",
    "كبسة لحم",
    "مندي",
    "برياني",
    "مقلوبة",
    "رز بخاري",
    "رز",
    # ── Stuffed / wrapped ────────────────────────────────────────
    "ورق عنب",
    "محشي",
    # ── Burgers ──────────────────────────────────────────────────
    "برجر",
    "تشيز برجر",
    "برجر دجاج",
    # ── Western / fast food ──────────────────────────────────────
    "بيتزا",
    "ستيك",
    "ساندويتش",
    "بطاطس مقلية",
    # ── Universal ────────────────────────────────────────────────
    "مكرونة",
    "سلطة",
    "شوربة",
    "خبز",
    "حلويات",
    # ── Fallback ─────────────────────────────────────────────────
    "غير متأكد",
)
ALLOWED_SET = frozenset(ALLOWED_DISHES)

# Flag needs_review when top-suggestion confidence is below this threshold.
REVIEW_CONFIDENCE_THRESHOLD = 0.75
# Ignore very-low-confidence padded slots when checking protein conflicts.
CONFLICT_CONFIDENCE_FLOOR = 0.12

# Per-dish fallback alternatives — realistic restaurant suggestions within same food category.
DISH_SIMILAR: dict[str, list[str]] = {
    # Arabic grilled / meat
    "كباب":          ["كفتة", "مشويات", "ستيك"],
    "كفتة":          ["كباب", "مشويات", "لحم"],
    "مشويات":        ["كباب", "كفتة", "دجاج مشوي"],
    "شاورما":        ["دجاج مشوي", "ساندويتش", "كباب"],
    "دجاج مشوي":    ["شاورما", "كباب", "مشويات"],
    "دجاج":          ["دجاج مشوي", "كبسة دجاج", "شاورما"],
    "لحم":           ["كباب", "كفتة", "ستيك"],
    "سمك":           ["روبيان", "دجاج مشوي", "مشويات"],
    "روبيان":        ["سمك", "مشويات", "دجاج مشوي"],
    # Arabic rice dishes
    "كبسة دجاج":    ["مندي", "رز بخاري", "مقلوبة"],
    "كبسة لحم":     ["مندي", "كبسة دجاج", "برياني"],
    "مندي":          ["كبسة دجاج", "كبسة لحم", "رز بخاري"],
    "برياني":        ["كبسة لحم", "مندي", "كبسة دجاج"],
    "مقلوبة":        ["كبسة دجاج", "مندي", "برياني"],
    "رز بخاري":     ["كبسة دجاج", "مندي", "مقلوبة"],
    "رز":            ["كبسة دجاج", "رز بخاري", "مندي"],
    # Stuffed / wrapped
    "ورق عنب":       ["محشي", "مقلوبة", "كبسة دجاج"],
    "محشي":          ["ورق عنب", "مقلوبة", "كبسة دجاج"],
    # Burgers — always suggest within burger/sandwich category
    "برجر":          ["تشيز برجر", "برجر دجاج", "ساندويتش"],
    "تشيز برجر":     ["برجر", "برجر دجاج", "ساندويتش"],
    "برجر دجاج":     ["برجر", "تشيز برجر", "ساندويتش"],
    # Western / fast food
    "بيتزا":         ["مكرونة", "ساندويتش", "خبز"],
    "ستيك":          ["كباب", "لحم", "مشويات"],
    "ساندويتش":      ["برجر", "تشيز برجر", "شاورما"],
    "بطاطس مقلية":  ["ساندويتش", "برجر", "خبز"],
    # Universal
    "مكرونة":        ["بيتزا", "رز", "شوربة"],
    "سلطة":          ["شوربة", "مكرونة", "خبز"],
    "شوربة":         ["سلطة", "مكرونة", "خبز"],
    "خبز":           ["ساندويتش", "شاورما", "مكرونة"],
    "حلويات":        ["خبز", "مكرونة", "سلطة"],
    "غير متأكد":     ["كبسة دجاج", "برجر", "دجاج مشوي"],
}

# Per-dish keyword sets (Arabic + English) for similarity scoring.
DISH_KEYWORDS: dict[str, frozenset[str]] = {
    "كباب": frozenset({
        "كباب", "مشوي", "شواء", "سيخ", "لحم مفروم", "فحم", "مشاوي",
        "kebab", "grilled", "skewer", "minced", "charcoal", "bbq",
    }),
    "كفتة": frozenset({
        "كفتة", "لحم مفروم", "مشوي", "سيخ", "فحم", "كفته",
        "kofta", "minced meat", "grilled", "skewer", "fingers",
    }),
    "مشويات": frozenset({
        "مشويات", "مشوي", "شواء", "فحم", "مشاوي", "سيخ", "تشكيلة",
        "grilled", "bbq", "charcoal", "mixed grill", "assorted",
    }),
    "شاورما": frozenset({
        "شاورما", "دجاج", "لحم", "خبز", "تورتيا", "ملفوف", "لفة",
        "shawarma", "wrap", "chicken", "meat", "flatbread", "roll",
    }),
    "دجاج مشوي": frozenset({
        "دجاج", "مشوي", "شواء", "فحم", "دجاج مشوي", "فروج",
        "chicken", "grilled", "roasted", "bbq chicken", "half chicken",
    }),
    "دجاج": frozenset({
        "دجاج", "طيور", "مقلي", "دجاج بالصلصة",
        "chicken", "poultry", "fried chicken", "chicken pieces",
    }),
    "لحم": frozenset({
        "لحم", "مشوي", "أحمر", "لحم بقر", "لحم غنم",
        "meat", "beef", "lamb", "grilled", "red meat",
    }),
    "سمك": frozenset({
        "سمك", "بحري", "مأكولات بحرية", "سمك مشوي", "سمك مقلي",
        "fish", "seafood", "grilled fish", "fried fish", "fillet",
    }),
    "روبيان": frozenset({
        "روبيان", "جمبري", "قريدس", "بحري", "مأكولات بحرية",
        "shrimp", "prawn", "seafood", "crustacean",
    }),
    "كبسة دجاج": frozenset({
        "كبسة", "رز", "دجاج", "بهارات", "خليجي", "سعودي", "أحمر",
        "kabsa", "rice", "chicken", "spiced rice", "gulf", "saudi", "red rice",
    }),
    "كبسة لحم": frozenset({
        "كبسة", "رز", "لحم", "بهارات", "خليجي", "أحمر",
        "kabsa", "rice", "lamb", "spiced rice", "gulf", "red rice",
    }),
    "مندي": frozenset({
        "مندي", "رز", "دخان", "مدخن", "طين", "ذهبي", "بني",
        "mandi", "rice", "smoked", "slow cooked", "golden", "tandoor",
    }),
    "برياني": frozenset({
        "برياني", "رز", "بهارات", "بسمتي", "هندي",
        "biryani", "rice", "spiced", "basmati", "indian", "layered",
    }),
    "مقلوبة": frozenset({
        "مقلوبة", "رز", "باذنجان", "دجاج", "لحم", "مقلوب", "خضار",
        "maqluba", "rice", "eggplant", "upside down", "layered",
    }),
    "رز بخاري": frozenset({
        "بخاري", "رز", "دجاج", "جزر", "بصل", "بهارات", "يمني",
        "bukhari", "rice", "chicken", "carrots", "onion", "yemeni",
    }),
    "رز": frozenset({
        "رز", "أرز", "أبيض", "مسلوق", "سادة",
        "rice", "plain rice", "white rice", "steamed", "boiled",
    }),
    "ورق عنب": frozenset({
        "ورق عنب", "لفائف", "ملفوف", "أرز", "خضراء",
        "grape leaves", "stuffed leaves", "rolls", "green rolls", "vine",
    }),
    "محشي": frozenset({
        "محشي", "حشو", "كوسا", "فلفل", "ورق", "أرز", "كوسة", "طماطم",
        "stuffed", "filling", "zucchini", "pepper", "tomato", "leaves",
    }),
    # Burgers
    "برجر": frozenset({
        "برجر", "همبرجر", "باتي", "خبز برجر", "بصل", "طماطم", "خس",
        "burger", "hamburger", "beef patty", "bun", "sesame bun", "lettuce",
    }),
    "تشيز برجر": frozenset({
        "تشيز برجر", "برجر", "جبن", "جبنة",
        "cheeseburger", "cheese burger", "cheese", "patty", "melted cheese", "bun",
    }),
    "برجر دجاج": frozenset({
        "برجر دجاج", "دجاج", "برجر",
        "chicken burger", "chicken patty", "crispy chicken", "fried chicken sandwich",
    }),
    # Western / fast food
    "بيتزا": frozenset({
        "بيتزا", "طماطم", "جبن", "عجين", "إيطالي",
        "pizza", "pepperoni", "mozzarella", "tomato sauce", "round", "crust", "toppings",
    }),
    "ستيك": frozenset({
        "ستيك", "لحم بقر", "مشوي", "خطوط شواء",
        "steak", "beef", "grilled", "medium rare", "grill marks", "sirloin", "ribeye",
    }),
    "ساندويتش": frozenset({
        "ساندويتش", "سندويتش", "خبز", "حشوة",
        "sandwich", "sub", "bread", "filling", "hoagie", "roll",
    }),
    "بطاطس مقلية": frozenset({
        "بطاطس", "بطاطا", "مقلية", "ذهبية",
        "fries", "french fries", "chips", "potato", "fried", "golden strips",
    }),
    # Universal
    "مكرونة": frozenset({
        "مكرونة", "معكرونة", "باستا", "عجين", "إيطالي",
        "pasta", "macaroni", "noodles", "spaghetti", "penne", "italian",
    }),
    "سلطة": frozenset({
        "سلطة", "خضار", "طازج", "أخضر", "خضروات",
        "salad", "vegetables", "fresh", "greens", "lettuce",
    }),
    "شوربة": frozenset({
        "شوربة", "حساء", "مرق", "سائل", "شربة",
        "soup", "broth", "stew", "liquid",
    }),
    "خبز": frozenset({
        "خبز", "عيش", "رغيف", "تنور",
        "bread", "naan", "pita", "flatbread", "tandoor bread",
    }),
    "حلويات": frozenset({
        "حلويات", "كيك", "آيس كريم", "حلو", "سكر", "كريمة", "شوكولاتة",
        "dessert", "cake", "ice cream", "sweet", "chocolate", "cream", "pastry", "pudding",
    }),
    "غير متأكد": frozenset(),
}

# Suggestions with similarity below this threshold are replaced with category defaults.
_MIN_SUGGESTION_SIMILARITY = 0.50


# ── Helpers ───────────────────────────────────────────────────────────────────


def _normalize_confidence_ratio(value: object) -> float:
    try:
        n = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    if n > 1.0 and n <= 100.0:
        n = n / 100.0
    if n > 100.0:
        return 1.0
    return max(0.0, min(1.0, n))


def _map_text_to_allowed_dish(text: str) -> str | None:
    t = (text or "").strip().lower()
    if not t:
        return None
    has_rice = any(k in t for k in ("rice", "رز"))
    has_chicken = any(k in t for k in ("chicken", "poultry", "دجاج"))
    has_meat = any(k in t for k in ("meat", "beef", "lamb", "لحم"))

    # Burgers — check before generic bread/sandwich
    if any(k in t for k in ("تشيز برجر", "cheeseburger", "cheese burger")):
        return "تشيز برجر"
    if any(k in t for k in ("برجر دجاج", "chicken burger", "chicken patty")):
        return "برجر دجاج"
    if any(k in t for k in ("برجر", "burger", "hamburger", "همبرجر", "beef patty")):
        return "برجر"
    # Pizza
    if any(k in t for k in ("بيتزا", "pizza", "pepperoni", "mozzarella")):
        return "بيتزا"
    # Steak
    if any(k in t for k in ("ستيك", "steak", "sirloin", "ribeye")):
        return "ستيك"
    # Fries
    if any(k in t for k in ("بطاطس مقلية", "french fries", "فريز")) or (
        "بطاطس" in t and any(k in t for k in ("مقلي", "مقلية", "fried", "fries"))
    ):
        return "بطاطس مقلية"
    # Shrimp / seafood (before generic fish)
    if any(k in t for k in ("روبيان", "جمبري", "قريدس", "shrimp", "prawn")):
        return "روبيان"
    # Desserts
    if any(k in t for k in ("حلويات", "كيك", "آيس كريم", "dessert", "cake", "ice cream", "sweet", "pastry")):
        return "حلويات"
    # Stuffed dishes
    if any(k in t for k in ("ورق عنب", "grape leaves", "stuffed leaves")):
        return "ورق عنب"
    if any(k in t for k in ("محشي", "stuffed", "حشو", "zucchini", "كوسا")):
        return "محشي"
    # Wraps
    if any(k in t for k in ("شاورما", "shawarma")):
        return "شاورما"
    # Sandwich (after shawarma/burger checks)
    if any(k in t for k in ("ساندويتش", "سندويتش", "sandwich", "sub", "hoagie")):
        return "ساندويتش"
    # Rice combos
    if any(k in t for k in ("مقلوبة", "maqluba", "upside down")):
        return "مقلوبة"
    if any(k in t for k in ("بخاري", "bukhari", "رز بخاري")):
        return "رز بخاري"
    if has_rice and has_chicken:
        return "كبسة دجاج"
    if has_rice and has_meat:
        return "كبسة لحم"
    if any(k in t for k in ("مندي", "mandi", "smoked rice")):
        return "مندي"
    if any(k in t for k in ("برياني", "biryani", "basmati")):
        return "برياني"
    # Grilled
    if any(k in t for k in ("grilled chicken", "roasted chicken", "دجاج مشوي")):
        return "دجاج مشوي"
    if any(k in t for k in ("كفتة", "kofta", "minced")):
        return "كفتة"
    if any(k in t for k in ("كباب", "kebab", "skewer")):
        return "كباب"
    if any(k in t for k in ("مشويات", "mixed grill", "مشاوي")):
        return "مشويات"
    if any(k in t for k in ("fish", "seafood", "سمك", "fillet")):
        return "سمك"
    if any(k in t for k in ("meat", "beef", "lamb", "لحم")):
        return "لحم"
    if any(k in t for k in ("chicken", "poultry", "دجاج")):
        return "دجاج"
    # Universal
    if any(k in t for k in ("pasta", "macaroni", "noodles", "spaghetti", "مكرونة")):
        return "مكرونة"
    if any(k in t for k in ("salad", "vegetables", "خضار", "سلطة")):
        return "سلطة"
    if any(k in t for k in ("soup", "broth", "شوربة")):
        return "شوربة"
    if any(k in t for k in ("bread", "خبز", "naan", "pita")):
        return "خبز"
    return None


def _protein_for_dish(dish_ar: str) -> str:
    if dish_ar in {"سمك", "روبيان"}:
        return "fish"
    if dish_ar in {"دجاج", "كبسة دجاج", "دجاج مشوي", "شاورما", "مقلوبة", "رز بخاري", "برجر دجاج"}:
        return "poultry"
    if dish_ar in {"لحم", "كبسة لحم", "كباب", "كفتة", "مشويات", "مندي", "ورق عنب", "محشي", "برجر", "تشيز برجر", "ستيك"}:
        return "red_meat"
    if dish_ar == "برياني":
        return "mixed"
    if dish_ar in {"مكرونة", "سلطة", "شوربة", "رز", "خبز", "بيتزا", "ساندويتش", "بطاطس مقلية", "حلويات", "غير متأكد"}:
        return "none"
    return "unknown"


def _parse_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    t = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t, re.IGNORECASE)
    if fence:
        t = fence.group(1).strip()
    try:
        obj = json.loads(t)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    start = t.find("{")
    end = t.rfind("}")
    if start >= 0 and end > start:
        try:
            obj = json.loads(t[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _validate_dish_name(name: str) -> str:
    s = (name or "").strip()
    if s in ALLOWED_SET:
        return s
    mapped = _map_text_to_allowed_dish(s)
    if mapped in ALLOWED_SET:
        return mapped
    for allowed in ALLOWED_DISHES:
        if allowed in s or s in allowed:
            return allowed
    return "غير متأكد"


def _protein_conflict_among_suggestions(sugs: list[dict[str, Any]]) -> bool:
    """True when confident suggestions mix incompatible proteins (fish vs meat/poultry)."""
    fish = poultry = red_meat = False
    for s in sugs[:3]:
        try:
            c = float(s.get("confidence", 0.0))
        except (TypeError, ValueError):
            c = 0.0
        if c < CONFLICT_CONFIDENCE_FLOOR:
            continue
        name = _validate_dish_name(str(s.get("name", "")))
        p = _protein_for_dish(name)
        if p == "fish":
            fish = True
        elif p == "poultry":
            poultry = True
        elif p == "red_meat":
            red_meat = True
    return (fish and red_meat) or (fish and poultry)


def refresh_review_metadata(result: dict[str, Any]) -> dict[str, Any]:
    """Recompute protein_conflict and needs_review after in-place edits (e.g. tenant history)."""
    sugs = result.get("suggestions")
    if not isinstance(sugs, list):
        result["protein_conflict"] = False
        result["needs_review"] = float(result.get("confidence") or 0) < REVIEW_CONFIDENCE_THRESHOLD
        return result
    rows: list[dict[str, Any]] = []
    for item in sugs[:3]:
        if isinstance(item, dict):
            rows.append(item)
        else:
            rows.append(
                {
                    "name": str(getattr(item, "name", "")),
                    "confidence": float(getattr(item, "confidence", 0.0)),
                    "reason": str(getattr(item, "reason", "")),
                }
            )
    conflict = _protein_conflict_among_suggestions(rows)
    top_conf = max(0.0, min(1.0, float(result.get("confidence") or 0.0)))
    result["protein_conflict"] = conflict
    result["needs_review"] = (top_conf < REVIEW_CONFIDENCE_THRESHOLD) or conflict
    if conflict:
        extra = "تعارض بين بروتينات مختلفة (مثل سمك مع لحم أو سمك مع دجاج) — يرجى الاختيار يدوياً."
        for key in ("visual_reason", "suggestion_reason"):
            cur = str(result.get(key) or "").strip()
            if extra not in cur:
                result[key] = f"{cur} {extra}".strip() if cur else extra
    return result


def _dedupe_suggestions_keep_best_conf(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for row in rows:
        name = _validate_dish_name(str(row.get("name", "")))
        c = _normalize_confidence_ratio(row.get("confidence", 0.0))
        reason = str(row.get("reason") or "").strip()
        prev = best.get(name)
        if prev is None or float(prev["confidence"]) < c:
            best[name] = {"name": name, "confidence": round(c, 4), "reason": reason}
    out = list(best.values())
    out.sort(key=lambda r: -float(r["confidence"]))
    return out


def _pad_suggestions_to_three(rows: list[dict[str, Any]], visual_fallback: str) -> list[dict[str, Any]]:
    merged = _dedupe_suggestions_keep_best_conf(rows)[:3]
    pad_reason = (visual_fallback or "").strip() or "—"
    blank = {"name": "غير متأكد", "confidence": 0.0, "reason": pad_reason}
    while len(merged) < 3:
        merged.append(dict(blank))
    return merged[:3]


def _finalize_result(
    *,
    visual_reason: str,
    vision_model: str,
    suggestion_rows: list[dict[str, Any]],
    detected_classes: list[str],
    top_dish_override: str | None = None,
    top_conf_override: float | None = None,
    experimental: bool | None = None,
) -> dict[str, Any]:
    vr = (visual_reason or "").strip() or "—"
    sugs = _pad_suggestions_to_three(suggestion_rows, vr)

    # Use explicit overrides when the caller has already resolved the top dish
    # (e.g. Gemini returned "غير متأكد" but suggestions are real dishes).
    if top_dish_override is not None:
        top_dish = top_dish_override
        raw_conf = max(0.0, min(1.0, float(top_conf_override or 0.0)))
    else:
        top = sugs[0]
        raw_conf = max(0.0, min(1.0, float(top["confidence"])))
        top_dish = _validate_dish_name(str(top["name"]))
        sugs[0]["name"] = top_dish

    protein_conflict = _protein_conflict_among_suggestions(sugs)
    needs_review = (raw_conf < REVIEW_CONFIDENCE_THRESHOLD) or protein_conflict or top_dish == "غير متأكد"

    reason_parts: list[str] = []
    if vr and vr != "—":
        reason_parts.append(vr)
    if top_dish == "غير متأكد":
        reason_parts.append("لم يتمكن الذكاء الاصطناعي من التعرف على الطبق بدقة — اختر من الاقتراحات أو أدخل الاسم يدوياً.")
    elif raw_conf < REVIEW_CONFIDENCE_THRESHOLD:
        reason_parts.append(
            f"ثقة الاقتراح الأول {raw_conf * 100:.1f}% أقل من 75% — يُنصَح بالمراجعة اليدوية."
        )
    if protein_conflict:
        reason_parts.append(
            "تعارض بين بروتينات مختلفة (مثل سمك مع لحم أو سمك مع دجاج) — يرجى الاختيار يدوياً."
        )
    reason_out = " ".join(reason_parts).strip() or vr

    names = [str(s["name"]) for s in sugs]
    exp = (vision_model == "none") if experimental is None else experimental
    return {
        "dish_name": top_dish,
        "dish_name_ar": top_dish,
        "confidence": round(raw_conf, 4),
        "suggestions": sugs,
        "labels": names,
        "detected_classes": detected_classes,
        "suggestion_reason": reason_out,
        "suggested_name": top_dish,
        "suggested_options": names,
        "experimental": exp,
        "protein_type": _protein_for_dish(top_dish),
        "visual_reason": reason_out,
        "needs_review": needs_review,
        "protein_conflict": protein_conflict,
        "vision_model": vision_model,
    }


def _llm_suggestion_rows(data: dict[str, Any], default_reason: str) -> list[dict[str, Any]]:
    """
    Extract suggestion rows from Gemini's JSON response.
    New format: dish_name + confidence at top level, suggestions array always 3 items.
    Falls back gracefully if suggestions array is missing or malformed.
    """
    top_dish = _validate_dish_name(str(data.get("dish_name", "")))
    top_conf = _normalize_confidence_ratio(data.get("confidence", 0.0))
    top_reason = str(data.get("visual_reason") or "").strip() or default_reason

    rows: list[dict[str, Any]] = []

    raw_s = data.get("suggestions")
    if isinstance(raw_s, list):
        for item in raw_s:
            if not isinstance(item, dict):
                continue
            nm = _validate_dish_name(str(item.get("name", item.get("dish_name", ""))))
            try:
                cf = float(item.get("confidence", 0.0))
            except (TypeError, ValueError):
                cf = 0.0
            rs = str(item.get("reason", "")).strip() or default_reason
            rows.append({"name": nm, "confidence": cf, "reason": rs})

    # Ensure dish_name is always represented (may already be suggestions[0])
    if not rows or rows[0]["name"] != top_dish:
        rows.insert(0, {"name": top_dish, "confidence": top_conf, "reason": top_reason})

    rows.sort(key=lambda r: -float(r["confidence"]))
    return rows[:5]


def _enforce_category_coherence(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Ensure all 3 suggestions are visually/category-similar to the top dish.
    Replaces out-of-category entries with known similar alternatives from DISH_SIMILAR.
    """
    if not rows:
        return rows

    top_name = rows[0]["name"]
    top_conf = float(rows[0]["confidence"])
    similar = DISH_SIMILAR.get(top_name, [])

    # Collect valid category-coherent names (top dish + its known similar dishes)
    valid_names: set[str] = {top_name}
    valid_names.update(similar)

    result: list[dict[str, Any]] = [rows[0]]  # Always keep the top suggestion
    seen: set[str] = {top_name}

    # Keep suggestions that are in the valid set
    for row in rows[1:]:
        if row["name"] in valid_names and row["name"] not in seen:
            result.append(row)
            seen.add(row["name"])

    # Fill remaining slots from DISH_SIMILAR alternatives
    conf_step = max(0.05, top_conf * 0.15)
    fill_conf = max(0.05, top_conf - conf_step)
    for alt in similar:
        if len(result) >= 3:
            break
        if alt not in seen:
            result.append({
                "name": alt,
                "confidence": round(fill_conf, 4),
                "reason": f"مشابه بصرياً وفئوياً لـ {top_name}",
            })
            seen.add(alt)
            fill_conf = max(0.03, fill_conf - conf_step)

    fallback = [d for d in ALLOWED_DISHES if d != "غير متأكد" and d not in seen]
    fi = 0
    while len(result) < 3:
        name = fallback[fi] if fi < len(fallback) else "رز"
        result.append({"name": name, "confidence": 0.0, "reason": "—"})
        seen.add(name)
        fi += 1

    return result[:3]


def _similarity_score(dish_a: str, dish_b: str) -> float:
    """
    Similarity score 0.0–1.0 between two dish names.

    Scoring tiers:
      1.0  — exact match
      0.9  — mutual entry in each other's DISH_SIMILAR
      0.7  — one-way entry in DISH_SIMILAR
      0–0.45 — keyword-overlap ratio (fallback)
    """
    if dish_a == dish_b:
        return 1.0

    sim_a = set(DISH_SIMILAR.get(dish_a, []))
    sim_b = set(DISH_SIMILAR.get(dish_b, []))

    if dish_b in sim_a and dish_a in sim_b:
        return 0.9
    if dish_b in sim_a or dish_a in sim_b:
        return 0.7

    kw_a = DISH_KEYWORDS.get(dish_a, frozenset())
    kw_b = DISH_KEYWORDS.get(dish_b, frozenset())
    if not kw_a or not kw_b:
        return 0.0

    overlap = len(kw_a & kw_b)
    denom = min(len(kw_a), len(kw_b))
    return round(min(0.45, (overlap / denom) * 0.6), 4)


def _rank_suggestions_by_similarity(
    top_dish: str,
    top_conf: float,
    top_reason: str,
    candidates: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    """
    Filter and re-rank Gemini suggestions by keyword + category similarity to top_dish.

    Returns (final_top_name, suggestions_list) where:
    - final_top_name  : the dish name to use as dish_name in the response
    - suggestions_list: exactly 3 real-dish suggestions, never "غير متأكد"

    When top_dish == "غير متأكد" the name is preserved as-is but suggestions
    are filled entirely from real alternatives so the user can pick one.
    """
    is_uncertain = top_dish == "غير متأكد"
    seen: set[str] = set()
    top_row: dict[str, Any] | None = None
    alternatives: list[tuple[float, dict[str, Any]]] = []

    for row in candidates:
        name = str(row.get("name", "")).strip()
        if not name or name in seen or name == "غير متأكد":
            continue
        seen.add(name)

        conf = _normalize_confidence_ratio(row.get("confidence", 0.0))
        ref = top_dish if not is_uncertain else None

        if name == top_dish:
            top_row = row
            continue

        # Similarity against the real top dish; if uncertain use all real dishes as candidates
        sim = _similarity_score(top_dish, name) if ref else 0.6
        if not is_uncertain and sim < _MIN_SUGGESTION_SIMILARITY:
            logger.debug("Dish rank: drop '%s' sim=%.2f", name, sim)
            continue

        final_score = sim * 0.6 + conf * 0.4
        alternatives.append((final_score, row))

    alternatives.sort(key=lambda x: -x[0])

    result: list[dict[str, Any]] = []

    if not is_uncertain:
        # Slot 0: always the detected dish
        if top_row is not None:
            result.append(top_row)
        else:
            result.append({"name": top_dish, "confidence": round(top_conf, 4), "reason": top_reason})

    # Slots 1–2 (or 0–2 when uncertain): best-scoring real alternatives
    for _, row in alternatives[: (3 if is_uncertain else 2)]:
        result.append(row)

    # Fill from DISH_SIMILAR when Gemini gave too few usable candidates
    fill_base = DISH_SIMILAR.get(top_dish, []) if not is_uncertain else DISH_SIMILAR.get("غير متأكد", [])
    if len(result) < (3 if is_uncertain else 3):
        fill_conf = max(0.05, top_conf * 0.25)
        conf_step = max(0.02, fill_conf * 0.35)
        existing = {r["name"] for r in result}
        for alt in fill_base:
            if len(result) >= 3:
                break
            if alt not in existing and alt != "غير متأكد":
                result.append({
                    "name": alt,
                    "confidence": round(fill_conf, 4),
                    "reason": f"قريب بصرياً وفئوياً من {top_dish}",
                })
                existing.add(alt)
                fill_conf = max(0.02, fill_conf - conf_step)

    # Final safety pad with plain-rice or first known dish
    fallback_names = [d for d in ALLOWED_DISHES if d != "غير متأكد"]
    fi = 0
    existing_names = {r["name"] for r in result}
    while len(result) < 3:
        while fi < len(fallback_names) and fallback_names[fi] in existing_names:
            fi += 1
        name = fallback_names[fi] if fi < len(fallback_names) else "رز"
        result.append({"name": name, "confidence": 0.0, "reason": "—"})
        existing_names.add(name)
        fi += 1

    logger.info(
        "Dish rank: top=%s suggestions=%s",
        top_dish,
        [(r["name"], round(float(r["confidence"]), 2)) for r in result[:3]],
    )
    return top_dish, result[:3]


# ── Gemini Vision classifier ───────────────────────────────────────────────────

# Minimum bytes for a real camera / upload photo in production mode.
_PRODUCTION_MIN_IMAGE_BYTES = 8_000


def _classify_gemini(image_bytes: bytes, production_mode: bool = False) -> dict[str, Any] | None:
    key = (settings.GEMINI_API_KEY or "").strip()
    if not key:
        logger.warning("Dish vision: GEMINI_API_KEY not set")
        return None

    try:
        from google import genai
        from google.genai import types as genai_types
        from PIL import Image
    except ImportError:
        logger.warning("Dish vision: google-genai or Pillow not installed")
        return None

    client = genai.Client(api_key=key)
    model_name = (settings.GEMINI_VISION_MODEL or "gemini-flash-lite-latest").strip()

    # Decode + re-encode as JPEG for reliable Gemini input
    img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img_pil.size
    buf = io.BytesIO()
    img_pil.save(buf, format="JPEG", quality=92)
    jpeg_bytes = buf.getvalue()
    img_part = genai_types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")

    logger.info(
        "Dish vision [%s]: model=%s image=%dx%d jpeg_bytes=%d",
        "PRODUCTION" if production_mode else "dev",
        model_name, w, h, len(jpeg_bytes),
    )

    allowed_list = "\n".join(f"- {d}" for d in ALLOWED_DISHES if d != "غير متأكد")

    prompt = f"""You are a professional restaurant food recognition AI. You identify dishes from ANY cuisine: Arabic, Gulf, Western, fast food, pizza, pasta, steak, burgers, seafood, desserts, etc.

TASK: Look at this food image carefully — color, texture, shape, cooking method, visible ingredients — and identify the dish.

OUTPUT FORMAT (JSON ONLY — no markdown, no text outside JSON):
{{
  "dish_name": "<Arabic name from the approved list>",
  "confidence": <0.0 to 1.0>,
  "visual_reason": "<one Arabic sentence describing exactly what you see>",
  "suggestions": [
    {{"name": "<must equal dish_name>", "confidence": <highest>, "reason": "<visual description in Arabic>"}},
    {{"name": "<realistic alternative from same food category>", "confidence": <lower>, "reason": "<reason in Arabic>"}},
    {{"name": "<realistic alternative from same food category>", "confidence": <lower>, "reason": "<reason in Arabic>"}}
  ]
}}

APPROVED DISH NAMES — use these exact Arabic names:
{allowed_list}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL RECOGNITION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BURGERS & SANDWICHES:
• برجر       — round beef patty in sesame bun with lettuce/tomato/sauce layers
• تشيز برجر  — same as برجر but with melted yellow/orange cheese clearly visible
• برجر دجاج  — fried or grilled chicken patty in bun (lighter color than beef)
• ساندويتش   — sliced-bread sandwich with filling (not burger-style bun)
→ If you see a burger: suggest تشيز برجر, برجر دجاج, ساندويتش — NEVER suggest rice or kabsa

PIZZA & PASTA:
• بيتزا    — round flat dough base with tomato sauce, melted cheese, toppings; cut in wedges
• مكرونة   — noodles/spaghetti/penne in sauce (tomato, cream, or white sauce)
→ If you see pizza: suggest مكرونة, ساندويتش, خبز — NEVER suggest rice dishes

STEAK & WESTERN MEAT:
• ستيك — thick grilled beef slab with grill marks, dark brown surface, served on plate
→ If you see steak: suggest كباب, لحم, مشويات

FAST FOOD SIDES:
• بطاطس مقلية — thin golden/yellow fried potato sticks, elongated strips

ARABIC GRILLED:
• كباب      — ground meat shaped on skewers, charcoal-grilled, long cylindrical shape, dark brown
• كفتة      — similar to كباب but thicker cylinders, may not have visible skewer
• مشويات    — ASSORTED PLATTER with multiple grilled types together (skewers + chicken + various meats)
• دجاج مشوي — half or quarter chicken with browned/charred grilled skin
• شاورما    — thinly sliced meat served in flatbread wrap or piled strips on a plate

ARABIC RICE (visually similar — differentiate carefully):
• كبسة دجاج/كبسة لحم — RED-ORANGE rice from spices, whole chicken or lamb pieces on top
• مندي       — GOLDEN/LIGHT BROWN rice, slow-cooked, full chicken or lamb on top, lighter color
• رز بخاري   — YELLOW/BROWN rice with shredded orange carrots visible, chicken on side
• برياني     — LAYERED rice with multiple colors (yellow+white+orange), dense Indian-style spices
• مقلوبة     — rice dish with visible vegetables (eggplant/potato) on TOP after flipping
• رز         — plain WHITE or beige rice with no distinctive toppings/color

ARABIC STUFFED:
• ورق عنب — small GREEN cylindrical rolls (2-4cm), arranged in rows, olive/dark green color
• محشي     — WHOLE stuffed vegetables clearly visible (zucchini/peppers/tomatoes)

SEAFOOD:
• سمك    — whole fish or fillet clearly recognizable as fish shape
• روبيان — pink/orange shrimp or prawns clearly visible

SOUPS, SALADS & SIDES:
• سلطة         — bowl of RAW mixed vegetables (lettuce, tomato, cucumber); no dominant protein
• شوربة         — liquid-based dish in a bowl (broth, soup, stew)
• خبز           — plain bread/flatbread/pita/naan as the main item
• حلويات        — dessert items: cake, ice cream, pastry, chocolate-based sweets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY COHERENCE RULES (STRICT — NEVER MIX CATEGORIES):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Burgers/sandwiches → suggest from: برجر، تشيز برجر، برجر دجاج، ساندويتش
Pizza/pasta/Italian → suggest from: بيتزا، مكرونة، ساندويتش
Steak/grilled meat → suggest from: ستيك، كباب، لحم، مشويات
Arabic grilled      → suggest from: كباب، كفتة، مشويات، دجاج مشوي، شاورما
Arabic rice         → suggest from: كبسة دجاج، كبسة لحم، مندي، رز بخاري، برياني، مقلوبة
Seafood             → suggest from: سمك، روبيان، مشويات
Stuffed             → suggest from: ورق عنب، محشي، مقلوبة
Desserts            → suggest from: حلويات، خبز، مكرونة

❌ FORBIDDEN CROSS-CATEGORY SUGGESTIONS:
- burger with rice/kabsa
- pizza with kabsa/mandi
- salad with grilled meat
- soup with burgers
- steak with rice dishes
- pasta with grape leaves

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0.85–1.0 → clear, unambiguous visual features, fully certain
0.65–0.84 → very likely but minor visual ambiguity exists
< 0.65   → use dish_name = "غير متأكد", give 3 real alternatives from closest visual category

ADDITIONAL PRODUCTION RULES:
- Do NOT return "خبز" for a burger bun — identify the burger type
- Do NOT return "لحم" for a steak — use "ستيك"
- Do NOT return "دجاج" for a chicken burger — use "برجر دجاج"
- Do NOT return "رز" if you see colored/spiced rice — identify the specific rice dish
- Do NOT return "مكرونة" for pizza or vice versa
- Confidence must decrease: suggestions[0] ≥ suggestions[1] ≥ suggestions[2]"""

    try:
        resp = client.models.generate_content(model=model_name, contents=[prompt, img_part])
    except Exception as exc:
        logger.warning("Dish vision: Gemini request failed: %s", exc)
        return None

    text = (getattr(resp, "text", None) or "").strip()
    logger.info("Dish vision: response_len=%d preview=%.200s", len(text), text)

    data = _parse_json_object(text)
    if not data:
        logger.warning("Dish vision: JSON parse failed. raw=%.400s", text)
        return None

    default_reason = str(data.get("visual_reason") or "").strip() or "تصنيف Gemini Vision"
    rows = _llm_suggestion_rows(data, default_reason)

    top_dish = rows[0]["name"] if rows else "غير متأكد"
    top_conf = _normalize_confidence_ratio(rows[0]["confidence"] if rows else 0.0)
    top_reason = (rows[0]["reason"] if rows else default_reason) or default_reason

    final_top, ranked_rows = _rank_suggestions_by_similarity(top_dish, top_conf, top_reason, rows)

    logger.info(
        "Dish vision: RESULT dish=%s confidence=%.3f needs_review=%s suggestions=%s",
        final_top,
        top_conf,
        top_conf < REVIEW_CONFIDENCE_THRESHOLD or final_top == "غير متأكد",
        [(r["name"], round(float(r["confidence"]), 2)) for r in ranked_rows],
    )

    return _finalize_result(
        visual_reason=default_reason,
        vision_model="gemini",
        suggestion_rows=ranked_rows,
        detected_classes=[final_top, f"gemini_conf={top_conf:.3f}", f"model={model_name}"],
        top_dish_override=final_top,
        top_conf_override=top_conf,
    )


# ── Public entry point ────────────────────────────────────────────────────────

_FALLBACK_SUGGESTIONS = [
    {"name": "دجاج مشوي", "confidence": 0.0, "reason": "—"},
    {"name": "برجر",       "confidence": 0.0, "reason": "—"},
    {"name": "مشويات",     "confidence": 0.0, "reason": "—"},
]


def classify_dish_image(image_bytes: bytes) -> dict[str, Any]:
    """
    Classify a dish image using Gemini Vision.
    When PRODUCTION_AI_MODE=true: rejects images that are too small to be real photos,
    logs full details, and never auto-approves low-confidence results.
    """
    production_mode: bool = settings.PRODUCTION_AI_MODE

    if not image_bytes:
        logger.error("classify_dish_image: empty image bytes")
        return _finalize_result(
            visual_reason="لم يُرسل محتوى صورة صالح.",
            vision_model="none",
            suggestion_rows=list(_FALLBACK_SUGGESTIONS),
            detected_classes=[],
            top_dish_override="غير متأكد",
            top_conf_override=0.0,
            experimental=True,
        )

    gemini_key_set = bool((settings.GEMINI_API_KEY or "").strip())

    # Production mode: reject images that are clearly not real photos (too small).
    if production_mode and len(image_bytes) < _PRODUCTION_MIN_IMAGE_BYTES:
        logger.warning(
            "PRODUCTION_AI_MODE: image too small (%d bytes < %d) — likely not a real camera photo",
            len(image_bytes), _PRODUCTION_MIN_IMAGE_BYTES,
        )
        return _finalize_result(
            visual_reason="الصورة صغيرة جداً — يرجى رفع صورة حقيقية من كاميرا أو هاتف.",
            vision_model="none",
            suggestion_rows=list(_FALLBACK_SUGGESTIONS),
            detected_classes=["rejected:too_small"],
            top_dish_override="غير متأكد",
            top_conf_override=0.0,
            experimental=False,
        )

    logger.info(
        "classify_dish_image [mode=%s]: gemini_key=%s bytes=%d",
        "PRODUCTION" if production_mode else "dev",
        gemini_key_set,
        len(image_bytes),
    )

    if not gemini_key_set:
        logger.error("classify_dish_image: GEMINI_API_KEY is not configured")
        return _finalize_result(
            visual_reason="مفتاح Gemini API غير مُعيَّن — تحقق من backend/.env.",
            vision_model="none",
            suggestion_rows=list(_FALLBACK_SUGGESTIONS),
            detected_classes=[],
            top_dish_override="غير متأكد",
            top_conf_override=0.0,
            experimental=True,
        )

    try:
        out = _classify_gemini(image_bytes, production_mode=production_mode)
    except Exception as exc:
        logger.error("classify_dish_image: unhandled exception: %s", exc, exc_info=True)
        out = None

    if out and str(out.get("vision_model") or "") not in ("", "none"):
        dish = out.get("dish_name")
        conf = out.get("confidence")
        nr   = out.get("needs_review")
        logger.info(
            "classify_dish_image: SUCCESS dish=%s confidence=%s needs_review=%s",
            dish, conf, nr,
        )
        if production_mode and nr:
            logger.info(
                "PRODUCTION_AI_MODE: needs_review=True — dish=%s conf=%s — do NOT auto-approve",
                dish, conf,
            )
        return out

    logger.error("classify_dish_image: Gemini failed or returned no result")
    return _finalize_result(
        visual_reason="تعذر تشغيل Gemini Vision — تحقق من مفتاح API والاتصال بالإنترنت.",
        vision_model="none",
        suggestion_rows=list(_FALLBACK_SUGGESTIONS),
        detected_classes=[],
        top_dish_override="غير متأكد",
        top_conf_override=0.0,
        experimental=True,
    )
