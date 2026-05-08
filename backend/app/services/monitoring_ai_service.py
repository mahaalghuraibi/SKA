"""
Kitchen safety monitoring: Gemini Vision only (when not in demo mode).
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

# Prompt in English for reliable JSON output; Arabic used only in label/reason fields.
GEMINI_PROMPT_MONITORING = """You are a kitchen food-safety compliance inspector. Analyze the image and assess each safety item based on what you can observe.

STATUS DEFINITIONS:
- "safe"         : the requirement is clearly met.
- "violation"    : you can observe that the requirement is NOT being followed.
- "needs_review" : partially visible or ambiguous — something looks wrong but you cannot be certain.
- "uncertain"    : the item is completely outside the frame or totally unobservable.

CONFIDENCE SCALE (integer 0-100):
- 85-100 : very clear, unambiguous observation.
- 65-84  : reasonably visible, some minor ambiguity.
- 40-64  : partial or obscured view.
- 0-39   : very unclear or not in frame.

VIOLATION DETECTION RULES — report "violation" when:
- mask       : a person's face is clearly visible and they are NOT wearing a mask or face covering.
- gloves     : hands are visible and clearly bare during food contact or food preparation.
- headcover  : hair is clearly visible without any cap, hairnet, or head covering.
- uniform    : person is clearly wearing civilian clothing instead of a proper food-service uniform.
- wet_floor  : floor surface is visibly wet, slippery, or has liquid spills with no warning sign.
- trash_location : waste, garbage, or trash container is in or near the food preparation area.

Use "uncertain" only when the item is completely outside the frame. If you can see any part of a person, assess mask/gloves/headcover/uniform as best you can with an appropriate confidence.

Return JSON ONLY — no markdown fences, no text outside the JSON object:
{
  "people_count": <integer, number of people visible>,
  "checks": [
    {
      "key": "mask",
      "label_ar": "الكمامة",
      "status": "safe" | "violation" | "needs_review" | "uncertain",
      "status_ar": "سليم" | "مخالفة" | "يحتاج مراجعة" | "غير مؤكد",
      "confidence": <integer 0-100>,
      "reason_ar": "<one Arabic sentence describing exactly what you observe>"
    }
  ]
}

Include exactly one entry per key in this order: mask, gloves, headcover, uniform, wet_floor, trash_location, people_count.
"""

_NOT_VISIBLE_HINT = re.compile(
    r"not\s+visible|cannot\s+see|unclear|not\s+shown|not\s+clear|"
    r"غير\s+ظاهر|غير\s+واضح|لا\s+يظهر|لا\s+تظهر|غير\s+مرئي|لا\s+يمكن",
    re.IGNORECASE,
)

# Minimum confidence (0-100) for a Gemini "violation" to be recorded.
# Using the original AI status before display-bucketing so 65-84% violations
# are not silently dropped by the ≥85 display threshold.
_VIOLATION_CONF_THRESHOLD = 65


def _parse_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    t = text.strip()
    # Strip markdown code fences if present
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t, re.IGNORECASE)
    if fence:
        t = fence.group(1).strip()
    try:
        obj = json.loads(t)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    # Try extracting the first {...} block
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
    """Map raw AI status + confidence to a display status bucket.

    ≥85 : violation or safe preserved; 60–84 : needs_review; <60 : uncertain.
    """
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
    """Downgrade impossible 'safe' calls when the reason admits poor visibility."""
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
    # Track the original AI status (before display bucketing) so violation
    # detection is not blocked by the stricter ≥85 display threshold.
    original_status_by_key: dict[str, tuple[str, int]] = {}
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
        original_status_by_key[key] = (raw_status, conf)
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

    # People count
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

    vtypes_from_checks = {
        "mask": "no_mask",
        "gloves": "no_gloves",
        "headcover": "no_headcover",
        "uniform": "no_uniform",
        "wet_floor": "wet_floor",
        "trash_location": "trash_location",
    }

    violations_out: list[dict[str, Any]] = []
    existing_types: set[str] = set()

    for row in checks_out:
        if row["key"] == "people_count":
            continue
        # Use original AI status (before display bucketing) so a "violation" at
        # 65-84% confidence is not silently lost when bucketed to "needs_review".
        orig_status, conf = original_status_by_key.get(row["key"], ("uncertain", 0))
        logger.debug("check key=%s orig=%s conf=%d disp=%s", row["key"], orig_status, conf, row["status"])
        if orig_status == "violation" and conf >= _VIOLATION_CONF_THRESHOLD:
            vt = vtypes_from_checks.get(row["key"])
            if vt and vt not in existing_types:
                reason = row["reason_ar"]
                violations_out.append(
                    {
                        "type": vt,
                        "label_ar": VIOLATION_TYPE_LABELS.get(vt, row["label_ar"]),
                        "confidence": conf,
                        "reason_ar": reason,
                        "description": reason,   # human-readable alias
                        "status": "new",
                    }
                )
                existing_types.add(vt)
                logger.info("violation recorded: type=%s conf=%d", vt, conf)
                if not needs_review_any:
                    needs_review_any = True

    overall = int(round(sum(confidences) / max(1, len(confidences)))) if confidences else 0

    # Build a plain-language Arabic summary
    vcount = len(violations_out)
    if vcount > 0:
        summary = f"تم اكتشاف {vcount} مخالفة."
    elif needs_review_any:
        summary = "بعض الفحوصات تحتاج مراجعة."
    else:
        summary = "لم يتم اكتشاف مخالفات."

    logger.info(
        "finalize: provider=%s violations=%d needs_review=%s overall_conf=%d summary=%s",
        provider, vcount, needs_review_any, overall, summary,
    )

    return {
        "ok": True,
        "status": "ok",
        "provider": provider,
        "camera_name": camera_name,
        "location": location,
        "people_count": people_count,
        "overall_confidence": overall,
        "needs_review": needs_review_any,
        "checks": checks_out,
        "violations": violations_out,
        "summary": summary,
    }


def _gemini_model_candidates() -> list[str]:
    """Ordered list of model ids to try (configured first, then stable fallbacks)."""
    configured = (settings.MONITORING_GEMINI_MODEL or settings.GEMINI_VISION_MODEL or "").strip()
    # Prefer 2.5 models — they have separate quota from 2.0 on the free tier.
    fallbacks = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    ]
    out: list[str] = []
    for m in [configured, *fallbacks] if configured else fallbacks:
        if m and m not in out:
            out.append(m)
    return out


def _friendly_gemini_error(last_err: Exception | None) -> str:
    if last_err is None:
        return "فشل تحليل الصورة عبر Gemini."
    text = str(last_err)
    low = text.lower()
    if (
        "api_key_invalid" in low
        or "invalid api key" in low
        or "api key not valid" in low
        or "permission_denied" in low
        or "reported as leaked" in low
    ):
        return "مفتاح Gemini غير صحيح أو غير مفعّل. تحقق من MONITORING_GEMINI_API_KEY في backend/.env"
    if (
        "not_found" in low
        or "model is not found" in low
        or "not supported for generatecontent" in low
    ):
        return "الموديل غير مدعوم لهذا المفتاح أو نسخة API. تحقق من MONITORING_GEMINI_MODEL في backend/.env"
    if "resource_exhausted" in low or "quota exceeded" in low:
        return "انتهت كوتا Gemini أو تحتاج تفعيل billing. تحقق من حسابك في console.cloud.google.com"
    return "فشل تحليل الصورة عبر Gemini."


def _run_gemini_monitoring(image_bytes: bytes, camera_name: str | None, location: str | None) -> dict[str, Any]:
    key = (settings.MONITORING_GEMINI_API_KEY or settings.GEMINI_API_KEY or "").strip()
    if not key:
        raise ValueError("AI المراقبة غير مفعل. يرجى إضافة مفتاح Gemini API.")

    model_candidates = _gemini_model_candidates()
    logger.info(
        "monitoring gemini: models_to_try=%s image_bytes=%d demo_mode=%s",
        model_candidates, len(image_bytes), settings.MONITORING_AI_DEMO_MODE,
    )

    try:
        from PIL import Image
    except ImportError:
        logger.warning("monitoring: Pillow missing")
        raise ValueError(
            "تعذر تحميل مكتبات الذكاء الاصطناعي على الخادم. "
            "في مجلد backend نفّذ: pip install Pillow"
        ) from None

    # Decode and re-encode as JPEG for consistent Gemini input
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        jpeg_bytes = buf.getvalue()
        logger.info("monitoring gemini: jpeg_bytes=%d", len(jpeg_bytes))
    except Exception as exc:
        logger.warning("monitoring gemini: image decode failed: %s", exc)
        raise ValueError("الصورة غير صالحة.") from exc

    last_err: Exception | None = None
    resp_text = ""
    used_model = ""
    # Try modern SDK first (google-genai), then fallback to legacy (google-generativeai).
    try:
        from google import genai
        from google.genai import types as genai_types

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
            call_config = genai_types.GenerateContentConfig(safety_settings=safety_off)
        except Exception:
            call_config = None

        for model_name in model_candidates:
            try:
                img_part = genai_types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")
                if call_config is not None:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=[GEMINI_PROMPT_MONITORING, img_part],
                        config=call_config,
                    )
                else:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=[GEMINI_PROMPT_MONITORING, img_part],
                    )
                used_model = model_name
                last_err = None
                try:
                    resp_text = (resp.text or "").strip()
                except Exception:
                    candidates = getattr(resp, "candidates", None) or []
                    if candidates:
                        content = getattr(candidates[0], "content", None)
                        parts = getattr(content, "parts", None) or [] if content else []
                        resp_text = "".join(getattr(p, "text", None) or "" for p in parts).strip()
                if resp_text:
                    break
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "monitoring gemini(request/new-sdk) failed model=%s: %s — %s",
                    model_name,
                    type(exc).__name__,
                    exc,
                )
                continue
    except ImportError:
        logger.info("monitoring: google-genai not available, trying google-generativeai fallback")

    if not resp_text:
        try:
            import google.generativeai as legacy_genai

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
                    resp = model.generate_content([GEMINI_PROMPT_MONITORING, pil_image])
                    used_model = model_name
                    last_err = None
                    resp_text = str(getattr(resp, "text", "") or "").strip()
                    if resp_text:
                        break
                except Exception as exc:
                    last_err = exc
                    logger.warning(
                        "monitoring gemini(request/legacy-sdk) failed model=%s: %s — %s",
                        model_name,
                        type(exc).__name__,
                        exc,
                    )
                    continue
        except ImportError as exc:
            last_err = exc

    if not resp_text:
        friendly = _friendly_gemini_error(last_err)
        hint = (
            "تحقق من MONITORING_GEMINI_API_KEY وMONITORING_GEMINI_MODEL في backend/.env، "
            "وتأكد من تثبيت مكتبة واحدة على الأقل: google-genai أو google-generativeai."
        )
        err_bit = f" ({type(last_err).__name__})" if last_err else ""
        logger.error("monitoring gemini: all model attempts failed%s", err_bit)
        raise ValueError(
            f"{friendly}{err_bit} {hint}"
        ) from last_err
    logger.info("monitoring gemini: success with model=%s", used_model)

    logger.info("monitoring gemini: response_len=%d", len(resp_text))
    if resp_text:
        logger.debug("monitoring gemini: raw_text_preview=%.500s", resp_text)

    data = _parse_json_object(resp_text)
    if not data:
        logger.warning("monitoring gemini: JSON parse failed — uncertain fallback. raw=%.500s", resp_text)
        return _finalize_payload(
            provider="gemini",
            camera_name=camera_name,
            location=location,
            checks_in=[],
            people_count_top=0,
        )

    logger.info("monitoring gemini: parsed checks=%d people=%s", len(data.get("checks") or []), data.get("people_count"))

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
            checks_list[i] = {**c, "reason_ar": f"العدد المقدَّر: {pc}. {c['reason_ar']}".strip()}
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
        {"key": "mask",           "label_ar": "الكمامة",           "status": "violation",    "confidence": 90, "reason_ar": "وضع تجريبي."},
        {"key": "gloves",         "label_ar": "القفازات",          "status": "safe",         "confidence": 88, "reason_ar": "وضع تجريبي."},
        {"key": "headcover",      "label_ar": "غطاء الرأس",        "status": "uncertain",    "confidence": 50, "reason_ar": "وضع تجريبي."},
        {"key": "uniform",        "label_ar": "الزي الرسمي",       "status": "safe",         "confidence": 86, "reason_ar": "وضع تجريبي."},
        {"key": "wet_floor",      "label_ar": "الأرضيات المبللة",  "status": "safe",         "confidence": 87, "reason_ar": "وضع تجريبي."},
        {"key": "trash_location", "label_ar": "موقع الحاويات",     "status": "needs_review", "confidence": 70, "reason_ar": "وضع تجريبي: يحتاج مراجعة بشرية."},
        {"key": "people_count",   "label_ar": "عدد الأشخاص",       "status": "safe",         "confidence": 92, "reason_ar": "وضع تجريبي."},
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
    gemini_configured = bool((settings.MONITORING_GEMINI_API_KEY or settings.GEMINI_API_KEY or "").strip())
    logger.info(
        "analyze_monitoring_frame: demo=%s gemini_configured=%s content_type=%s bytes=%d",
        settings.MONITORING_AI_DEMO_MODE, gemini_configured,
        content_type or "—", len(image_bytes),
    )

    if settings.MONITORING_AI_DEMO_MODE:
        if not image_bytes:
            raise ValueError("الصورة غير صالحة.")
        return _analyze_demo(camera_name, location)

    if not gemini_configured:
        raise ValueError("AI المراقبة غير مفعل. يرجى إضافة مفتاح Gemini API.")

    if not image_bytes:
        raise ValueError("الصورة غير صالحة.")
    # Browsers / proxies sometimes send application/octet-stream; PIL validates real image bytes.
    ct = (content_type or "").strip().lower()
    if ct and not ct.startswith("image/") and ct not in (
        "application/octet-stream",
        "binary/octet-stream",
    ):
        raise ValueError("الصورة غير صالحة.")

    return _run_gemini_monitoring(image_bytes, camera_name, location)
