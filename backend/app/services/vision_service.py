import base64
import logging
import os
import tempfile

import requests
import numpy as np
import cv2

from app.core.config import settings

try:
    from inference_sdk import InferenceHTTPClient
except ModuleNotFoundError:  # Python 3.14 currently unsupported by inference-sdk.
    InferenceHTTPClient = None

logger = logging.getLogger(__name__)

_CLASS_SYNONYMS = {
    "rice": ["rice", "arroz", "رز", "basmati"],
    "chicken": ["chicken", "pollo", "دجاج"],
    "meat": ["meat", "beef", "lamb", "carne", "لحم"],
    "mandi": ["mandi", "مندي"],
    "kabsa": ["kabsa", "kabsa", "كبسة"],
    "biryani": ["biryani", "برياني"],
    "machboos": ["machboos", "majboos", "مجبوس", "machbous"],
    "grilled_chicken": ["grilled chicken", "مشوي", "broast", "roasted chicken"],
    "sauce": ["sauce", "gravy", "صلصة"],
    "salad": ["salad", "سلطة"],
    "bread": ["bread", "naan", "khubz", "خبز"],
    "soup": ["soup", "شوربة"],
    "fish": ["fish", "pescado", "سمك"],
    "shrimp": ["shrimp", "prawn", "ربيان", "جمبري"],
    "pasta": ["pasta", "macaroni", "مكرونة"],
    "tomato": ["tomato", "طماطم"],
    "cucumber": ["cucumber", "خيار"],
    "lettuce": ["lettuce", "خس"],
    "kebab": ["kebab", "kabab", "kofta", "كباب", "كفتة", "مشاوي"],
    "stew": ["stew", "curry", "salona", "edam", "idam", "إيدام", "مرق"],
}

_DIRECT_DISH_KEYWORDS = {
    "كبسة دجاج": ["kabsa chicken", "chicken kabsa", "كبسة دجاج"],
    "كبسة لحم": ["kabsa meat", "meat kabsa", "kabsa lamb", "كبسة لحم"],
    "مندي": ["mandi", "مندي"],
    "برياني": ["biryani", "برياني"],
    "دجاج مشوي": ["grilled chicken", "roasted chicken", "مشوي", "دجاج مشوي"],
    "رز": ["rice", "arroz", "رز"],
    "سلطة": ["salad", "سلطة", "tomato", "cucumber", "lettuce", "طماطم", "خيار", "خس"],
    "شوربة": ["soup", "شوربة"],
    "خبز": ["bread", "naan", "خبز"],
    "مكرونة": ["pasta", "macaroni", "مكرونة"],
    "سمك": ["fish", "pescado", "سمك"],
    "كباب": ["kebab", "kabab", "kofta", "كباب", "كفتة", "مشاوي"],
    "إيدام": ["stew", "curry", "salona", "edam", "idam", "إيدام", "مرق"],
    "لحم": ["meat", "carne", "lamb", "beef", "لحم"],
    "دجاج": ["chicken", "pollo", "دجاج"],
}


def _map_label_to_arabic(label: str) -> str | None:
    lowered = label.lower().strip()
    token_to_ar = {
        "rice": "رز",
        "chicken": "دجاج",
        "meat": "لحم",
        "mandi": "مندي",
        "kabsa": "كبسة",
        "biryani": "برياني",
        "machboos": "مجبوس",
        "grilled_chicken": "دجاج مشوي",
        "sauce": "صلصة",
        "salad": "سلطة",
        "bread": "خبز",
        "soup": "شوربة",
        "fish": "سمك",
        "shrimp": "ربيان",
        "pasta": "مكرونة",
        "tomato": "طماطم",
        "cucumber": "خيار",
        "lettuce": "خس",
        "kebab": "كباب",
        "stew": "إيدام",
    }
    for token, terms in _CLASS_SYNONYMS.items():
        if any(term in lowered for term in terms):
            return token_to_ar.get(token)
    return None


def _normalize_text_tokens(text: str) -> str:
    return (text or "").lower().replace("-", " ").replace("_", " ").strip()


def _humanize_label(label: str) -> str:
    mapped = _map_label_to_arabic(label)
    if mapped:
        return mapped
    return "طبق غير محدد"


def _visual_scan_metrics(image_bytes: bytes) -> dict[str, object] | None:
    """
    Raw ROI stats + optional hint. Used for fish/kebab disambiguation (skewer plates vs model pescado).
    """
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        h0, w0 = img.shape[:2]
        y1, y2 = int(h0 * 0.2), int(h0 * 0.85)
        x1, x2 = int(w0 * 0.15), int(w0 * 0.85)
        roi = img[y1:y2, x1:x2] if y2 > y1 and x2 > x1 else img

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        total = float(h.size) if h.size else 1.0

        green_mask = (h >= 35) & (h <= 95) & (s > 50) & (v > 45)
        rice_mask = (h >= 12) & (h <= 30) & (s >= 25) & (s <= 95) & (v > 55)
        pasta_mask = (h >= 8) & (h <= 38) & (s > 80) & (v > 45)
        kebab_brown_mask = (h >= 5) & (h <= 30) & (s > 45) & (v >= 35) & (v <= 165)

        green_ratio = float(np.count_nonzero(green_mask)) / total
        rice_ratio = float(np.count_nonzero(rice_mask)) / total
        pasta_ratio = float(np.count_nonzero(pasta_mask)) / total
        kebab_ratio = float(np.count_nonzero(kebab_brown_mask)) / total

        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 80, 180)
        cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        elongated = 0
        for c in cnts:
            area = cv2.contourArea(c)
            if area < 250:
                continue
            x, y, w, hh = cv2.boundingRect(c)
            if hh == 0:
                continue
            ratio = max(w / hh, hh / w)
            if ratio >= 2.7:
                elongated += 1

        hint: str | None = None
        hint_reason = ""
        if kebab_ratio > 0.26:
            hint, hint_reason = "كباب", "فحص بصري: نسيج شواء/تحمير واضح"
        elif kebab_ratio > 0.12 and elongated >= 1:
            hint, hint_reason = "كباب", "فحص بصري: قطع مشوية طويلة (كباب)"
        elif green_ratio > 0.24 and rice_ratio < 0.22:
            hint, hint_reason = "سلطة", "فحص بصري: نسبة خضار عالية"
        elif pasta_ratio > 0.20 and (pasta_ratio > rice_ratio * 0.8) and green_ratio < 0.20:
            hint, hint_reason = "مكرونة", "فحص بصري: ألوان مكرونة مهيمنة"
        elif rice_ratio > 0.34 and pasta_ratio < 0.24:
            hint, hint_reason = "رز", "فحص بصري: هيمنة ألوان الرز في الطبق"
        elif green_ratio > 0.18 and rice_ratio > 0.24:
            hint, hint_reason = "وجبة مختلطة", "فحص بصري: خضار + مكون نشوي واضح"

        return {
            "kebab_ratio": kebab_ratio,
            "rice_ratio": rice_ratio,
            "green_ratio": green_ratio,
            "pasta_ratio": pasta_ratio,
            "elongated": elongated,
            "hint": hint,
            "hint_reason": hint_reason,
        }
    except Exception:
        return None


def _strong_kebab_visual_from_scan(scan: dict[str, object] | None) -> bool:
    """True when plate looks like skewer/minced grill (kofta) rather than a single fish fillet."""
    if not scan:
        return False
    kr = float(scan.get("kebab_ratio") or 0.0)
    el = int(scan.get("elongated") or 0)
    # Heavy parsley lowers kr; rely on several long grilled contours (skewers).
    if el >= 4 and kr >= 0.09:
        return True
    if el >= 3 and kr >= 0.11:
        return True
    if kr >= 0.22 and el >= 2:
        return True
    if kr >= 0.28:
        return True
    return False


def _visual_food_hint_from_image(image_bytes: bytes) -> tuple[str | None, str]:
    """
    Lightweight full-image scan to distinguish common meal types
    when the model collapses to one class (e.g. always chicken).
    """
    scan = _visual_scan_metrics(image_bytes)
    if not scan:
        return None, ""
    hint = scan.get("hint")
    reason = str(scan.get("hint_reason") or "")
    if isinstance(hint, str) and hint:
        return hint, reason
    return None, ""


def _extract_detected_tokens(labels: list[str]) -> set[str]:
    tokens: set[str] = set()
    for label in labels:
        lowered = label.lower().strip()
        for token, terms in _CLASS_SYNONYMS.items():
            if any(term in lowered for term in terms):
                tokens.add(token)
    return tokens


def _has_fish_signal(labels: list[str]) -> bool:
    """True if model or labels mention fish (even weakly); grilled fish looks like kebab to color heuristics."""
    for label in labels:
        lowered = str(label).lower()
        if "pescado" in lowered or "fish" in lowered or "سمك" in lowered:
            return True
    return False


def _has_kebab_signal(labels: list[str], filename: str) -> bool:
    text = _normalize_text_tokens(" ".join(labels) + " " + filename)
    for term in ("kebab", "kabab", "kofta", "كباب", "كفتة", "مشاوي"):
        if term in text:
            return True
    return False


def _direct_dish_from_text(labels: list[str], filename: str = "") -> str | None:
    combined = _normalize_text_tokens(" ".join(labels + [filename]))
    for dish_name, keywords in _DIRECT_DISH_KEYWORDS.items():
        if any(keyword in combined for keyword in keywords):
            return dish_name
    return None


def _suggest_dish_name_ar(labels: list[str], best_confidence: float, best_label: str = "") -> tuple[str, str]:
    tokens = _extract_detected_tokens(labels)
    # Priority: protein dish identities first, then sides.
    if "kebab" in tokens:
        return "كباب", "تم اكتشاف فئة الكباب/المشاوي"
    if "fish" in tokens and "rice" in tokens:
        return "سمك", "وجود سمك مع مكون نشوي"
    if "fish" in tokens:
        return "سمك", "تم اكتشاف فئة السمك"
    if "stew" in tokens:
        return "إيدام", "تم اكتشاف فئة الإيدام/المرق"
    if "grilled_chicken" in tokens:
        return "دجاج مشوي", "تم اكتشاف دجاج مشوي"
    if "chicken" in tokens and "rice" in tokens and ("kabsa" in tokens or "mandi" in tokens):
        return "كبسة دجاج" if "kabsa" in tokens else "مندي دجاج", "وجود دجاج مع رز (طبق رئيسي)"
    if "meat" in tokens and "rice" in tokens:
        return "كبسة لحم", "وجود لحم مع رز (طبق رئيسي)"

    direct = _direct_dish_from_text(labels)
    if direct:
        return direct, "مطابقة مباشرة لاسم طبق في مخرجات النموذج"
    if {"tomato", "cucumber", "lettuce"} & tokens:
        return "سلطة", "اكتشاف مكونات خضار سلطة"
    if "salad" in tokens:
        return "سلطة", "تم اكتشاف فئة السلطة"
    if "soup" in tokens:
        return "شوربة", "تم اكتشاف فئة الشوربة"
    if "rice" in tokens and "mandi" in tokens:
        return "مندي دجاج" if "chicken" in tokens else "مندي لحم", "وجود رز مع فئة مندي"
    if "rice" in tokens and "biryani" in tokens:
        return "برياني دجاج" if "chicken" in tokens else "برياني لحم", "وجود رز مع فئة برياني"
    if "rice" in tokens and "machboos" in tokens:
        return "مجبوس دجاج" if "chicken" in tokens else "مجبوس لحم", "وجود رز مع فئة مجبوس"
    if "rice" in tokens and "kabsa" in tokens:
        return "كبسة دجاج" if "chicken" in tokens else "كبسة لحم", "وجود رز مع فئة كبسة"
    if "rice" in tokens and "chicken" in tokens:
        # Prefer mandi/kabsa style for common Gulf meals.
        return ("كبسة دجاج" if best_confidence >= 0.75 else "مندي دجاج"), "وجود رز مع دجاج"
    if "rice" in tokens and "meat" in tokens:
        return "كبسة لحم", "وجود رز مع لحم"
    if "pasta" in tokens:
        return "مكرونة", "تم اكتشاف فئة المكرونة"
    if "bread" in tokens and "sauce" in tokens:
        return "خبز مع صلصة", "وجود خبز مع صلصة"
    if "chicken" in tokens:
        return "دجاج", "تم اكتشاف فئة الدجاج"
    if "meat" in tokens:
        return "لحم", "تم اكتشاف فئة اللحم"

    first_label = best_label or (labels[0] if labels else "")
    first_mapped = _map_label_to_arabic(first_label)
    if first_mapped:
        return first_mapped, "استنادًا إلى أعلى فئة متوقعة"
    if first_label:
        return _humanize_label(first_label), "استنادًا إلى أعلى class متوقع من النموذج"
    return "طبق غير محدد", "لم يتم التعرف على فئة أطباق واضحة"


def _local_fallback_from_filename_and_classes(filename: str, labels: list[str]) -> tuple[str, str]:
    filename_text = _normalize_text_tokens(filename)
    label_text = _normalize_text_tokens(" ".join(labels))
    combined_text = f"{filename_text} {label_text}".strip()

    # Priority rules for Saudi restaurant/employee meal categories.
    if any(key in combined_text for key in ["kabsa", "كبسة"]) and any(
        key in combined_text for key in ["chicken", "pollo", "دجاج"]
    ):
        return "كبسة دجاج", "مطابقة كلمات كبسة + دجاج في اسم الملف/الكلاسات"
    if any(key in combined_text for key in ["kabsa", "كبسة"]) and any(
        key in combined_text for key in ["meat", "beef", "lamb", "carne", "لحم"]
    ):
        return "كبسة لحم", "مطابقة كلمات كبسة + لحم في اسم الملف/الكلاسات"
    if any(key in combined_text for key in ["mandi", "مندي"]):
        return "مندي", "مطابقة كلمة مندي في اسم الملف/الكلاسات"
    if any(key in combined_text for key in ["biryani", "برياني"]):
        return "برياني", "مطابقة كلمة برياني في اسم الملف/الكلاسات"
    if any(key in combined_text for key in ["grilled chicken", "مشوي", "roasted chicken"]):
        return "دجاج مشوي", "مطابقة دجاج مشوي في اسم الملف/الكلاسات"
    if any(key in combined_text for key in ["rice", "arroz", "رز"]):
        if any(key in combined_text for key in ["chicken", "pollo", "دجاج"]):
            return "كبسة دجاج", "مطابقة رز + دجاج في اسم الملف/الكلاسات"
        if any(key in combined_text for key in ["meat", "beef", "lamb", "carne", "لحم"]):
            return "كبسة لحم", "مطابقة رز + لحم في اسم الملف/الكلاسات"
        return "رز", "مطابقة فئة الرز"
    if any(key in combined_text for key in ["salad", "سلطة"]):
        return "سلطة", "مطابقة فئة السلطة"
    if any(key in combined_text for key in ["soup", "شوربة"]):
        return "شوربة", "مطابقة فئة الشوربة"
    if any(key in combined_text for key in ["bread", "naan", "khubz", "خبز"]):
        return "خبز", "مطابقة فئة الخبز"
    if any(key in combined_text for key in ["pasta", "macaroni", "مكرونة"]):
        return "مكرونة", "مطابقة فئة المكرونة"
    if any(key in combined_text for key in ["fish", "pescado", "سمك"]):
        return "سمك", "مطابقة فئة السمك"

    if labels:
        first = labels[0]
        mapped = _map_label_to_arabic(first)
        if mapped:
            return mapped, "fallback محلي: استخدام أول class متوقع"
        return _humanize_label(first), "fallback محلي: استخدام أول class متوقع"
    return "طبق غير محدد", "fallback محلي: لا توجد مطابقة واضحة"


def _build_top_suggested_options(labels: list[str], best_label: str, filename: str = "") -> list[str]:
    options: list[str] = []
    # Use model top classes first.
    for label in labels:
        candidate = (
            _direct_dish_from_text([label], filename)
            or _map_label_to_arabic(label)
            or _humanize_label(label)
        )
        if candidate and candidate != "طبق غير محدد" and candidate not in options:
            options.append(candidate)
        if len(options) >= 3:
            break

    # Ensure at least 3 options with smart fallback combinations.
    combo_candidates = [
        _suggest_dish_name_ar(labels, best_confidence=0.8, best_label=best_label)[0],
        _local_fallback_from_filename_and_classes(filename, labels)[0],
        "طبق غير محدد",
    ]
    for candidate in combo_candidates:
        if candidate and candidate not in options:
            options.append(candidate)
        if len(options) >= 3:
            break
    # Ensure all options are Arabic-only and non-empty.
    arabic_only = []
    for option in options:
        ar = _map_label_to_arabic(option) or option
        if ar and ar not in arabic_only and not any("a" <= ch.lower() <= "z" for ch in ar):
            arabic_only.append(ar)
    if not arabic_only:
        arabic_only = ["طبق غير محدد"]
    return arabic_only[:3]


def _uncertain_result(filename: str = "", labels: list[str] | None = None) -> dict[str, object]:
    labels = labels or []
    fallback_name, fallback_reason = _local_fallback_from_filename_and_classes(filename, labels)
    options = _build_top_suggested_options(labels=labels, best_label=labels[0] if labels else "", filename=filename)
    return {
        "dish_name": fallback_name,
        "dish_name_ar": fallback_name,
        "confidence": 0.0,
        "labels": labels[:5],
        "detected_classes": labels[:8],
        "suggestion_reason": fallback_reason,
        "suggested_name": fallback_name if fallback_name != "طبق غير محدد" else "وجبة مختلطة",
        "suggested_options": options,
        "experimental": True,
    }


def _extract_predictions(data: dict[str, object]) -> tuple[list[str], str, float]:
    predictions_obj = data.get("predictions") if isinstance(data, dict) else None
    label_scores: dict[str, float] = {}
    best_label = ""
    best_confidence = 0.0

    # Expected format:
    # {"predictions": {"arroz": {"confidence": 0.94, "class_id": 0}}}
    if isinstance(predictions_obj, dict):
        for label, meta in predictions_obj.items():
            label_str = str(label).strip()
            if not label_str:
                continue
            conf_raw = meta.get("confidence", 0) if isinstance(meta, dict) else 0
            try:
                conf = float(conf_raw)
            except (TypeError, ValueError):
                conf = 0.0
            label_scores[label_str] = max(conf, label_scores.get(label_str, 0.0))
            if conf > best_confidence:
                best_confidence = conf
                best_label = label_str
    elif isinstance(predictions_obj, list):
        for item in predictions_obj:
            if not isinstance(item, dict):
                continue
            label_str = str(item.get("class") or item.get("label") or "").strip()
            if not label_str:
                continue
            conf_raw = item.get("confidence", 0)
            try:
                conf = float(conf_raw)
            except (TypeError, ValueError):
                conf = 0.0
            label_scores[label_str] = max(conf, label_scores.get(label_str, 0.0))
            if conf > best_confidence:
                best_confidence = conf
                best_label = label_str

    predicted_classes_obj = data.get("predicted_classes") if isinstance(data, dict) else None
    if isinstance(predicted_classes_obj, list):
        for cls in predicted_classes_obj:
            cls_str = str(cls).strip()
            if cls_str:
                label_scores.setdefault(cls_str, 0.01)
                if not best_label:
                    best_label = cls_str
    labels = sorted(label_scores.keys(), key=lambda key: label_scores.get(key, 0.0), reverse=True)
    return labels, best_label, best_confidence, label_scores


def _build_response(
    labels: list[str],
    best_label: str,
    best_confidence: float,
    filename: str = "",
    image_bytes: bytes | None = None,
) -> dict[str, object]:
    logger.info("Roboflow labels=%s best=%s confidence=%.3f", labels, best_label, best_confidence)
    if not labels or not best_label:
        return _uncertain_result(filename=filename, labels=labels)

    suggested_name, suggestion_reason = _suggest_dish_name_ar(labels, best_confidence, best_label=best_label)
    suggested_options = _build_top_suggested_options(labels=labels, best_label=best_label, filename=filename)
    detected_classes = [str(label).strip() for label in labels[:8] if str(label).strip()]
    filename_fallback_name, filename_fallback_reason = _local_fallback_from_filename_and_classes(
        filename, detected_classes
    )
    visual_hint = None
    visual_reason = ""
    tokens = _extract_detected_tokens(labels)
    scan = _visual_scan_metrics(image_bytes) if image_bytes else None
    strong_kebab = _strong_kebab_visual_from_scan(scan)
    if scan:
        h = scan.get("hint")
        visual_hint = h if isinstance(h, str) and h else None
        visual_reason = str(scan.get("hint_reason") or "")
    # Grilled fish can look like kebab; drop kebab *hint* only when fish is signaled and skewer evidence is weak.
    if visual_hint == "كباب" and (_has_fish_signal(labels) or "fish" in tokens) and "kebab" not in tokens:
        if not strong_kebab:
            visual_hint, visual_reason = None, ""
    if not suggested_name or suggested_name == "طبق غير محدد":
        suggested_name = filename_fallback_name
        suggestion_reason = filename_fallback_reason
    if best_confidence < 0.20:
        low_conf_name = suggested_name or filename_fallback_name or _humanize_label(best_label)
        if visual_hint and low_conf_name in {"دجاج", "pollo", "طبق غير محدد"}:
            low_conf_name = visual_hint
            suggestion_reason = f"{suggestion_reason} + {visual_reason}".strip(" +")
        return {
            "dish_name": low_conf_name,
            "dish_name_ar": low_conf_name,
            "confidence": best_confidence,
            "labels": suggested_options,
            "detected_classes": detected_classes,
            "suggestion_reason": suggestion_reason,
            "suggested_name": low_conf_name,
            "suggested_options": suggested_options,
            "experimental": True,
        }

    mapped_best = (
        _direct_dish_from_text([best_label], filename)
        or _map_label_to_arabic(best_label)
        or suggested_name
        or _humanize_label(best_label)
    )
    # Kofta/seekh plates are often mislabeled pescado+arroz (bread reads as rice); strong skewer/char beats that.
    if (
        "fish" in tokens
        and "kebab" not in tokens
        and strong_kebab
        and best_confidence < 0.90
    ):
        mapped_best = "كباب"
        suggestion_reason = "تمييز كباب: مظهر مشاوي قوي يغلب تصنيف سمك خاطئ من النموذج"
    # Explicit fish vs kebab: trust fish tokens when kebab visuals are not overwhelming or model is confident fish.
    elif "fish" in tokens and "kebab" not in tokens:
        if "rice" in tokens:
            mapped_best = "سمك مع رز"
        elif mapped_best not in {"سمك", "سمك مع رز"}:
            mapped_best = "سمك"
        if mapped_best in {"سمك", "سمك مع رز"}:
            suggestion_reason = "تمييز سمك: إشارة fish/pescado بدون كباب"
    elif "kebab" in tokens and "fish" not in tokens:
        mapped_best = "كباب"
        suggestion_reason = "تمييز كباب: إشارة kebab/kofta بدون سمك"
    elif mapped_best in {"سمك", "سمك مع رز"} and visual_hint == "كباب" and _has_kebab_signal(labels, filename):
        mapped_best = "كباب"
        suggestion_reason = f"{suggestion_reason} + تمييز كباب من السياق".strip(" +")
    if visual_hint and mapped_best in {"دجاج", "pollo"}:
        if visual_hint == "سلطة":
            mapped_best = "سلطة دجاج"
        elif visual_hint == "رز":
            mapped_best = "رز مع دجاج"
        elif visual_hint == "مكرونة":
            mapped_best = "مكرونة"
        suggestion_reason = f"{suggestion_reason} + {visual_reason}".strip(" +")
        if mapped_best not in suggested_options:
            suggested_options = [mapped_best, *suggested_options][:3]

    # Override common fish false positive when kebab/meat visuals are obvious.
    if mapped_best in {"سمك", "سمك مع رز"} and visual_hint in {"كباب", "لحم"} and "kebab" in tokens:
        mapped_best = visual_hint
        suggestion_reason = f"{suggestion_reason} + تصحيح ضد خطأ سمك".strip(" +")
        if mapped_best not in suggested_options:
            suggested_options = [mapped_best, *suggested_options][:3]
        else:
            suggested_options = [mapped_best, *[x for x in suggested_options if x != mapped_best]][:3]

    # If visual scan is strongly pasta/salad, let it override common false positives.
    if visual_hint in {"مكرونة", "سلطة"} and mapped_best in {
        "دجاج",
        "رز",
        "رز مع دجاج",
        "سلطة دجاج",
        "طبق غير محدد",
    }:
        mapped_best = visual_hint
        if mapped_best not in suggested_options:
            suggested_options = [mapped_best, *suggested_options][:3]
    if suggested_options:
        if mapped_best in suggested_options:
            suggested_options = [mapped_best, *[x for x in suggested_options if x != mapped_best]][:3]
        else:
            suggested_options = [mapped_best, *suggested_options][:3]
        suggested_name = suggested_options[0]
    return {
        "dish_name": mapped_best,
        "dish_name_ar": mapped_best,
        "confidence": best_confidence,
        "labels": suggested_options,
        "detected_classes": detected_classes,
        "suggestion_reason": suggestion_reason,
        "suggested_name": suggested_name,
        "suggested_options": suggested_options,
        "experimental": False,
    }


def _detect_with_sdk(image_bytes: bytes, filename: str, api_key: str) -> dict[str, object] | None:
    if InferenceHTTPClient is None:
        logger.error("inference_sdk is not installed in this Python runtime")
        return None

    client = InferenceHTTPClient(
        api_url=settings.ROBOFLOW_API_URL.strip() or "https://serverless.roboflow.com",
        api_key=api_key,
    )

    suffix = ".jpg"
    lowered = (filename or "").lower()
    if lowered.endswith(".png"):
        suffix = ".png"
    elif lowered.endswith(".webp"):
        suffix = ".webp"
    elif lowered.endswith(".jpeg"):
        suffix = ".jpeg"

    with tempfile.NamedTemporaryFile(delete=True, suffix=suffix) as tmp:
        tmp.write(image_bytes)
        tmp.flush()
        data = client.infer(tmp.name, model_id=settings.ROBOFLOW_MODEL_ID.strip() or "food-types-po0yz/2")
    labels, best_label, best_confidence, _ = _extract_predictions(data if isinstance(data, dict) else {})
    return _build_response(labels, best_label, best_confidence, filename=filename, image_bytes=image_bytes)


def _image_suffix_from_bytes(image_bytes: bytes) -> str:
    if len(image_bytes) >= 3 and image_bytes[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if len(image_bytes) >= 8 and image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return ".webp"
    return ".jpg"


def _roboflow_infer_json_sdk(image_bytes: bytes, api_key: str) -> dict[str, object] | None:
    if InferenceHTTPClient is None:
        return None
    client = InferenceHTTPClient(
        api_url=settings.ROBOFLOW_API_URL.strip() or "https://serverless.roboflow.com",
        api_key=api_key,
    )
    suffix = _image_suffix_from_bytes(image_bytes)
    with tempfile.NamedTemporaryFile(delete=True, suffix=suffix) as tmp:
        tmp.write(image_bytes)
        tmp.flush()
        data = client.infer(tmp.name, model_id=settings.ROBOFLOW_MODEL_ID.strip() or "food-types-po0yz/2")
    return data if isinstance(data, dict) else None


def _roboflow_infer_json_http(image_bytes: bytes, api_key: str) -> dict[str, object] | None:
    endpoint = settings.ROBOFLOW_FOOD_TYPES_URL.strip()
    if not endpoint:
        return None
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    url = f"{endpoint}?api_key={api_key}"
    response = requests.post(
        url,
        json={"image": image_base64},
        headers={"Content-Type": "application/json"},
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else None


def roboflow_infer_label_scores(image_bytes: bytes) -> dict[str, float] | None:
    """
    Raw Roboflow class label -> confidence (no filename heuristics, no Arabic mapping).
    Used by professional dish pipeline for top-3 suggestions.
    """
    api_key = os.getenv("ROBOFLOW_API_KEY", settings.ROBOFLOW_API_KEY).strip()
    if not api_key:
        return None
    data = None
    try:
        data = _roboflow_infer_json_sdk(image_bytes, api_key)
        if data is not None:
            logger.warning("Roboflow SDK raw response: %s", str(data)[:3000])
    except Exception as exc:
        logger.warning("Roboflow SDK inference failed: %s", exc)
        data = None
    if data is None:
        try:
            data = _roboflow_infer_json_http(image_bytes, api_key)
            if data is not None:
                logger.warning("Roboflow HTTP raw response: %s", str(data)[:3000])
        except Exception as exc:
            logger.warning("Roboflow HTTP inference failed: %s", exc)
            return None
    if not data:
        return None
    _, _, _, scores = _extract_predictions(data)
    logger.warning("Roboflow extracted label scores: %s", scores)
    return scores or None


def _detect_with_http_fallback(image_bytes: bytes, api_key: str, filename: str = "") -> dict[str, object]:
    endpoint = settings.ROBOFLOW_FOOD_TYPES_URL.strip()
    if not endpoint:
        return _uncertain_result()
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    url = f"{endpoint}?api_key={api_key}"
    response = requests.post(
        url,
        json={"image": image_base64},
        headers={"Content-Type": "application/json"},
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    labels, best_label, best_confidence, _ = _extract_predictions(data if isinstance(data, dict) else {})
    return _build_response(labels, best_label, best_confidence, filename=filename, image_bytes=image_bytes)


def detect_dish(image_bytes: bytes, filename: str = "") -> dict[str, object]:
    api_key = os.getenv("ROBOFLOW_API_KEY", settings.ROBOFLOW_API_KEY).strip()
    if not api_key:
        logger.error("ROBOFLOW_API_KEY is not configured")
        return _uncertain_result(filename=filename)
    try:
        return _detect_with_sdk(image_bytes=image_bytes, filename=filename, api_key=api_key) or _uncertain_result(
            filename=filename
        )
    except Exception as sdk_exc:
        logger.warning("Roboflow SDK infer failed, using HTTP fallback: %s", sdk_exc)
    try:
        return _detect_with_http_fallback(image_bytes=image_bytes, api_key=api_key, filename=filename)
    except Exception as fallback_exc:
        logger.error("Roboflow fallback failed: %s", fallback_exc)
        return _uncertain_result(filename=filename)
