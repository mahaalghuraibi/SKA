#!/usr/bin/env python3
"""
Train the optional SKA 9-class food classifier (ResNet18).

Does nothing destructive if the dataset is missing or too small per class.
Requires: torch, torchvision, Pillow (same stack as the backend).

Usage (from repo):
  cd ska-system/backend
  python ml/custom_food/scripts/train_custom_food.py

Optional env:
  SKA_CUSTOM_FOOD_MIN_IMAGES_PER_CLASS  (default: 30)
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CUSTOM_FOOD_ROOT = SCRIPT_DIR.parent
DEFAULT_RAW = CUSTOM_FOOD_ROOT / "dataset" / "raw"
DEFAULT_OUT = CUSTOM_FOOD_ROOT / "artifacts"

CLASSES: tuple[str, ...] = (
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

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".JPG", ".JPEG", ".PNG", ".WEBP"}


def _list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    out: list[Path] = []
    for p in folder.iterdir():
        if p.is_file() and p.suffix in IMAGE_EXTS:
            out.append(p)
    return sorted(out)


def _check_dataset(raw_root: Path, min_per_class: int) -> tuple[bool, dict[str, int], str]:
    counts: dict[str, int] = {}
    missing_dirs: list[str] = []
    for c in CLASSES:
        d = raw_root / c
        if not d.is_dir():
            missing_dirs.append(c)
            counts[c] = 0
            continue
        counts[c] = len(_list_images(d))

    if missing_dirs:
        return False, counts, f"Missing class folders under {raw_root}: {', '.join(missing_dirs)}"

    unders = [c for c in CLASSES if counts[c] < min_per_class]
    if unders:
        return (
            False,
            counts,
            f"Each class needs at least {min_per_class} images. Under-filled: "
            + ", ".join(f"{c}({counts[c]})" for c in unders),
        )
    return True, counts, ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Train SKA custom 9-class food model (only if dataset is sufficient).")
    parser.add_argument("--data-root", type=Path, default=DEFAULT_RAW.parent, help="Dataset root (expects raw/<class>/)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT, help="Where to write weights + label_map.json")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--val-fraction", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    raw_root = args.data_root / "raw"
    min_per = int(os.getenv("SKA_CUSTOM_FOOD_MIN_IMAGES_PER_CLASS", "30"))

    ok, counts, msg = _check_dataset(raw_root, min_per)
    print("Dataset check (raw root):", raw_root)
    for c in CLASSES:
        print(f"  {c}: {counts.get(c, 0)} images")
    if not ok:
        print("\n[skip] Training not started:", msg)
        print("Collect more images (see ml/custom_food/README.md), then re-run this script.")
        return 0

    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, Dataset
        from torchvision import models, transforms
        from PIL import Image
    except ImportError as exc:
        print("Missing dependency:", exc, file=sys.stderr)
        print("Install: pip install torch torchvision Pillow", file=sys.stderr)
        return 1

    random.seed(args.seed)
    torch.manual_seed(args.seed)

    class FileListDataset(Dataset):
        def __init__(self, pairs: list[tuple[Path, int]], transform_img):
            self.pairs = pairs
            self.transform_img = transform_img

        def __len__(self) -> int:
            return len(self.pairs)

        def __getitem__(self, idx: int):
            path, y = self.pairs[idx]
            img = Image.open(path).convert("RGB")
            return self.transform_img(img), y

    train_tf = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    val_tf = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    all_pairs: list[tuple[Path, int]] = []
    for i, c in enumerate(CLASSES):
        for p in _list_images(raw_root / c):
            all_pairs.append((p, i))
    random.shuffle(all_pairs)
    n_val = max(1, int(len(all_pairs) * args.val_fraction))
    val_pairs = all_pairs[:n_val]
    train_pairs = all_pairs[n_val:]

    train_ds = FileListDataset(train_pairs, train_tf)
    val_ds = FileListDataset(val_pairs, val_tf)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=0)

    weights_enum = models.ResNet18_Weights.IMAGENET1K_V1
    model = models.resnet18(weights=weights_enum)
    model.fc = nn.Linear(model.fc.in_features, len(CLASSES))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    crit = nn.CrossEntropyLoss()
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)

    def run_epoch(loader, train_mode: bool) -> float:
        if train_mode:
            model.train()
        else:
            model.eval()
        total_loss = 0.0
        n = 0
        correct = 0
        total = 0
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            if train_mode:
                opt.zero_grad()
            with torch.set_grad_enabled(train_mode):
                logits = model(x)
                loss = crit(logits, y)
            if train_mode:
                loss.backward()
                opt.step()
            total_loss += float(loss.item()) * x.size(0)
            pred = logits.argmax(dim=1)
            correct += int((pred == y).sum().item())
            total += x.size(0)
            n += x.size(0)
        return total_loss / max(n, 1), correct / max(total, 1)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    weights_path = args.output_dir / "ska_custom_food.pt"
    label_path = args.output_dir / "label_map.json"

    best_acc = 0.0
    best_state = None
    for epoch in range(1, args.epochs + 1):
        tr_loss, tr_acc = run_epoch(train_loader, True)
        va_loss, va_acc = run_epoch(val_loader, False)
        print(f"Epoch {epoch}/{args.epochs}  train loss={tr_loss:.4f} acc={tr_acc:.3f}  val loss={va_loss:.4f} acc={va_acc:.3f}")
        if va_acc >= best_acc:
            best_acc = va_acc
            best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}

    if best_state is None:
        print("No weights captured; aborting.", file=sys.stderr)
        return 1

    torch.save(best_state, weights_path)
    label_path.write_text(
        json.dumps({"classes": list(CLASSES), "version": 1}, indent=2),
        encoding="utf-8",
    )
    print(f"\n[done] Saved weights: {weights_path}")
    print(f"[done] Saved labels:  {label_path}")
    print(f"Best val accuracy (approx): {best_acc:.3f}")
    print("\nSet in .env for inference:")
    print(f'  SKA_CUSTOM_FOOD_MODEL_PATH="{weights_path.resolve()}"')
    print(f'  SKA_CUSTOM_FOOD_LABEL_MAP_PATH="{label_path.resolve()}"')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
