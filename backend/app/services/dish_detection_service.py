import base64
import json
import random
from urllib import error, request

from app.core.config import settings

_LABEL_TO_AR = {
    "pasta": "مكرونة",
    "spaghetti": "سباغيتي",
    "noodle": "مكرونة",
    "rice": "كبسة",
    "shrimp": "ربيان",
    "prawn": "ربيان",
    "chicken": "دجاج",
    "salad": "سلطة",
    "biryani": "كبسة",
    "seafood": "ربيان",
}

_AR_ALTERNATIVES = {
    "مكرونة": ["سباغيتي", "باستا", "رز"],
    "كبسة": ["رز", "برياني", "دجاج"],
    "ربيان": ["مأكولات بحرية", "سمك", "كبسة"],
    "دجاج": ["كبسة", "مشاوي", "أرز"],
    "سلطة": ["خضار", "مقبلات", "طبق جانبي"],
    "طبق غير معروف": ["كبسة", "مكرونة", "سلطة"],
}


def _find_arabic_label(text: str) -> str | None:
    lowered = (text or "").lower()
    for en, ar in _LABEL_TO_AR.items():
        if en in lowered:
            return ar
    return None


def _fallback_detection(filename: str) -> tuple[str, list[str], float | None]:
    hint = _find_arabic_label(filename or "")
    if hint:
        return hint, _AR_ALTERNATIVES.get(hint, _AR_ALTERNATIVES["طبق غير معروف"])[:3], None
    guessed = random.choice(["مكرونة", "كبسة", "ربيان", "دجاج", "سلطة"])
    return guessed, _AR_ALTERNATIVES.get(guessed, _AR_ALTERNATIVES["طبق غير معروف"])[:3], None


def detect_dish_from_image(image_bytes: bytes, filename: str) -> tuple[str, list[str], float | None, str]:
    api_key = settings.GOOGLE_VISION_API_KEY.strip()
    if not api_key:
        detected, alternatives, confidence = _fallback_detection(filename)
        return detected, alternatives, confidence, "fallback"

    endpoint = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
                "features": [{"type": "LABEL_DETECTION", "maxResults": 12}],
            }
        ]
    }
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
        detected, alternatives, confidence = _fallback_detection(filename)
        return detected, alternatives, confidence, "fallback"

    labels = data.get("responses", [{}])[0].get("labelAnnotations", []) or []
    detected = "طبق غير معروف"
    confidence = None
    for item in labels:
        description = str(item.get("description", ""))
        mapped = _find_arabic_label(description)
        if mapped:
            detected = mapped
            score = item.get("score")
            if isinstance(score, (int, float)):
                confidence = round(float(score) * 100, 1)
            break

    alternatives = _AR_ALTERNATIVES.get(detected, _AR_ALTERNATIVES["طبق غير معروف"])[:3]
    return detected, alternatives, confidence, "google_vision"


def detect_dish_with_google_vision(image_bytes: bytes) -> tuple[str, float, list[str]]:
    api_key = settings.GOOGLE_VISION_API_KEY.strip()
    if not api_key:
        raise RuntimeError("GOOGLE_VISION_API_KEY is not configured")

    endpoint = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
                "features": [{"type": "LABEL_DETECTION", "maxResults": 5}],
            }
        ]
    }
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("google vision request failed") from exc

    labels_raw = data.get("responses", [{}])[0].get("labelAnnotations", []) or []
    if not labels_raw:
        raise RuntimeError("no labels found")

    labels = [str(item.get("description", "")).strip() for item in labels_raw if item.get("description")]
    if not labels:
        raise RuntimeError("no valid labels found")

    food_keywords = (
        "food",
        "dish",
        "meal",
        "cuisine",
        "pasta",
        "rice",
        "shrimp",
        "chicken",
        "salad",
        "seafood",
    )
    best_item = labels_raw[0]
    for item in labels_raw:
        description = str(item.get("description", "")).lower()
        if any(keyword in description for keyword in food_keywords):
            best_item = item
            break

    dish_name = str(best_item.get("description", "")).strip() or labels[0]
    score = best_item.get("score")
    confidence = float(score) if isinstance(score, (int, float)) else 0.0
    return dish_name, confidence, labels
