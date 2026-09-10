# NETRA Integration Execution Report: Person 1 Detection Module Merge

**Document:** `README_INTEGRATION_REPORT.md`  
**Date:** September 10, 2026  
**Author:** Vivaan (Person 2 - Redaction & UI)  
**Reference Document:** `INTEGRATION_PROMPT_FOR_VIVAAN_FINAL.md`  
**Branch:** `person2-redaction-ui`  

---

## Executive Summary

Person 1's detection module (YuNet Face Detection, Tesseract.js OCR, PII classifier, and detection tests) has been integrated into `person2-redaction-ui`. All 6 directives from `INTEGRATION_PROMPT_FOR_VIVAAN_FINAL.md` were executed sequentially. 

Every command was checked directly against the local filesystem and test runners. All 32 unit tests across detection and redaction pass with zero failures.

---

## Step 1: Branch Verification & `git pull origin main`

### 1.1 Pre-Flight Check
* **Active Branch:** `person2-redaction-ui`
* **Local State:** Clean working tree (untracked: `INTEGRATION_PROMPT_FOR_VIVAAN_FINAL.md`).

### 1.2 Divergent Branch Reconcile (Quirk Encountered)
When running `git pull origin main`, Git returned:
```text
From github.com:sanyamagarwal8055/Netra
 * branch            main       -> FETCH_HEAD
   c33107e..a47a14b  main       -> origin/main
hint: You have divergent branches and need to specify how to reconcile them.
fatal: Need to specify how to reconcile divergent branches.
```
* **Reason:** Person 2 had local commits on `person2-redaction-ui` while Person 1 had committed and merged to `main`. Git modern defaults require an explicit reconciliation strategy.
* **Resolution:** Reconciled via merge strategy (`git merge origin/main --no-edit`). The merge completed cleanly with **0 conflicts** via the `ort` strategy.

### 1.3 Files Changed / Merged
**31 files changed, 3,336 insertions(+), 6 deletions(-)**:
* **Models & Weights:**
  * `models/face_detection_yunet_2023mar.onnx` (232,589 bytes)
  * `models/README.md`
* **Configuration & Scripts:**
  * `package.json` & `package-lock.json`
  * `scripts/copy-ort-wasm.mjs`
  * `scripts/copy-tesseract-assets.mjs`
  * `scripts/check-detection.mjs`
  * `scripts/make-pii-test-image.mjs`
  * `scripts/package.json` & `scripts/package-lock.json`
* **Test Fixtures:**
  * `scripts/test-images/apollo11-crew.*`
  * `scripts/test-images/crab-nebula.*`
  * `scripts/test-images/obama-official-portrait.*`
  * `scripts/test-images/pii-test-easy.*`
  * `scripts/test-images/pii-test-hard.*`
* **Detection Implementation:**
  * `src/detection/faceDetector.js`
  * `src/detection/ocr.js`
  * `src/detection/piiClassifier.js`
  * `src/detection/index.js`
* **Detection Unit Tests:**
  * `tests/detection/faceDetector.test.js`
  * `tests/detection/ocr.test.js`
  * `tests/detection/piiClassifier.test.js`
  * `tests/detection/index.test.js`

---

## Step 2: `npm install` & Dependency Confirmation

1. Executed `npm install`.
   * Result: Added 31 packages, audited 76 packages (exit code `0`).
2. Confirmed existence directly in `node_modules`:
   ```bash
   $ ls -ld node_modules/onnxruntime-web node_modules/tesseract.js
   drwxrwxr-x 5 vivaan vivaan 4096 Sep 10 19:35 node_modules/onnxruntime-web
   drwxrwxr-x 7 vivaan vivaan 4096 Sep 10 19:34 node_modules/tesseract.js
   ```
   Both libraries are confirmed present on disk.

---

## Step 3: Asset Generation (`models/ort-wasm/` & `models/tesseract/`)

### 3.1 `npm run build:wasm`
* **Command:** `node scripts/copy-ort-wasm.mjs`
* **Console Output:** `Copied 8/8 onnxruntime-web wasm asset(s) to models/ort-wasm/`
* **Filesystem Inspection (`models/ort-wasm/`):** 8 files verified (~81.8 MB total):
  * `ort-wasm-simd-threaded.asyncify.mjs` (51,407 B)
  * `ort-wasm-simd-threaded.asyncify.wasm` (25,749,873 B)
  * `ort-wasm-simd-threaded.jsep.mjs` (46,676 B)
  * `ort-wasm-simd-threaded.jsep.wasm` (27,797,172 B)
  * `ort-wasm-simd-threaded.jspi.mjs` (49,268 B)
  * `ort-wasm-simd-threaded.jspi.wasm` (16,025,636 B)
  * `ort-wasm-simd-threaded.mjs` (24,218 B)
  * `ort-wasm-simd-threaded.wasm` (13,961,845 B)

### 3.2 `npm run build:tesseract` (Issue Encountered & Resolved)
* **Initial Run (`node scripts/copy-tesseract-assets.mjs`):**
  Failed with:
  ```text
  file:///home/vivaan/Documents/SIH/scripts/copy-tesseract-assets.mjs:81
    const res = await fetch(LANG_DATA_URL);
                ^^^^^
  SyntaxError: Unexpected reserved word
  ```
* **Root Cause:** The system's `/usr/bin/node` is Node `v12.22.9` (which lacks top-level `await` and global `fetch`).
* **Resolution:** Executed using the installed modern runtime (`bun run scripts/copy-tesseract-assets.mjs`).
* **Console Output:**
  ```text
  Copied worker.min.js
  Copied 6/6 wasm core file(s)
  Downloading https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz ...
  Wrote models/tesseract/eng.traineddata.gz (2952873 bytes)
  ```
* **Filesystem Inspection (`models/tesseract/`):** 8 files verified (~22.8 MB total):
  * `eng.traineddata.gz` (2,952,873 B)
  * `tesseract-core-lstm.wasm` (2,855,361 B)
  * `tesseract-core-lstm.wasm.js` (3,896,484 B)
  * `tesseract-core-relaxedsimd-lstm.wasm` (2,862,266 B)
  * `tesseract-core-relaxedsimd-lstm.wasm.js` (3,905,767 B)
  * `tesseract-core-simd-lstm.wasm` (2,857,601 B)
  * `tesseract-core-simd-lstm.wasm.js` (3,899,472 B)
  * `worker.min.js` (111,307 B)

---

## Step 4: Surgical Swap in `src/ui/popup.js`

In `src/ui/popup.js`, the mock detection calls were replaced with the real detection engine. No UI rendering logic, event listeners, canvas manipulation, or CSS bindings were modified.

### Diff:
```diff
--- a/src/ui/popup.js
+++ b/src/ui/popup.js
@@ -3,8 +3,7 @@
-// import { detectSensitiveRegions } from '../detection/index.js'; // <-- swap in at integration time
-import { getMockDetections } from '../mock/mockDetections.js';
+import { detectSensitiveRegions } from '../detection/index.js';
 import { renderRedactedImage } from '../redaction/index.js';
 import { loadImageFromFile, canvasToDataUrl } from '../shared/imageUtils.js';
 
@@ -82,9 +81,7 @@ async function processFile(file) {
     originalPreview.src = originalObjectUrl;
 
     // 2. Obtain detections
-    // TODO(integration): replace getMockDetections() with
-    // await detectSensitiveRegions(image)
-    const detections = await getMockDetections();
+    const detections = await detectSensitiveRegions(image);
 
     // 3. Render redacted image with Set-of-Mark
     const redactedCanvas = renderRedactedImage(image, detections);
```

---

## Step 5: Test Suite Execution

### 5.1 Note on Test Runner Environments
* `npm test` invokes `vitest run` through Node 12, which crashes due to modern optional chaining syntax (`?.`) in Vitest 2.0's CLI bundle.
* Using Bun (`bun test`), the entire test suite executes seamlessly.

### 5.2 Test Results (`bun test`)
```text
bun test v1.3.14 (0d9b296a)

tests/detection/piiClassifier.test.js:
✓ classifyPii > detects a single-word email and normalizes confidence to 0..1 [6.16ms]
✓ classifyPii > strips trailing punctuation from an email before matching [0.14ms]
✓ classifyPii > detects a phone number split across multiple OCR words, with a unioned bbox [0.47ms]
✓ classifyPii > detects a phone number rendered as a single unbroken token [0.12ms]
✓ classifyPii > does not treat an unrelated preceding word as part of the phone number [0.07ms]
✓ classifyPii > detects a masked password field as its own type [0.27ms]
✓ classifyPii > detects an asterisk-masked password field [0.19ms]
✓ classifyPii > does not flag ordinary short words as masked passwords [0.16ms]
✓ classifyPii > does not match plain prose with no PII [0.07ms]
✓ classifyPii > finds multiple distinct matches across multiple lines [0.15ms]
✓ classifyPii > does not re-scan words already consumed by an earlier match on the same line [0.08ms]

tests/detection/ocr.test.js:
✓ flattenBlocks > flattens blocks -> paragraphs -> lines into a flat line list with words [0.23ms]
✓ flattenBlocks > flattens multiple blocks/paragraphs/lines in document order [0.12ms]
✓ flattenBlocks > returns an empty array for null/empty input rather than throwing [0.05ms]

tests/detection/index.test.js:
✓ detectSensitiveRegions > maps face detections into Detection objects matching the shared contract [1.30ms]
✓ detectSensitiveRegions > fuses face and PII detections, numbering labels per type [0.72ms]
✓ detectSensitiveRegions > returns only face detections when OCR finds no PII [0.13ms]

tests/detection/faceDetector.test.js:
✓ generatePriors > produces one row-major {row,col,stride} anchor per grid cell, across all strides [3.33ms]
✓ generatePriors > is deterministic for a given input size [1.42ms]
✓ decodeStride > reproduces the cell-center box exactly when bbox deltas are zero and scores are 1 [0.46ms]
✓ decodeStride > clamps out-of-range scores before combining cls and obj [0.03ms]
✓ decodeStride > offsets the cell center by (col, row) before scaling by stride [0.03ms]
✓ nms > drops heavily overlapping boxes, keeping the higher-scoring one [0.13ms]
✓ nms > keeps non-overlapping boxes [0.02ms]

tests/redaction/redaction.test.js:
✓ Redaction Engine (src/redaction/index.js) > renders base image at original dimensions [0.38ms]
✓ Redaction Engine (src/redaction/index.js) > handles empty detections without error or redaction overlays [0.03ms]
✓ Redaction Engine (src/redaction/index.js) > handles null or undefined detections gracefully [0.36ms]
✓ Redaction Engine (src/redaction/index.js) > redacts password with solid blackout [0.14ms]
✓ Redaction Engine (src/redaction/index.js) > redacts face with pixelation and Set-of-Mark label [0.05ms]
✓ Redaction Engine (src/redaction/index.js) > redacts PII text (email, phone, text-pii) with solid masking bars [0.06ms]
✓ Redaction Engine (src/redaction/index.js) > clamps bounding boxes that exceed image dimensions [0.06ms]
✓ Redaction Engine (src/redaction/index.js) > successfully processes the provided mock detections from mockDetections.js [0.05ms]

----------------------------------------------------------------------
Summary: 32 pass, 0 fail, 25,304 expect() calls across 5 test suites.
----------------------------------------------------------------------
```

---

## Step 6: Extension Ready for Manual Testing

As directed in Step 6 of `INTEGRATION_PROMPT_FOR_VIVAAN_FINAL.md`:
* Automated browser simulation was intentionally skipped to ensure all live validation happens in actual Chrome.
* The extension is completely built and ready to be loaded unpacked.

### How to Load and Test in Chrome:
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top right switch).
3. Click **Load unpacked** (top left).
4. Select the repository root folder: `/home/vivaan/Documents/SIH`.
5. Open the extension popup from the browser toolbar.
6. Upload any sample test image from `scripts/test-images/` (e.g. `obama-official-portrait.jpg` or `pii-test-easy.png`).
7. Verify:
   * Loading state displays while ONNX and Tesseract WASM run inference.
   * Faces are redacted via pixelation with `FACE-X` Set-of-Mark badges.
   * PII texts are redacted via solid blackouts with `EMAIL-X` / `PHONE-X` badges.
   * The breakdown panel populates with detections and confidence percentages.
   * Switching between "Redacted" and "Original" tabs functions smoothly.
   * Clicking "Download Redacted Image" downloads the exported PNG.
