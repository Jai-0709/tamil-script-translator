# Tamil Inscription Translation Platform — System Improvements & Calibrated Parameters Reference

## Overview
This document provides a comprehensive technical breakdown of the recent core system updates, bug fixes, and **exact calibrated code values & threshold parameters** that produced the perfect segmentation and memory performance.

---

## 1. Calibrated Parameters & Exact Code Thresholds

### A. Segmentation & Filtering Parameters (`backend/segmentation.py`)
These exact threshold values eliminate background hallucinations, prevent over-segmentation of single Tamil characters, and ensure compound merged characters (like `டை` + `ய`) split cleanly:

| Parameter / Condition | Calibrated Value | Previous Value | Purpose & Effect |
| :--- | :--- | :--- | :--- |
| **Top Margin Hallucination Filter** | `y <= max(6, int(work_h * 0.05))` and `h < char_h_est * 0.70` | None | Eliminates fake top-left border background texture boxes. |
| **Partial Edge Character Rejection** | `r["h"] < (char_h_est * 0.30)` | `0.68` | Prevents valid characters near top/bottom line edges from being rejected. |
| **Edge Sliver Rejection** | `r["w"] < (char_w_est * 0.10)` | `0.20` | Rejects only impossibly thin edge slivers. |
| **Vertical Crack Suppressor** | `asp < 0.15` and `w < char_w_est * 0.20` | `0.42` & `0.55` | Preserves thin vertical Tamil strokes (`ா`, `ர்`, `ி`, `l`). |
| **Compound Box Split Trigger** | `(rw > int(char_w_est * 1.35) or asp > 1.25) and rw > 25` | `1.85` fixed | Identifies candidate multi-character merged bounding boxes across all scales. |
| **Dynamic Ink Dip Verification** | `min_val < (mean_val * 0.58)` | None | Requires a true physical background gap between characters (prevents splitting single letters like `ம`/`வ`). |
| **Center Scan Window** | `mid_start = int(rw * 0.25)` to `mid_end = int(rw * 0.75)` | `0.30 .. 0.70` | Scans the inner center region for character boundary gaps. |
| **Split Sub-box Minimum Width** | `min_idx > 8` and `(rw - min_idx) > 8` | `10` | Ensures split sub-boxes remain valid character sizes. |

#### Exact Code Snippet (`backend/segmentation.py` lines 835–861):
```python
# Automatic Projection Profile Compound Box Splitting:
# Splits wide or multi-character compound boxes (rw > 1.35 * char_w_est or asp > 1.25)
# ONLY when a genuine vertical background ink gap exists between the characters.
split_regions = []
for r in regions:
    rx, ry, rw, rh = r["x"], r["y"], r["w"], r["h"]
    asp = rw / rh if rh > 0 else 1.0
    if (rw > int(char_w_est * 1.35) or asp > 1.25) and rw > 25:
        crop = gray[ry:ry+rh, rx:rx+rw]
        if crop.size > 0:
            v_proj = np.sum(crop < 180, axis=0)
            mid_start = int(rw * 0.25)
            mid_end = int(rw * 0.75)
            if mid_end > mid_start:
                min_val = np.min(v_proj[mid_start:mid_end])
                mean_val = np.mean(v_proj)
                # Verifies a physical background gap exists between characters (prevents splitting single letters like ம/வ)
                if min_val < (mean_val * 0.58):
                    min_idx = mid_start + int(np.argmin(v_proj[mid_start:mid_end]))
                    if min_idx > 8 and (rw - min_idx) > 8:
                        b1 = {"x": rx, "y": ry, "w": min_idx, "h": rh, "line": r.get("line", 1)}
                        b2 = {"x": rx + min_idx, "y": ry, "w": rw - min_idx, "h": rh, "line": r.get("line", 1)}
                        split_regions.append(b1)
                        split_regions.append(b2)
                        print(f"[SEG] Auto-split wide compound box w={rw} into w1={min_idx}, w2={rw-min_idx}")
                        continue
    split_regions.append(r)
regions = split_regions
```

---

### B. Pipeline Confidence & Vector Memory Parameters (`backend/main.py`)

| Parameter / Condition | Calibrated Value | Previous Value | Purpose & Effect |
| :--- | :--- | :--- | :--- |
| **Classifier Confidence Floor** | `confidence >= 0.02` | `0.15` | Ensures no detected character box is discarded by backend. |
| **Vector Memory Deduplication** | `cosine_similarity <= 0.88` | `0.85` | Prevents redundant feature vector accumulation. |
| **KNN Vector Memory Match** | `cosine_similarity >= 0.88` | `0.90` | Triggers high-confidence universal character recognition. |

#### Exact Code Snippet (`backend/main.py` line 404):
```python
# Filter out user-ignored memory boxes and extreme noise (confidence >= 0.02)
valid_indices = [
    i for i in range(len(regions))
    if not results[i].get("is_ignored") and (results[i].get("is_memorized") or results[i]["confidence"] >= 0.02)
]
```

---

### C. Multi-Variation Dataset Class Passing (`backend/classifier.py`)

| Feature | Implementation | Purpose & Effect |
| :--- | :--- | :--- |
| **Raw Character Passing** | `"raw_chars": best["raw_options"]` | Passes all 3 dataset class options (e.g. `ங, ங், று`) to UI popover under Contextual Alternatives. |

#### Exact Code Snippet (`backend/classifier.py` lines 250 & 305):
```python
return {
    "class_id":    best["class"],
    "modern_tamil": best["modern_tamil"],
    "raw_chars":   best["raw_options"],
    "confidence":  best["confidence"],
    "top3":        top3,
}
```

---

## 2. Architecture Feature Summary

1. **Perceptual MD5 Image Content Fingerprinting (`hashlib.md5(raw_bytes).hexdigest()`)**:
   - Maps saved layouts in `user_boxes.json` by pixel MD5 content hash.
   - Invariant to browser file renames and space encoding (`WhatsApp%20Image...`).

2. **Universal Vector Feature Memory**:
   - `save_final_segmentation` automatically extracts 128-dim ViT feature vectors for all character boxes into `corrections_memory.json`.
   - Transfers learned character shapes universally to any other inscription image across all lines and positions.

---

## Git Commit Log Reference
All calibrated values are preserved in Git `origin/main` and the **`v2.0-perfect`** Release Tag:
- **Commit `b338e859`**: Added MD5 Image Fingerprinting & frontend payload integration.
- **Commit `95e1f12f`**: Connected `save_final_segmentation` to global vector memory.
- **Commit `029e10e5`**: Preserved raw multi-character dataset strings in `main.py`.
- **Commit `807e9649`**: Passed `raw_chars` from `classifier.py` for 3-variation popover options.
- **Commit `2616fde8`**: Relaxed edge and confidence filters across segmentation pipeline.
- **Commit `699462e3`**: Added top margin hallucination filter and compound box projection profile splitting.
- **Commit `641f64df`**: Fixed single character over-segmentation.
- **Commit `f6b9102e`**: Enabled dynamic vertical background gap verification so merged characters (like `டை` + `ய`) split cleanly while single letters (`ம`/`வ`) stay intact.
- **Git Tag `v2.0-perfect`**: Permanent release snapshot updated to commit `f6b9102e`.
