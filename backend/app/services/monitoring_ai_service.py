"""
Kitchen safety monitoring: Gemini Vision only (when not in demo).
Demo mode returns static sample data; no Roboflow fallback for monitoring accuracy.
"""

from __future__ import annotations

import io
import json
import logging
import re
from base64 import standard_b64encode
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

CHECK_DEFS: list[tuple[str, str]] = [
    ("mask", "الكمامة"),
    ("gloves", "القفازات"),
    ("headcover", "غطاء الرأس"),
    ("uniform", "الزي الرسمي"),
    ("wet_floor", "الأرضيات المبللة"),
    ("trash_location", "موقع الحاويات"),
    ("people_count", "عدد الأشخاص"),
]

STATUS_AR = {
    "safe": "سليم",
    "violation": "مخالفة",
    "needs_review": "يحتاج مراجعة",
    "uncertain": "غير مؤكد",
}

VIOLATION_TYPE_LABELS: dict[str, str] = {
    "no_mask": "عدم ارتداء الكمامة",
    "no_gloves": "عدم ارتداء القفازات",
    "no_headcover": "عدم ارتداء غطاء الرأس",
    "no_uniform": "عدم ارتداء الزي الرسمي",
    "wet_floor": "أرضية مبللة",
    "trash_location": "موقع حاويات غير مناسب",
}

# English instructions for reliable JSON; Arabic labels in output fields.
GEMINI_PROMPT_MONITORING = """Analyze this kitchen / food-service safety image. Do NOT guess. Check ONLY what is clearly visible in the frame.

STRICT RULES:
- Never mark "gloves" as safe if hands are not clearly visible (use uncertain).
- Never mark "wet_floor" as safe if the floor is not clearly visible (use uncertain).
- Never mark "trash_location" as safe if trash bins / waste area is not clearly visible (use uncertain).
- Never mark "uniform" as safe if a full uniform cannot be clearly assessed (use uncertain).
- Only use "violation" when the problem is clearly visible.
- If something is not visible or unclear, use status "uncertain" with lower confidence.
- "mask": safe only if a face mask is clearly worn; violation only if clearly absent when face visible.

Return JSON ONLY (no markdown, no text outside JSON) with this exact shape:
{
  "people_count": <integer, number of people clearly visible>,
  "checks": [
    {
      "key": "mask",
      "label_ar": "الكمامة",
      "status": "safe" | "violation" | "needs_review" | "uncertain",
      "status_ar": "سليم" | "مخالفة" | "يحتاج مراجعة" | "غير مؤكد",
      "confidence": <integer 0-100>,
      "reason_ar": "<short clear Arabic reason>"
    }
  ]
}

You MUST include exactly one entry per key in this order: mask, gloves, headcover, uniform, wet_floor, trash_location, people_count.
For the people_count row, explain the count in reason_ar; status may be "safe" if count is clear, else "uncertain".
"""


_NOT_VISIBLE_HINT = re.compile(
    r"not\s+visible|cannot\s+see|unclear|not\s+shown|not\s+clear|غير\s+ظاهر|غير\s+واضح|لا\s+يظهر|لا\s+تظهر|غير\s+مرئي|لا\s+يمكن",
    re.IGNORECASE,
)


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


def _to_int_confidence(value: object) -> int:
    try:
        n = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0
    if n <= 1.0:
        n = n * 100.0
    return int(max(0.0, min(100.0, round(n))))


def _bucket_display_status(raw: str, conf: int) -> str:
    """>=85: only safe or violation; 60–84: needs_review; <60: uncertain."""
    raw_l = (raw or "").strip().lower()
    if conf < 60:
        return "uncertain"
    if conf < 85:
        return "needs_review"
    if raw_l == "violation":
        return "violation"
    if raw_l == "safe":
        return "safe"
    return "uncertain"


def _thumbnail_jpeg_data_url(image_bytes: bytes, max_side: int = 720, quality: int = 72) -> str | None:
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        raw = buf.getvalue()
        b64 = standard_b64encode(raw).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return None


def monitoring_image_snapshot(image_bytes: bytes) -> str | None:
    url = _thumbnail_jpeg_data_url(image_bytes)
    if not url:
        return None
    cap = max(10_000, settings.MONITORING_IMAGE_DATA_URL_MAX_CHARS)
    if len(url) > cap:
        return url[:cap]
    return url


def _merge_checks(parsed_checks: list[Any] | None) -> dict[str, dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    if isinstance(parsed_checks, list):
        for item in parsed_checks:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key", "")).strip()
            if key:
                by_key[key] = item
    return by_key


def _row_for_key(checks_in: list[dict[str, Any]], key: str) -> dict[str, Any]:
    for c in checks_in:
        if isinstance(c, dict) and str(c.get("key", "")).strip() == key:
            return c
    return {}


def _apply_visibility_post_rules(checks_out: list[dict[str, Any]]) -> None:
    """Downgrade impossible 'safe' calls when reason admits poor visibility."""
    keys = {"gloves", "wet_floor", "trash_location", "uniform"}
    for row in checks_out:
        if row.get("key") not in keys:
            continue
        if row.get("status") != "safe":
            continue
        reason = str(row.get("reason_ar") or "")
        if _NOT_VISIBLE_HINT.search(reason):
            row["status"] = "uncertain"
            row["status_ar"] = STATUS_AR["uncertain"]
            row["confidence"] = min(int(row.get("confidence") or 0), 55)


def _finalize_payload(
    *,
    provider: str,
    camera_name: str | None,
    location: str | None,
    checks_in: list[dict[str, Any]],
    people_count_top: int | None = None,
) -> dict[str, Any]:
    checks_out: list[dict[str, Any]] = []
    needs_review_any = False
    confidences: list[int] = []

    for key, default_label_ar in CHECK_DEFS:
        src = _row_for_key(checks_in, key)
        raw_status = str(src.get("status", "uncertain")).strip().lower()
        conf = _to_int_confidence(src.get("confidence", 0))
        label_ar = str(src.get("label_ar", "")).strip() or default_label_ar
        reason = str(src.get("reason_ar", "")).strip() or "—"
        disp = _bucket_display_status(raw_status, conf)
        if disp == "needs_review":
            needs_review_any = True
        confidences.append(conf)
        checks_out.append(
            {
                "key": key,
                "label_ar": label_ar,
                "status": disp,
                "status_ar": STATUS_AR.get(disp, "غير مؤكد"),
                "confidence": conf,
                "reason_ar": reason,
            }
        )

    if provider == "gemini":
        _apply_visibility_post_rules(checks_out)
        for row in checks_out:
            if row.get("status") == "needs_review":
                needs_review_any = True

    people_count = 0
    if people_count_top is not None:
        try:
            people_count = max(0, int(people_count_top))
        except (TypeError, ValueError):
            people_count = 0
    pc_row = _row_for_key(checks_in, "people_count")
    if people_count == 0 and pc_row:
        try:
            people_count = max(people_count, int(pc_row.get("count", pc_row.get("people_count", 0))))
        except (TypeError, ValueError):
            m = re.search(r"(\d+)", str(pc_row.get("reason_ar", "")))
            if m:
                try:
                    people_count = max(people_count, int(m.group(1)))
                except ValueError:
                    pass

    violations_out: list[dict[str, Any]] = []

    vtypes_from_checks = {
        "mask": "no_mask",
        "gloves": "no_gloves",
        "headcover": "no_headcover",
        "uniform": "no_uniform",
        "wet_floor": "wet_floor",
        "trash_location": "trash_location",
    }
    existing_types = {v["type"] for v in violations_out}
    for row in checks_out:
        if row["key"] == "people_count":
            continue
        if row["status"] == "violation" and row["confidence"] >= 85:
            vt = vtypes_from_checks.get(row["key"])
            if vt and vt not in existing_types:
                violations_out.append(
                    {
                        "type": vt,
                        "label_ar": VIOLATION_TYPE_LABELS.get(vt, row["label_ar"]),
                        "confidence": row["confidence"],
                        "reason_ar": row["reason_ar"],
                    }
                )
                existing_types.add(vt)

    overall = int(round(sum(confidences) / max(1, len(confidences)))) if confidences else 0

    return {
        "status": "ok",
        "provider": provider,
        "camera_name": camera_name,
        "location": location,
        "people_count": people_count,
        "overall_confidence": overall,
        "needs_review": needs_review_any,
        "checks": checks_out,
        "violations": violations_out,
    }


def _run_gemini_monitoring(image_bytes: bytes, camera_name: str | None, location: str | None) -> dict[str, Any]:
    key = (settings.GEMINI_API_KEY or "").strip()
    if not key:
        raise ValueError("AI المراقبة غير مفعل. يرجى إضافة مفتاح Gemini API.")

    logger.info(
        "monitoring gemini: MONITORING_AI_DEMO_MODE=%s gemini_key_exists=%s",
        settings.MONITORING_AI_DEMO_MODE,
        bool(key),
    )

    try:
        from google import genai
        from google.genai import types as genai_types
        from PIL import Image
    except ImportError:
        logger.warning("monitoring: google-genai or Pillow missing")
        raise ValueError("فشل تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي.") from None

    client = genai.Client(api_key=key)
    model_name = (settings.GEMINI_VISION_MODEL or "gemini-flash-lite-latest").strip()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    img_part = genai_types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg")
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[GEMINI_PROMPT_MONITORING, img_part],
        )
    except Exception as exc:
        logger.info("monitoring gemini request failed: %s", type(exc).__name__)
        raise ValueError("فشل تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي.") from exc

    text = (getattr(resp, "text", None) or "").strip()
    logger.info("monitoring gemini response_len=%s", len(text))
    data = _parse_json_object(text)
    if not data:
        logger.info("monitoring gemini json_parse_failed text_preview=%s", text[:800])
        raise ValueError("فشل تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي.")

    try:
        log_payload = json.dumps(data, ensure_ascii=False)[:4000]
        logger.info("monitoring gemini parsed_json preview=%s", log_payload)
    except Exception:
        logger.info("monitoring gemini parsed_json (could not serialize for log)")

    checks_merged = _merge_checks(data.get("checks"))
    checks_list: list[dict[str, Any]] = []
    for ck, lab in CHECK_DEFS:
        row = checks_merged.get(ck, {})
        checks_list.append(
            {
                "key": ck,
                "label_ar": str(row.get("label_ar", "")).strip() or lab,
                "status": str(row.get("status", "uncertain")).strip().lower(),
                "confidence": _to_int_confidence(row.get("confidence", 0)),
                "reason_ar": str(row.get("reason_ar", "")).strip() or "—",
            }
        )
    try:
        pc = int(data.get("people_count", 0))
    except (TypeError, ValueError):
        pc = 0
    for i, c in enumerate(checks_list):
        if c["key"] == "people_count":
            checks_list[i] = {**c, "reason_ar": f"العدد المقدَّر: {pc}. {c['reason_ar']}".strip()}
            break

    return _finalize_payload(
        provider="gemini",
        camera_name=camera_name,
        location=location,
        checks_in=checks_list,
        people_count_top=pc,
    )


def _analyze_demo(camera_name: str | None, location: str | None) -> dict[str, Any]:
    checks_list = [
        {"key": "mask", "label_ar": "الكمامة", "status": "violation", "confidence": 90, "reason_ar": "وضع تجريبي."},
        {"key": "gloves", "label_ar": "القفازات", "status": "safe", "confidence": 88, "reason_ar": "وضع تجريبي."},
        {"key": "headcover", "label_ar": "غطاء الرأس", "status": "uncertain", "confidence": 50, "reason_ar": "وضع تجريبي."},
        {"key": "uniform", "label_ar": "الزي الرسمي", "status": "safe", "confidence": 86, "reason_ar": "وضع تجريبي."},
        {"key": "wet_floor", "label_ar": "الأرضيات المبللة", "status": "safe", "confidence": 87, "reason_ar": "وضع تجريبي."},
        {
            "key": "trash_location",
            "label_ar": "موقع الحاويات",
            "status": "needs_review",
            "confidence": 70,
            "reason_ar": "وضع تجريبي: يحتاج مراجعة بشرية.",
        },
        {"key": "people_count", "label_ar": "عدد الأشخاص", "status": "safe", "confidence": 92, "reason_ar": "وضع تجريبي."},
    ]
    return _finalize_payload(
        provider="demo",
        camera_name=camera_name,
        location=location,
        checks_in=checks_list,
        people_count_top=2,
    )


def analyze_monitoring_frame(
    *,
    image_bytes: bytes,
    content_type: str | None,
    camera_name: str | None,
    location: str | None,
) -> dict[str, Any]:
    gemini_configured = bool((settings.GEMINI_API_KEY or "").strip())
    logger.info(
        "monitoring analyze: MONITORING_AI_DEMO_MODE=%s gemini_key_exists=%s bytes=%s",
        settings.MONITORING_AI_DEMO_MODE,
        gemini_configured,
        len(image_bytes),
    )

    if settings.MONITORING_AI_DEMO_MODE:
        if not image_bytes:
            raise ValueError("الصورة غير صالحة.")
        return _analyze_demo(camera_name, location)

    if not gemini_configured:
        raise ValueError("AI المراقبة غير مفعل. يرجى إضافة مفتاح Gemini API.")

    if not image_bytes:
        raise ValueError("الصورة غير صالحة.")
    if content_type and not str(content_type).startswith("image/"):
        raise ValueError("الصورة غير صالحة.")

    return _run_gemini_monitoring(image_bytes, camera_name, location)
