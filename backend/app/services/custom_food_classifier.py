"""
Optional SKA custom 9-way food classifier (fish, chicken, meat, kebab, pasta, salad, rice, soup, bread).

Loads weights from SKA_CUSTOM_FOOD_MODEL_PATH when the file exists. Does not train here.
"""

from __future__ import annotations

import io
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from app.core.config import settings
from app.services.custom_food_paths import DEFAULT_LABEL_MAP_PATH

logger = logging.getLogger(__name__)

# Training script must use the same order (class index = row in softmax).
CUSTOM_CLASS_ORDER: tuple[str, ...] = (
    "fish",
    "chicken",
    "meat",
    "kebab",
    "pasta",
    "salad",
    "rice",
    "soup",
    "bread",
)

EN_TO_AR: dict[str, str] = {
    "fish": "سمك",
    "chicken": "دجاج",
    "meat": "لحم",
    "kebab": "كباب",
    "pasta": "مكرونة",
    "salad": "سلطة",
    "rice": "رز",
    "soup": "شوربة",
    "bread": "خبز",
}

_ska_model: Any = None
_ska_classes: list[str] | None = None


def _label_map_path() -> Path | None:
    explicit = (settings.SKA_CUSTOM_FOOD_LABEL_MAP_PATH or "").strip()
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    model_p = (settings.SKA_CUSTOM_FOOD_MODEL_PATH or "").strip()
    if model_p:
        stem = Path(model_p).with_suffix(".json")
        if stem.is_file():
            return stem
    if DEFAULT_LABEL_MAP_PATH.is_file():
        return DEFAULT_LABEL_MAP_PATH
    return None


def _load_classes() -> list[str]:
    global _ska_classes
    if _ska_classes is not None:
        return _ska_classes
    lp = _label_map_path()
    if lp and lp.is_file():
        data = json.loads(lp.read_text(encoding="utf-8"))
        classes = data.get("classes")
        if isinstance(classes, list) and len(classes) == len(CUSTOM_CLASS_ORDER):
            _ska_classes = [str(c) for c in classes]
            return _ska_classes
    _ska_classes = list(CUSTOM_CLASS_ORDER)
    return _ska_classes


def _build_resnet18(num_classes: int) -> Any:
    import torch
    from torchvision import models

    m = models.resnet18(weights=None)
    m.fc = torch.nn.Linear(m.fc.in_features, num_classes)
    return m


def _load_torch_model(weights_path: Path, num_classes: int) -> Any:
    import torch

    model = _build_resnet18(num_classes)
    try:
        state = torch.load(weights_path, map_location="cpu", weights_only=True)
    except TypeError:
        state = torch.load(weights_path, map_location="cpu")
    if isinstance(state, dict) and "state_dict" in state:
        model.load_state_dict(state["state_dict"], strict=True)
    else:
        model.load_state_dict(state, strict=True)
    model.eval()
    return model


def _preprocess_pil(img: Image.Image) -> Any:
    import torch
    from torchvision import transforms

    t = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    x = t(img.convert("RGB")).unsqueeze(0)
    return x


def run_custom_classifier(image_bytes: bytes) -> dict[str, Any] | None:
    """
    Run local ResNet18 head if SKA_CUSTOM_FOOD_MODEL_PATH points to a .pt state file.
    Returns {"label": str, "confidence": float, "scores": dict[str, float]} or None if disabled / missing.
    """
    global _ska_model
    path_str = (settings.SKA_CUSTOM_FOOD_MODEL_PATH or "").strip()
    if not path_str:
        return None
    weights_path = Path(path_str)
    if not weights_path.is_file():
        logger.info("SKA custom food: model path not found (%s), skipping", weights_path)
        return None

    classes = _load_classes()
    if len(classes) != len(CUSTOM_CLASS_ORDER):
        logger.warning("SKA custom food: label_map classes length mismatch; expected %s", len(CUSTOM_CLASS_ORDER))
        return None

    try:
        import torch
    except ImportError:
        logger.warning("SKA custom food: torch not installed; skipping")
        return None

    try:
        if _ska_model is None:
            _ska_model = _load_torch_model(weights_path, len(classes))
        img = Image.open(io.BytesIO(image_bytes))
        batch = _preprocess_pil(img)
        with torch.no_grad():
            logits = _ska_model(batch)
            probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()
    except Exception as exc:
        logger.warning("SKA custom food inference failed: %s", exc)
        return None

    idx = int(np.argmax(probs))
    label = classes[idx] if 0 <= idx < len(classes) else classes[0]
    confidence = float(probs[idx])
    scores = {classes[i]: float(probs[i]) for i in range(len(classes))}
    return {"label": label, "confidence": confidence, "scores": scores}
