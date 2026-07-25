# Tamil Inscription Translation Platform — Version Restoration & Maintenance Guide

## Overview
This guide provides instructions on how to access, inspect, compare, or completely restore the platform to the **`v2.0-perfect`** stable snapshot.

---

## 📌 Permanent Snapshot Information
- **Git Tag Name:** `v2.0-perfect`
- **Tagged Commit:** `ed54b2f9`
- **GitHub Repository:** `https://github.com/Jai-0709/tamil-script-translator`
- **Snapshot Date:** July 26, 2026

---

## 🛠️ How to Restore or Compare Code

### Option 1: Completely Reset Code to `v2.0-perfect` (Full Revert)
If future edits break functionality and you want to **100% revert all files back to this exact perfect state**, run:
```bash
git reset --hard v2.0-perfect
```

---

### Option 2: Temporarily Inspect/Test `v2.0-perfect`
If you want to view or test this version without deleting your ongoing changes, run:
```bash
git checkout v2.0-perfect
```
*(To return back to your main working branch later, simply run `git checkout main`).*

---

### Option 3: Compare Future Changes Against `v2.0-perfect`
To see exact line-by-line differences between future code and this calibrated version, run:
```bash
git diff v2.0-perfect
```

---

### Option 4: Create a New Feature Branch From `v2.0-perfect`
If you want to start a new experiment safely without affecting the main code, run:
```bash
git checkout -b my-new-experiment v2.0-perfect
```

---

## 🌐 Downloading via GitHub Web Interface
1. Open your repository: [https://github.com/Jai-0709/tamil-script-translator](https://github.com/Jai-0709/tamil-script-translator)
2. Click the **Tags** or **Releases** tab.
3. Select **`v2.0-perfect`**.
4. Click **Download ZIP** to get a clean, standalone copy of this exact working version at any time!
