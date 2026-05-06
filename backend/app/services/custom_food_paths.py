"""Filesystem layout for the optional SKA custom food classifier (training + artifacts)."""

from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[2]
CUSTOM_FOOD_ROOT = _BACKEND_DIR / "ml" / "custom_food"
DEFAULT_DATASET_ROOT = CUSTOM_FOOD_ROOT / "dataset"
DEFAULT_RAW_ROOT = DEFAULT_DATASET_ROOT / "raw"
DEFAULT_ARTIFACTS_DIR = CUSTOM_FOOD_ROOT / "artifacts"
DEFAULT_LABEL_MAP_PATH = DEFAULT_ARTIFACTS_DIR / "label_map.json"
