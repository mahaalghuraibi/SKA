# SKA custom food classifier (9 classes)

This folder holds **dataset layout**, **training scripts**, and **exported weights** for an optional on-premise classifier used by the backend when `SKA_CUSTOM_FOOD_MODEL_PATH` points to a trained file.

**Classes (English folder names — fixed order / indices):**

| Index | Folder   | Mapped Arabic (API) |
|------:|----------|---------------------|
| 0 | `fish`   | سمك |
| 1 | `chicken`| دجاج |
| 2 | `meat`   | لحم |
| 3 | `kebab`  | كباب |
| 4 | `pasta`  | مكرونة |
| 5 | `salad`  | سلطة |
| 6 | `rice`   | رز |
| 7 | `soup`   | شوربة |
| 8 | `bread`  | خبز |

The inference code in `app/services/custom_food_classifier.py` uses **ResNet18** with `num_classes=9`, matching this script.

---

## 1. Directory layout

```
ml/custom_food/
  README.md                 ← this file
  dataset/
    README.md
    raw/
      fish/
      chicken/
      meat/
      kebab/
      pasta/
      salad/
      rice/
      soup/
      bread/
  artifacts/                ← generated; gitignored (*.pt, images)
    ska_custom_food.pt      ← after training
    label_map.json          ← class order for inference
  scripts/
    train_custom_food.py
```

Large image files under `dataset/raw/` are **gitignored**; keep the empty class folders (or `.gitkeep`) in version control so the structure is clear.

---

## 2. How to collect images

Goal: **balanced**, **realistic** photos similar to production (same cameras, lighting, plating).

1. **One folder per class** under `dataset/raw/<class>/` using the exact names in the table above.
2. **Quantity**: aim for at least **30 images per class** before training (configurable via `SKA_CUSTOM_FOOD_MIN_IMAGES_PER_CLASS`). More is better (100+ per class for robustness).
3. **Diversity**:
   - Multiple angles (top-down, 45°, side).
   - Different trays, backgrounds, and portion sizes.
   - Include “hard” examples: partial occlusion, steam blur, mixed plates (pick the **dominant** category for the label).
4. **Consistency**:
   - **Kebab**: skewers, kofta, mixed grill where minced meat dominates.
   - **Meat**: steaks, chops, roasts (not minced kebab).
   - **Chicken**: whole bird, pieces, broasted — label as `chicken` even if rice is visible if chicken is the main protein you care about.
   - **Rice**: dominant rice bowl/plate; if protein dominates, label by protein instead.
5. **Privacy / compliance**: only use images you are allowed to store; avoid faces or sensitive metadata in filenames if not needed.
6. **Formats**: JPEG, PNG, or WebP.

---

## 3. Training (only when the dataset is ready)

Training **does not run** in the FastAPI app. Run the script manually or in CI.

From `ska-system/backend`:

```bash
python ml/custom_food/scripts/train_custom_food.py
```

Behavior:

- Counts images per class under `dataset/raw/<class>/`.
- If any folder is missing or below the minimum (default **30** per class), the script **prints counts, skips training**, and exits **0** (safe for scheduled jobs).
- If counts are sufficient, it trains a **ResNet18** head with ImageNet-pretrained backbone, validates on a random **15%** split, and writes:
  - `artifacts/ska_custom_food.pt` — `state_dict` only  
  - `artifacts/label_map.json` — `{"classes": ["fish", ...], "version": 1}`

Optional environment variable:

- `SKA_CUSTOM_FOOD_MIN_IMAGES_PER_CLASS` — raise to e.g. `50` or `100` for stricter gates.

CLI overrides:

```bash
python ml/custom_food/scripts/train_custom_food.py --epochs 20 --batch-size 32 --data-root ml/custom_food/dataset --output-dir ml/custom_food/artifacts
```

---

## 4. Enabling inference in the backend

After training, set absolute paths in `.env` (or your deployment secrets):

```env
SKA_CUSTOM_FOOD_MODEL_PATH=/absolute/path/to/ska-system/backend/ml/custom_food/artifacts/ska_custom_food.pt
SKA_CUSTOM_FOOD_LABEL_MAP_PATH=/absolute/path/to/ska-system/backend/ml/custom_food/artifacts/label_map.json
```

If `SKA_CUSTOM_FOOD_LABEL_MAP_PATH` is omitted, the server looks for `label_map.json` next to the weights file (same basename with `.json`) or the default `ml/custom_food/artifacts/label_map.json`.

**Pipeline order** (see `app/services/professional_dish_vision.py`): OpenAI → Gemini → **SKA custom** (if weights exist) → Food-101 (HF) → Roboflow.

The same **80% confidence gate** as other vision providers applies: below threshold, the API returns `طبق غير محدد` with `needs_review=true`.

---

## 5. Future improvements

- Add **class weights** if counts are imbalanced.
- Export **ONNX** for lighter runtimes (`onnxruntime`) and smaller deployments.
- Version **label_map.json** with a `model_version` field and enforce it in CI.
- Log **per-request latency** and **confidence histograms** to tune the minimum images threshold.
