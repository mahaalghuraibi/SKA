"""
Image-only dish classification for SKA using Gemini Vision.
Pipeline: Gemini Vision only — no Roboflow, no OpenAI, no local models.
"""

from __future__ import annotations

import io
import json
import logging
import re
import time
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
    "سمبوسة",
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

# Flag needs_review when top-suggestion confidence is below this threshold (~45%).
REVIEW_CONFIDENCE_THRESHOLD = 0.45
# When the model names a dish but omits confidence / sends 0, avoid misleading 0%.
MIN_MEANINGFUL_CONFIDENCE = 0.14
JPEG_QUALITY_DISH = 94
MAX_IMAGE_EDGE_DISH = 2048
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
    "سمبوسة":        ["ساندويتش", "بطاطس مقلية", "مكرونة"],
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
    "سمبوسة": frozenset({
        "سمبوسة", "سمبوسك", "ساموسا", "معجنات",
        "samosa", "sambusa", "sambosak", "fried pastry", "triangular",
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
_MIN_ALT1_CONF = 0.18
_MIN_ALT2_CONF = 0.12


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


def _strong_alt_confidences(top: float, c1_raw: float, c2_raw: float) -> tuple[float, float]:
    """
    Return stronger, descending alt confidences based on top confidence level.
    Keeps suggestions 2/3 meaningful (not near-zero) while remaining realistic.
    """
    top = max(0.22, min(1.0, float(top)))
    c1 = max(0.0, min(1.0, float(c1_raw)))
    c2 = max(0.0, min(1.0, float(c2_raw)))

    if top >= 0.85:
        floor1, floor2 = 0.58, 0.46
    elif top >= 0.70:
        floor1, floor2 = 0.48, 0.36
    elif top >= 0.55:
        floor1, floor2 = 0.36, 0.26
    else:
        floor1, floor2 = 0.24, 0.16

    c1_max = max(0.0, top - 0.05)
    c1 = max(floor1, min(c1_max, c1 if c1 > 0 else top * 0.72))

    c2_max = max(0.0, c1 - 0.05)
    c2 = max(floor2, min(c2_max, c2 if c2 > 0 else top * 0.56))

    # Keep strict descending order.
    if c2 >= c1:
        c2 = max(floor2, c1 - 0.06)
    return round(c1, 4), round(c2, 4)


def _confidence_with_floor(dish_name: str, value: object) -> float:
    """Avoid reporting 0.0 when the model named a concrete dish but omitted confidence."""
    c = _normalize_confidence_ratio(value)
    name = (dish_name or "").strip()
    if name and name != "غير متأكد" and c <= 0.0:
        return MIN_MEANINGFUL_CONFIDENCE
    return c


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
    # Samosa / savory pastries (before generic sandwich)
    if any(k in t for k in ("سمبوسة", "سمبوسك", "samosa", "sambusa", "sambosak")):
        return "سمبوسة"
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
    if dish_ar in {"مكرونة", "سلطة", "شوربة", "رز", "خبز", "بيتزا", "ساندويتش", "سمبوسة", "بطاطس مقلية", "حلويات", "غير متأكد"}:
        return "none"
    return "unknown"


def _parse_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    t = text.strip().replace("\ufeff", "")
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t, re.IGNORECASE)
    if fence:
        t = fence.group(1).strip()
    try:
        obj = json.loads(t)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", t):
        fragment = t[match.start() :]
        try:
            obj, _end = decoder.raw_decode(fragment)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue
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
    llm_review = bool(result.pop("_llm_needs_review", False))
    sugs = result.get("suggestions")
    if not isinstance(sugs, list):
        result["protein_conflict"] = False
        result["needs_review"] = (
            llm_review or float(result.get("confidence") or 0) < REVIEW_CONFIDENCE_THRESHOLD
        )
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
    result["needs_review"] = (
        llm_review or (top_conf < REVIEW_CONFIDENCE_THRESHOLD) or conflict
    )
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
            f"ثقة الاقتراح الأول {raw_conf * 100:.1f}% أقل من {REVIEW_CONFIDENCE_THRESHOLD * 100:.0f}% — يُنصَح بالمراجعة اليدوية."
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
    Extract suggestion rows from Gemini JSON.
    Supports:
      - New: dish_name, confidence (0–100), category, suggestions: ["...","..."], needs_review, visual_evidence
      - Legacy: suggestions as objects with name, confidence, reason
    """
    category = str(data.get("category") or "").strip()
    visual_ev = str(data.get("visual_evidence") or data.get("visual_reason") or "").strip()
    if visual_ev and category:
        default_reason = f"{visual_ev} — التصنيف: {category}"
    elif category:
        default_reason = f"{category}. {visual_ev}".strip() if visual_ev else category
    elif visual_ev:
        default_reason = visual_ev
    default_reason = default_reason.strip() or "تحليل بصري عبر Gemini Vision"

    raw_top = str(data.get("dish_name", "")).strip()
    top_dish = _validate_dish_name(raw_top)
    top_conf = _confidence_with_floor(top_dish, data.get("confidence", 0.0))
    top_reason = default_reason

    rows: list[dict[str, Any]] = []
    raw_s = data.get("suggestions")

    if isinstance(raw_s, list):
        for item in raw_s:
            if isinstance(item, str):
                nm = _validate_dish_name(item)
                if not nm:
                    continue
                rows.append({"name": nm, "confidence": 0.0, "reason": top_reason})
            elif isinstance(item, dict):
                nm = _validate_dish_name(str(item.get("name", item.get("dish_name", ""))))
                if not nm:
                    continue
                cf = _confidence_with_floor(nm, item.get("confidence", 0.0))
                rs = str(item.get("reason", "")).strip() or top_reason
                rows.append({"name": nm, "confidence": cf, "reason": rs})

    rows = _dedupe_suggestions_keep_best_conf(rows)

    # String-only suggestions: assign descending confidences from model top_conf
    if rows and all(float(r.get("confidence") or 0) <= 0.0 for r in rows) and top_conf > 0:
        for i, r in enumerate(rows[:5]):
            factor = max(0.28, 1.0 - i * 0.12)
            r["confidence"] = round(max(0.05, top_conf * factor), 4)

    if not rows:
        rows = [{"name": top_dish, "confidence": top_conf, "reason": top_reason}]
    elif rows[0]["name"] != top_dish and top_dish != "غير متأكد":
        rows.insert(0, {"name": top_dish, "confidence": top_conf, "reason": top_reason})
    elif rows[0]["name"] != top_dish and top_dish == "غير متأكد":
        # Promote best real guess when the model was uncertain
        real = [r for r in rows if r["name"] != "غير متأكد"]
        if real:
            top_dish = real[0]["name"]
            top_conf = _confidence_with_floor(
                top_dish,
                real[0].get("confidence", 0.0) or (top_conf if top_conf > 0 else MIN_MEANINGFUL_CONFIDENCE),
            )
            top_reason = str(real[0].get("reason") or top_reason)
            rows = [{**real[0], "name": top_dish, "confidence": top_conf}] + [
                r for r in rows if r["name"] not in {top_dish, "غير متأكد"}
            ]

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

    # If category list is not enough, fill from globally nearest dishes (still visually close).
    fallback = sorted(
        [d for d in ALLOWED_DISHES if d != "غير متأكد" and d not in seen],
        key=lambda d: -_similarity_score(top_name, d),
    )
    fi = 0
    while len(result) < 3:
        name = fallback[fi] if fi < len(fallback) else "رز"
        conf = max(_MIN_ALT2_CONF, min(max(0.2, top_conf * 0.45), max(0.03, top_conf - 0.15)))
        result.append({"name": name, "confidence": round(conf, 4), "reason": f"الأقرب بصرياً إلى {top_name}"})
        seen.add(name)
        fi += 1

    # Guarantee exactly 3 strong descending suggestions.
    top = float(result[0].get("confidence") or top_conf or 0.0)
    top = max(0.22, min(1.0, top))
    if len(result) >= 3:
        c1, c2 = _strong_alt_confidences(
            top,
            float(result[1].get("confidence") or 0.0),
            float(result[2].get("confidence") or 0.0),
        )
        result[1]["confidence"] = c1
        result[2]["confidence"] = c2

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

    # Final safety pad with nearest known dishes (not random global order).
    fallback_names = sorted(
        [d for d in ALLOWED_DISHES if d != "غير متأكد"],
        key=lambda d: -_similarity_score(top_dish if top_dish != "غير متأكد" else "برجر", d),
    )
    fi = 0
    existing_names = {r["name"] for r in result}
    while len(result) < 3:
        while fi < len(fallback_names) and fallback_names[fi] in existing_names:
            fi += 1
        name = fallback_names[fi] if fi < len(fallback_names) else "رز"
        seed = max(_MIN_ALT2_CONF, min(max(0.18, top_conf * 0.5), max(0.05, top_conf - 0.2)))
        result.append({"name": name, "confidence": round(seed, 4), "reason": f"بديل قريب من {top_dish}"})
        existing_names.add(name)
        fi += 1

    # Keep exactly 3 strong descending confidences.
    top = max(0.22, min(1.0, float(result[0].get("confidence") or top_conf or 0.0)))
    result[0]["confidence"] = round(top, 4)
    if len(result) > 2:
        c1, c2 = _strong_alt_confidences(
            top,
            float(result[1].get("confidence") or 0.0),
            float(result[2].get("confidence") or 0.0),
        )
        result[1]["confidence"] = c1
        result[2]["confidence"] = c2

    logger.info(
        "Dish rank: top=%s suggestions=%s",
        top_dish,
        [(r["name"], round(float(r["confidence"]), 2)) for r in result[:3]],
    )
    return top_dish, result[:3]


# ── Gemini Vision classifier ───────────────────────────────────────────────────

# Minimum bytes for a real camera / upload photo in production mode.
_PRODUCTION_MIN_IMAGE_BYTES = 8_000


def _dish_gemini_model_candidates() -> list[str]:
    """Configured model first, then supported fallbacks (2.5 before 2.0; no deprecated 1.5 variants)."""
    configured = (settings.DISH_GEMINI_MODEL or settings.GEMINI_VISION_MODEL or "").strip()
    # Only models confirmed available on the current v1beta / v1 API endpoint.
    # gemini-1.5-* have been retired from this endpoint — do not add them back.
    fallbacks = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    ]
    out: list[str] = []
    for m in ([configured] if configured else []) + fallbacks:
        if m and m not in out:
            out.append(m)
    return out or ["gemini-2.5-flash", "gemini-2.0-flash"]


def _prepare_dish_image_for_gemini(image_bytes: bytes) -> tuple[bytes, int, int]:
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    max_edge = MAX_IMAGE_EDGE_DISH
    if max(w, h) > max_edge:
        scale = max_edge / float(max(w, h))
        nw = max(1, int(round(w * scale)))
        nh = max(1, int(round(h * scale)))
        img = img.resize((nw, nh), Image.Resampling.LANCZOS)
        w, h = nw, nh
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY_DISH, optimize=True)
    return buf.getvalue(), w, h


def _extract_gemini_response_text(resp: Any) -> str:
    text = (getattr(resp, "text", None) or "").strip()
    if text:
        return text
    candidates = getattr(resp, "candidates", None) or []
    if candidates:
        content = getattr(candidates[0], "content", None)
        parts = getattr(content, "parts", None) or [] if content else []
        return "".join(getattr(p, "text", None) or "" for p in parts).strip()
    return ""


def _gemini_error_kind(exc: Exception | None) -> str | None:
    """Classify Gemini client errors for clearer operator messaging."""
    if exc is None:
        return None
    text = f"{exc} {getattr(exc, 'message', '')}".lower()
    if any(
        s in text
        for s in (
            "api key not valid",
            "invalid api key",
            "api_key_invalid",
            "incorrect api key",
            "permission_denied",
            "leaked api key",
        )
    ):
        return "invalid_key"
    if any(s in text for s in ("resource_exhausted", "quota exceeded", "quota", "billing")):
        return "quota"
    return None


_DISH_VISION_MSG_INVALID_KEY = (
    "مفتاح Google Gemini غير صالح أو مرفوض. افتح ملف backend/.env وضع مفتاحاً صحيحاً في "
    "GEMINI_API_KEY أو DISH_GEMINI_API_KEY (من https://aistudio.google.com/apikey — بلا مسافات قبل/بعد المفتاح). "
    "أعد تشغيل الخادم بعد الحفظ."
)
_DISH_VISION_MSG_QUOTA = (
    "حصّة Gemini نفدت أو يجب تفعيل الفوترة في حساب Google AI. راجع console.cloud.google.com ثم أعد المحاولة."
)


def _dish_vision_service_failure(kind: str) -> dict[str, Any]:
    msg = _DISH_VISION_MSG_INVALID_KEY if kind == "invalid_key" else _DISH_VISION_MSG_QUOTA
    return _finalize_result(
        visual_reason=msg,
        vision_model="none",
        suggestion_rows=list(_FALLBACK_SUGGESTIONS),
        detected_classes=[f"error:{kind}"],
        top_dish_override="غير متأكد",
        top_conf_override=0.0,
        experimental=True,
    )


def _fallback_via_roboflow(image_bytes: bytes, failure_reason: str) -> dict[str, Any] | None:
    """
    Use existing Roboflow pipeline as a resilient fallback when Gemini is unavailable.
    Keeps /detect-dish contract unchanged.
    """
    try:
        from app.services.vision_service import detect_dish as detect_dish_roboflow
    except Exception as exc:
        logger.warning("Dish vision fallback: vision_service import failed: %s", exc)
        return None

    try:
        rf = detect_dish_roboflow(image_bytes=image_bytes, filename="")
    except Exception as exc:
        logger.warning("Dish vision fallback: roboflow detect failed: %s", exc)
        return None

    top_name = _validate_dish_name(str(rf.get("dish_name") or rf.get("suggested_name") or "غير متأكد"))
    raw_conf = _confidence_with_floor(top_name, rf.get("confidence", 0.0))

    # Start from Roboflow hints, then force close-category ranking using same production logic.
    suggested = rf.get("suggested_options")
    labels = suggested if isinstance(suggested, list) else []
    candidates: list[dict[str, Any]] = []
    for idx, item in enumerate(labels[:5]):
        name = _validate_dish_name(str(item))
        if not name:
            continue
        factor = max(0.30, 1.0 - idx * 0.14)
        candidates.append(
            {
                "name": name,
                "confidence": round(max(0.04, raw_conf * factor), 4),
                "reason": "Fallback عبر Roboflow Vision",
            }
        )
    # Always include the detected top dish as anchor for similarity ranking.
    candidates.insert(
        0,
        {
            "name": top_name,
            "confidence": raw_conf,
            "reason": "Fallback عبر Roboflow Vision",
        },
    )
    candidates = _dedupe_suggestions_keep_best_conf(candidates)

    final_top, rows = _rank_suggestions_by_similarity(
        top_name,
        raw_conf,
        "Fallback عبر Roboflow Vision",
        candidates,
    )
    # Hard guarantee: enforce same-category coherence in fallback path as well.
    rows = _enforce_category_coherence(rows)
    if rows:
        final_top = rows[0]["name"]

    out = _finalize_result(
        visual_reason=f"{failure_reason} تم التبديل تلقائيًا إلى Roboflow كخطة بديلة.",
        vision_model="roboflow_fallback",
        suggestion_rows=rows,
        detected_classes=[str(x) for x in (rf.get("detected_classes") or [])][:8],
        top_dish_override=final_top,
        top_conf_override=raw_conf,
        experimental=bool(rf.get("experimental", True)),
    )
    out["needs_review"] = bool(out.get("needs_review")) or raw_conf < REVIEW_CONFIDENCE_THRESHOLD
    logger.info(
        "Dish vision fallback: provider=roboflow dish=%s confidence=%.3f needs_review=%s",
        out.get("dish_name"),
        float(out.get("confidence") or 0.0),
        out.get("needs_review"),
    )
    return out


def _classify_gemini(image_bytes: bytes, production_mode: bool = False) -> dict[str, Any] | None:
    key = (settings.DISH_GEMINI_API_KEY or settings.GEMINI_API_KEY or "").strip()
    if not key:
        logger.warning("Dish vision: DISH_GEMINI_API_KEY not set")
        return None

    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError:
        logger.warning("Dish vision: google-genai not installed")
        genai = None  # type: ignore[assignment]
        genai_types = None  # type: ignore[assignment]

    try:
        jpeg_bytes, w, h = _prepare_dish_image_for_gemini(image_bytes)
    except Exception as exc:
        logger.warning("Dish vision: image decode failed: %s", exc)
        return None

    allowed_list = "\n".join(f"- {d}" for d in ALLOWED_DISHES if d != "غير متأكد")
    prompt = f"""أنت محلل رؤية مطاعم متخصص: مهمتك قراءة صورة طعام حقيقية واختيار أفضل تطابق من القائمة المعتمدة.

مهم جداً:
- راجع الصورة المرفقة (إدخال بصري)؛ يجب أن تستند إجابتك فقط على ما يظهر فيها.
- أخرِج كائناً JSON واحداً فقط، بدون markdown وبدون أي نص خارج الأقواس.
- جميع قيم النصوص بالعربية (أو أسماء الأطباق كما في القائمة حرفياً).

شكل الإخراج الإلزامي:
{{
  "dish_name": "<اسم من القائمة المعتمدة — أفضل تخمين عند الغموض>",
  "confidence": <عدد صحيح من 0 إلى 100 يعكس وضوح الأدلة البصرية، ليس دائماً 0 أو 100>,
  "category": "<فئة قصيرة بالعربية، مثل: فاست فود، مشويات، أرز ومندي، حلويات>",
  "suggestions": ["نفس dish_name حرفياً", "بديل 2 من نفس العائلة البصرية", "بديل 3"],
  "needs_review": <true أو false — true عند ثقة أقل من 45 أو صورة ضعيفة أو اختلاط أطباق>,
  "visual_evidence": "<جملة واحدة تصف اللون/الشكل/المكونات الظاهرة>"
}}

القائمة المعتمدة (استخدم هذه الحروف كما هي):
{allowed_list}

إرشادات تمييز سريعة:
• بيتزا: قرص عجين مستدير بصلصة وجبن وطبقات؛ لا تخلطها مع مكرونة.
• برجر/تشيز برجر/برجر دجاج: خبز برجر وطبقة لحم أو دجاج؛ لا تسمِ «خبز» فقط.
• مكرونة/باستا: قطع معكرونة مع صلصة؛ ليست بيتزا.
• سمبوسة/ساموسا: معجنات مثلثة غالباً مقلية بحشوة.
• ورق عنب: لفائف صغيرة خضراء.
• أطباق أرز: تمييز كبسة حمراء، مندي أفتح، برياني طبقات، رز أبيض سادة.

قواعد الثقة (0–100):
• 85–100: أدلة بصرية واضحة جداً
• 60–84: مرجح بقوة مع غموض طفيف
• 45–59: مرجح لكن يحتاج مراجعة (needs_review=true)
• أقل من 45: اختر الأقرب من القائمة مع needs_review=true؛ لا تستخدم 0 كثقة إذا اخترت اسماً حقيقياً — عبّر عن الغموض بقيمة 25–44.

قواعد الاقتراحات:
- suggestions ثلاثة عناصر مميزة من القائمة، والأول يساوي dish_name تماماً.
- لا تخلط فئات لا علاقة لها ببعض (مثلاً برجر مع كبسة).

أعد JSON فقط."""

    model_candidates = _dish_gemini_model_candidates()
    logger.info(
        "Dish vision [%s]: models_to_try=%s jpeg_out=%dx%d jpeg_bytes=%d quality=%d max_edge=%d",
        "PRODUCTION" if production_mode else "dev",
        model_candidates,
        w,
        h,
        len(jpeg_bytes),
        JPEG_QUALITY_DISH,
        MAX_IMAGE_EDGE_DISH,
    )

    t0 = time.perf_counter()
    resp_text = ""
    used_model = ""
    last_err: Exception | None = None

    if genai is not None and genai_types is not None:
        # 15-second per-model timeout; no SDK-level retry (rely on model cascade instead).
        _http_opts = genai_types.HttpOptions(timeout=15_000, retry_options=None)
        client = genai.Client(api_key=key, http_options=_http_opts)
        try:
            safety_off = [
                genai_types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                genai_types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                genai_types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                genai_types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
            ]
            gen_config = genai_types.GenerateContentConfig(safety_settings=safety_off)
        except Exception:
            gen_config = None

        for model_name in model_candidates:
            try:
                img_part = genai_types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")
                if gen_config is not None:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=[prompt, img_part],
                        config=gen_config,
                    )
                else:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=[prompt, img_part],
                    )
                resp_text = _extract_gemini_response_text(resp)
                used_model = model_name
                if resp_text:
                    last_err = None
                    logger.info("Dish vision: model=%s responded OK", model_name)
                    break
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "Dish vision: gemini (google-genai) failed model=%s: %s — %s",
                    model_name,
                    type(exc).__name__,
                    exc,
                )
                if _gemini_error_kind(exc) == "invalid_key":
                    # Invalid/leaked key won't recover by trying other models.
                    break
                continue

    if not resp_text:
        try:
            import google.generativeai as legacy_genai
            from PIL import Image

            legacy_genai.configure(api_key=key)
            pil_image = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB")
            safety_settings = [
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            ]
            for model_name in model_candidates:
                try:
                    model = legacy_genai.GenerativeModel(model_name=model_name, safety_settings=safety_settings)
                    resp = model.generate_content([prompt, pil_image])
                    used_model = model_name
                    resp_text = str(getattr(resp, "text", "") or "").strip()
                    if resp_text:
                        last_err = None
                        break
                except Exception as exc:
                    last_err = exc
                    logger.warning(
                        "Dish vision: gemini (legacy) failed model=%s: %s — %s",
                        model_name,
                        type(exc).__name__,
                        exc,
                    )
                    if _gemini_error_kind(exc) == "invalid_key":
                        break
                    continue
        except ImportError:
            pass

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    if not resp_text:
        kind = _gemini_error_kind(last_err)
        if kind:
            logger.error("Dish vision: Gemini request blocked kind=%s err=%s", kind, last_err)
            reason = _DISH_VISION_MSG_INVALID_KEY if kind == "invalid_key" else _DISH_VISION_MSG_QUOTA
            fb = _fallback_via_roboflow(image_bytes, reason)
            if fb is not None:
                return fb
            return _dish_vision_service_failure(kind)
        fb = _fallback_via_roboflow(
            image_bytes,
            "تعذر الحصول على استجابة من Gemini.",
        )
        if fb is not None:
            return fb
        logger.error(
            "Dish vision: no model response after tries=%d last_err=%s latency_ms=%.1f",
            len(model_candidates),
            type(last_err).__name__ if last_err else "none",
            elapsed_ms,
        )
        return None

    logger.info(
        "Dish vision: SUCCESS model=%s latency_ms=%.1f response_chars=%d",
        used_model,
        elapsed_ms,
        len(resp_text),
    )
    logger.debug("Dish vision: raw_response=%s", resp_text)

    data = _parse_json_object(resp_text)
    if not data:
        logger.warning("Dish vision: JSON parse failed. raw=%.800s", resp_text)
        return None

    default_reason = (
        str(data.get("visual_evidence") or data.get("visual_reason") or "").strip()
        or "تصنيف Gemini Vision"
    )
    rows = _llm_suggestion_rows(data, default_reason)

    top_dish = rows[0]["name"] if rows else "غير متأكد"
    top_conf = _confidence_with_floor(top_dish, rows[0]["confidence"] if rows else 0.0)
    top_reason = (rows[0]["reason"] if rows else default_reason) or default_reason

    final_top, ranked_rows = _rank_suggestions_by_similarity(top_dish, top_conf, top_reason, rows)

    if final_top == "غير متأكد" and ranked_rows:
        guess = str(ranked_rows[0].get("name", "")).strip()
        if guess and guess != "غير متأكد":
            final_top = guess
            top_conf = _confidence_with_floor(final_top, ranked_rows[0].get("confidence", top_conf))

    logger.info(
        "Dish vision: parsed dish=%s conf=%.4f llm_needs_review=%s ranked=%s",
        final_top,
        top_conf,
        data.get("needs_review"),
        [(r["name"], round(float(r["confidence"]), 4)) for r in ranked_rows],
    )

    out = _finalize_result(
        visual_reason=default_reason,
        vision_model="gemini",
        suggestion_rows=ranked_rows,
        detected_classes=[final_top, f"gemini_conf={top_conf:.3f}", f"model={used_model}"],
        top_dish_override=final_top,
        top_conf_override=top_conf,
    )
    if isinstance(data.get("needs_review"), bool) and data.get("needs_review"):
        out["_llm_needs_review"] = True
    logger.info(
        "Dish vision: RESULT model=%s dish=%s confidence=%.0f%% needs_review=%s latency_ms=%.0f",
        used_model,
        final_top,
        top_conf * 100,
        out.get("needs_review"),
        elapsed_ms,
    )
    return out


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

    gemini_key_set = bool((settings.DISH_GEMINI_API_KEY or settings.GEMINI_API_KEY or "").strip())

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
        logger.error("classify_dish_image: DISH_GEMINI_API_KEY is not configured")
        return _finalize_result(
            visual_reason="مفتاح Gemini API الخاص بتعرف الأطباق غير مُعيَّن — تحقق من backend/.env.",
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

    if out is not None:
        if str(out.get("vision_model") or "") == "gemini":
            dish = out.get("dish_name")
            conf = out.get("confidence")
            nr = out.get("needs_review")
            logger.info(
                "classify_dish_image: SUCCESS dish=%s confidence=%s needs_review=%s",
                dish,
                conf,
                nr,
            )
            if production_mode and nr:
                logger.info(
                    "PRODUCTION_AI_MODE: needs_review=True — dish=%s conf=%s — do NOT auto-approve",
                    dish,
                    conf,
                )
        else:
            logger.warning(
                "classify_dish_image: vision unavailable — %s",
                str(out.get("visual_reason") or "")[:400],
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
