"""
Downloads real PPE YOLO models for kitchen safety monitoring.

Primary model (keremberk_ppe.pt — YOLOv8m):
  Source : thalostech2025/keremberk_yolov8m_ppe on HuggingFace (public)
  Classes: glove, goggles, helmet, mask, no_* variants, shoes, etc.
  Size   : ~52 MB
  Use for: backend maps only kitchen checks (mask, gloves, headcover, uniform);
           goggles/shoes/trash outputs from weights are ignored in reports.

Fallback model (hansung_ppe.pt — YOLOv8n):
  Source : Hansung-Cho/yolov8-ppe-detection on HuggingFace (public)
  Classes: Hardhat, Mask, NO-Hardhat, NO-Mask, NO-Safety Vest,
           Person, Safety Cone, Safety Vest, machinery, vehicle
  Size   : ~6 MB
  Use for: lighter alternative; covers uniform/vest + person counting

Run from the backend/ directory:
  python3 ml/download_ppe_model.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODELS = [
    {
        "repo_id":   "thalostech2025/keremberk_yolov8m_ppe",
        "filename":  "best.pt",
        "dest_name": "keremberk_ppe.pt",
        "label":     "Primary (YOLOv8m — gloves + mask + headcover)",
        "primary":   True,
    },
    {
        "repo_id":   "Hansung-Cho/yolov8-ppe-detection",
        "filename":  "best.pt",
        "dest_name": "hansung_ppe.pt",
        "label":     "Fallback (YOLOv8n — mask + headcover + vest + person)",
        "primary":   False,
    },
]

EXPECTED_MIN_BYTES = 3_000_000


def _download_hf(repo_id: str, filename: str, dest: Path) -> bool:
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("  huggingface_hub not installed — pip install huggingface_hub")
        return False

    if dest.exists() and dest.stat().st_size >= EXPECTED_MIN_BYTES:
        print(f"  Already present: {dest}  ({dest.stat().st_size:,} bytes)")
        return True

    print(f"  Downloading {repo_id}/{filename} …", flush=True)
    try:
        cached = hf_hub_download(repo_id=repo_id, filename=filename, token=False)
        shutil.copy2(cached, dest)
        print(f"  Saved → {dest}  ({dest.stat().st_size:,} bytes)", flush=True)
        return True
    except Exception as exc:
        print(f"  FAILED: {exc}", flush=True)
        return False


def _verify(dest: Path) -> None:
    try:
        from ultralytics import YOLO
    except ImportError:
        print("  ultralytics not installed — pip install ultralytics")
        return

    model = YOLO(str(dest))
    names = model.names
    print(f"  Verified — {len(names)} classes: {list(names.values())}", flush=True)


def main() -> None:
    any_failed = False

    for spec in MODELS:
        dest = MODELS_DIR / spec["dest_name"]
        print(f"\n=== {spec['label']} ===", flush=True)
        ok = _download_hf(spec["repo_id"], spec["filename"], dest)
        if ok:
            _verify(dest)
        else:
            any_failed = True
            if spec["primary"]:
                print("  ERROR: primary model download failed.", file=sys.stderr)

    primary = MODELS_DIR / MODELS[0]["dest_name"]
    print("\n" + "=" * 60, flush=True)
    if primary.exists():
        print(f"Primary model ready: {primary.resolve()}", flush=True)
        print(f"\nSet in backend/.env:\n  YOLO_MODEL_PATH={primary.resolve()}", flush=True)
    else:
        print("Primary model NOT available. Check errors above.", file=sys.stderr)
        sys.exit(1)

    if any_failed:
        sys.exit(2)


if __name__ == "__main__":
    main()
