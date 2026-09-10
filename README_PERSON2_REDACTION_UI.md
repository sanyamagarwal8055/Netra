# Technical Record & Architecture Reference: Redaction & UI Module (Person 2 / Vivaan)

**Branch:** `person2-redaction-ui`  
**Author:** Vivaan (Person 2)  
**Date:** September 10, 2026  
**Audience:** Person 1 (Detection Lead) & Team Rakshak (SIH 2026, PS ID 26171)

---

## Overview & Purpose of This Document

This document is the **canonical, exhaustive technical record** of everything created, modified, tested, and verified on the `person2-redaction-ui` branch prior to merging.

Its purpose is to provide Person 1 with complete clarity on how Person 2's module functions down to the line-by-line logic, boundary handling, contract adherence, and test coverage—eliminating the need to reverse-engineer code during integration.

---

## 1. File-by-File Implementation Status

### `src/redaction/index.js`
* **Ownership:** Person 2 (Vivaan)
* **Status:** Fully implemented (replaces scaffold stub).
* **Exported Function:** `renderRedactedImage(image, detections)`
* **Input Parameters:**
  * `image`: `HTMLImageElement | ImageBitmap`
  * `detections`: Array of `Detection` objects matching `src/shared/types.js`
* **Output:** `HTMLCanvasElement`
* **Detailed Execution Logic:**
  1. **Dimension Extraction:** Resolves canvas dimensions from `image.naturalWidth || image.width || 0` and `image.naturalHeight || image.height || 0`.
  2. **Base Layer Painting:** Allocates an `HTMLCanvasElement` at exact source resolution and executes `ctx.drawImage(image, 0, 0, width, height)`.
  3. **Empty / Invalid Input Guard:** If `detections` is falsy, not an array, or empty (`detections.length === 0`), the function returns the unmodified base canvas immediately.
  4. **Coordinate Normalization & Boundary Clamping:**
     For every detection, the bounding box coordinates are clamped to ensure drawing routines never exceed image limits:
     ```js
     const bx = Math.max(0, Math.min(width, det.bbox.x));
     const by = Math.max(0, Math.min(height, det.bbox.y));
     const bw = Math.max(0, Math.min(width - bx, det.bbox.w));
     const bh = Math.max(0, Math.min(height - by, det.bbox.h));
     ```
     If clamped width or height $\le 0$, the detection is safely skipped.
  5. **Type-Specific Redaction Execution (Pass 1):**
     * **`face`:** Calculates dynamic pixelation block size: $\max(4, \lfloor\min(bw, bh) / 8\rfloor)$. Allocates an offscreen canvas at $(\lfloor bw / \text{pixelSize}\rfloor, \lfloor bh / \text{pixelSize}\rfloor)$, draws the region into it, disables smoothing (`ctx.imageSmoothingEnabled = false`), and paints it back upscaled onto the base canvas.
     * **`password`:** Renders a solid `#0a0a0a` blackout rectangle across `(bx, by, bw, bh)`.
     * **`email` / `phone` / `text-pii`:** Renders a solid dark charcoal `#111827` masking bar across `(bx, by, bw, bh)`.
  6. **Set-of-Mark Annotation Overlay (Pass 2):**
     Executed as a separate second pass so overlay labels and borders are never obscured by adjacent or overlapping redaction fills.
     * Renders a 2px stroke border around the bounding box using theme-specific colors.
     * Resolves label text: `det.label || `${det.type.toUpperCase()}-${i + 1}``.
     * Calculates font size: $\max(11, \min(14, \lfloor bh \times 0.4\rfloor))$.
     * Measures text dimensions and renders a rounded pill tag (3px radius).
     * **Ceiling & Edge Clamping:** If `by - badgeH - 2 < 0` (top edge of image), flips the badge inside the box (`by + 2`). If `bx + badgeW > width` (right edge), clamps badge to `width - badgeW`.
     * Draws badge background and centered bold white text.

---

### `src/ui/popup.html`
* **Ownership:** Person 2 (Vivaan)
* **Status:** Fully implemented.
* **Component Breakdown:**
  * `.app-header`: Branding title ("NETRA"), subtitle ("On-Device Visual Privacy"), and a status pill badge ("Client-Side").
  * `#uploadSection`: Interactive dropzone card containing `#imageInput` (type `file`, `accept="image/*"`), drag-and-drop icon, and prompt text.
  * `#loadingBar`: Flex container with animated CSS spinner and status text ("Redacting sensitive regions on-device..."), hidden by default.
  * `#resultsSection`: Main result view (hidden until image load):
    * View switcher: `#tabRedacted` ("Redacted (SoM)") and `#tabOriginal` ("Original") buttons.
    * Reset action: `#resetBtn` button to clear state and upload a new image.
    * Canvas container: `#outputCanvas` (rendered Set-of-Mark result) and `#originalPreview` (`<img>` tag showing unredacted source).
    * Summary card: `#detectionCount` pill and `#detectionsList` scrollable container.
    * Export action: `#downloadBtn` ("Download Redacted Image").
  * Scripts: Loaded as standard ES module: `<script type="module" src="popup.js"></script>`.

---

### `src/ui/popup.css`
* **Ownership:** Person 2 (Vivaan)
* **Status:** Fully implemented.
* **Design System & Styling Details:**
  * Fixed popup dimensions: `width: 380px; min-height: 480px;`.
  * Dark palette tokens: `--bg-primary: #0b0f19`, `--bg-card: #151d30`, `--bg-surface: #1e293b`, `--border-color: #2e3c54`, `--text-main: #f1f5f9`, `--text-muted: #94a3b8`, `--primary: #3b82f6`.
  * **Critical Engine Rule:** Includes `[hidden] { display: none !important; }` to override flexbox `display: flex` rules when toggling HTML `hidden` attributes.
  * Drag state styling: `.dropzone.drag-active` highlights border with blue tint and light blue surface background.
  * Detection chips: Distinct color tokens for `.chip-face` (`#1d4ed8`), `.chip-password` (`#b91c1c`), `.chip-email` (`#b45309`), `.chip-phone` (`#047857`), `.chip-text-pii` (`#6d28d9`).
  * Canvas container: Constrained to `max-height: 240px; overflow: auto;` with dark backing (`#000000`) and centered layout.

---

### `src/ui/popup.js`
* **Ownership:** Person 2 (Vivaan)
* **Status:** Fully implemented against mock detector; structured for 1-line integration.
* **Logic Flow:**
  1. **Event Registration:** Binds `dragenter`, `dragover`, `dragleave`, and `drop` to `#dropzone`; binds `change` to `#imageInput`.
  2. **File Validation:** Validates `file.type.startsWith('image/')`. Alerts user if non-image is supplied.
  3. **UI State Transition:** Shows `#loadingBar`, hides `#uploadSection` and `#resultsSection`.
  4. **Image Loading:** Invokes `loadImageFromFile(file)` from `src/shared/imageUtils.js`. Generates a persistent object URL for `#originalPreview.src`.
  5. **Detection Invocation:**
     ```js
     // Line 70:
     // TODO(integration): replace getMockDetections() with
     // await detectSensitiveRegions(image)
     const detections = await getMockDetections();
     ```
  6. **Redaction Rendering:** Calls `renderRedactedImage(image, detections)`.
  7. **Display Update:** Configures `#outputCanvas` width and height to match the returned canvas, draws the result onto `#outputCanvas`, and populates `#detectionsList` with dynamic DOM rows showing labels, type chips, and calculated percentage confidence (`Math.round(conf * 100) + '% conf'`).
  8. **View Switching:** Tab click listeners toggle `#outputCanvas` vs `#originalPreview` visibility.
  9. **Export Handler:** `#downloadBtn` triggers `canvasToDataUrl(outputCanvas)` and creates an automatic `<a download="netra-redacted-<timestamp>.png">` download.
  10. **Reset Handler:** `#resetBtn` revokes active object URLs, clears `#imageInput.value`, and resets views.

---

### `src/shared/imageUtils.js`
* **Ownership:** Shared (Implemented by Vivaan with team agreement; committed in `2c4f1e0`).
* **Functions:**
  1. `loadImageFromFile(file)`: Checks for native `createImageBitmap` and resolves; falls back to `URL.createObjectURL(file)` + `new Image()` with `URL.revokeObjectURL()` inside onload/onerror.
  2. `imageToImageData(image)`: Creates offscreen canvas at image's natural dimensions, paints image, and extracts `ctx.getImageData(0, 0, width, height)`. *(Note: Dead code / uncalled across repo; see Section 7).*
  3. `canvasToDataUrl(canvas)`: Wrapper returning `canvas.toDataURL('image/png')`.

---

### `src/mock/mockDetections.js`
* **Ownership:** Person 2 (Vivaan)
* **Status:** **Untouched from original scaffold.**
* **Content:** Contains default 3 mock detections (`det-1` face, `det-2` email, `det-3` password) and asynchronous `getMockDetections()` resolver.

---

### `tests/redaction/redaction.test.js`
* **Ownership:** Person 2 (Vivaan)
* **Status:** Newly created test suite containing 8 automated unit tests.

---

## 2. Design & Logic Decisions

| Decision Area | Chosen Approach | Alternative Rejected | Rationale |
|---|---|---|---|
| **Face Redaction** | **Pixelation** (downscaling to offscreen canvas and upscaling with smoothing disabled) | Gaussian Blur via `ctx.filter = 'blur()'` | Canvas filter blur only affects subsequent draw calls and behaves inconsistently across different GPU / browser backends. Pixelation is deterministic, computationally lightweight, and unmistakable in hackathon demo evaluations. |
| **Password Redaction** | **Solid Blackout Box** (`#0a0a0a`) | Masking bar or Blur | Passwords require zero information leakage. A solid blackout box provides unambiguous proof that credentials cannot be reverse-engineered or deconvolved. |
| **PII Text Redaction** | **Dark Charcoal Masking Bars** (`#111827`) | Text blurring / pixelation | Blurring text can create visual artifacts resembling camera out-of-focus errors and can often be reconstructed via deconvolution. Solid masking bars look intentional and clean. |
| **Set-of-Mark Rendering** | **Two-pass rendering** (redact all regions first, then draw all labels on top) | Single-pass (redact and label each box immediately) | In a single pass, if box B overlaps box A, box B's redaction block could wipe out box A's label tag. The two-pass architecture guarantees all markers remain visible and legible. |
| **Badge Boundary Collisions** | **Ceiling & edge clamping** | Fixed top-left coordinate | If a face or header appears at $(x, 0)$, a badge placed at $(x, y - 20)$ is clipped off-canvas. The boundary check flips the badge inside the box if it hits the upper edge, and pulls it left if it exceeds the right edge. |
| **Empty Detections** | **Return clean base canvas** | Display error / do nothing | If an image has no sensitive regions (`detections = []`), the system should still succeed and show the clean image rather than crashing or throwing. |
| **Confidence Presentation** | **Rounded integer percentage** | Raw float (`0.97`) | Non-technical evaluators read `97% conf` much faster than raw floating point values like `0.971239`. |

---

## 3. Complete Shared-File Audit

Diff against `origin/main` for every shared file listed in `CLAUDE.md`:

```
$ git diff origin/main -- manifest.json package.json src/shared/types.js README.md CLAUDE.md docs/interface-contract.md
(Zero output — all 6 files are 100% byte-for-byte identical to origin/main)
```

### Detailed Shared File Audit Table:
| File | Status | Notes |
|---|---|---|
| `manifest.json` | **UNTOUCHED** | 0 diff against `origin/main` |
| `package.json` | **UNTOUCHED** | 0 diff against `origin/main` |
| `src/shared/types.js` | **UNTOUCHED** | 0 diff against `origin/main` |
| `README.md` | **UNTOUCHED** | 0 diff against `origin/main` |
| `CLAUDE.md` | **UNTOUCHED** | 0 diff against `origin/main` |
| `docs/interface-contract.md` | **UNTOUCHED** | 0 diff against `origin/main` |
| `src/shared/imageUtils.js` | **MODIFIED** | Implemented the 3 agreed stubs. Committed in isolated commit `2c4f1e0`. |

### Exact Diff for `src/shared/imageUtils.js`:
```diff
diff --git a/src/shared/imageUtils.js b/src/shared/imageUtils.js
index a3ab202..30ea1e6 100644
--- a/src/shared/imageUtils.js
+++ b/src/shared/imageUtils.js
@@ -10,7 +10,22 @@
  * @returns {Promise<ImageBitmap>}
  */
 export async function loadImageFromFile(file) {
-  throw new Error('imageUtils.loadImageFromFile: not implemented yet');
+  if (typeof createImageBitmap === 'function') {
+    return await createImageBitmap(file);
+  }
+  return new Promise((resolve, reject) => {
+    const img = new Image();
+    const url = URL.createObjectURL(file);
+    img.onload = () => {
+      URL.revokeObjectURL(url);
+      resolve(img);
+    };
+    img.onerror = (err) => {
+      URL.revokeObjectURL(url);
+      reject(err);
+    };
+    img.src = url;
+  });
 }
 
 /**
@@ -19,7 +34,17 @@ export async function loadImageFromFile(file) {
  * @returns {ImageData}
  */
 export function imageToImageData(image) {
-  throw new Error('imageUtils.imageToImageData: not implemented yet');
+  const width = image.naturalWidth || image.width;
+  const height = image.naturalHeight || image.height;
+  const canvas = document.createElement('canvas');
+  canvas.width = width;
+  canvas.height = height;
+  const ctx = canvas.getContext('2d');
+  if (!ctx) {
+    throw new Error('imageUtils.imageToImageData: failed to get 2d context');
+  }
+  ctx.drawImage(image, 0, 0);
+  return ctx.getImageData(0, 0, width, height);
 }
 
 /**
@@ -28,5 +53,6 @@ export function imageToImageData(image) {
  * @returns {string} data URL
  */
 export function canvasToDataUrl(canvas) {
-  throw new Error('imageUtils.canvasToDataUrl: not implemented yet');
+  return canvas.toDataURL('image/png');
 }
```

---

## 4. Verification of Ownership Boundaries

* **`src/detection/**`:** **CONFIRMED UNTOUCHED.** (0 commits, 0 diffs).
* **`models/**`:** **CONFIRMED UNTOUCHED.** (0 commits, 0 diffs).
* **`tests/detection/**`:** **CONFIRMED UNTOUCHED.** (Does not exist on this branch).

Person 2 worked strictly within `src/redaction/`, `src/ui/`, `tests/redaction/`, and the agreed `src/shared/imageUtils.js`.

---

## 5. Interface Contract Compliance

### `renderRedactedImage` Signature
* **Contract in `docs/interface-contract.md` & `types.js`:**
  `renderRedactedImage(image, detections): HTMLCanvasElement`
* **Implemented in `src/redaction/index.js`:**
  `export function renderRedactedImage(image, detections)`
* **Deviation:** **ZERO.** Exact match.

### `Detection` Object Shape Consumption
Contract definition:
```js
{
  id: string,
  type: 'face' | 'email' | 'phone' | 'password' | 'text-pii',
  bbox: { x: number, y: number, w: number, h: number },
  label: string,
  confidence: number
}
```
* **Fields Read:** `id`, `type`, `bbox.x`, `bbox.y`, `bbox.w`, `bbox.h`, `label`, `confidence`.
* **Extensions / Alterations:** None.
* **Defensive Fallbacks:**
  * If `det.label` is undefined/empty: derives `${det.type.toUpperCase()}-${i + 1}`.
  * If `det.confidence` is undefined: defaults to `1.0`.

---

## 6. Test Coverage & Test Runner Honesty

### Test Suite: `tests/redaction/redaction.test.js`
Contains 8 test cases validating `renderRedactedImage`:
1. `renders base image at original dimensions`: Confirms canvas width, height, and base `drawImage` invocation.
2. `handles empty detections without error or redaction overlays`: Confirms canvas returns safely and 0 rectangles are drawn.
3. `handles null or undefined detections gracefully`: Verifies no unhandled exceptions on falsy detection arrays.
4. `redacts password with solid blackout`: Verifies `fillRect` and border strokes for passwords.
5. `redacts face with pixelation and Set-of-Mark label`: Verifies offscreen canvas scaling and `FACE-1` text rendering.
6. `redacts PII text with solid masking bars`: Verifies fills for `email` and `phone`.
7. `clamps bounding boxes that exceed image dimensions`: Passes $600\times 450$ box on $640\times 480$ canvas; verifies coordinates clamp to $(600, 450, 40, 30)$.
8. `successfully processes the provided mock detections from mockDetections.js`: Validates integration against Person 2's mock dataset.

### Test Runner Status:
* **`npm test` Status on local machine:** **FAILS due to local Node version.**
  * Local host has Node `v12.22.9`.
  * Vitest 2.1.9 requires Node $\ge 18$ and uses Optional Chaining (`?.`).
  * Running `npm test` throws `SyntaxError: Unexpected token '.'` at `cac.CB_9Zo9Q.js:1387`.
* **Successful Test Execution:**
  * **Via Bun:** `bun test` runs the suite in **26ms**: **8 passed, 0 failed**.
  * **Via Cached Node 24:** `~/.cache/ms-playwright-go/.../node ./node_modules/vitest/vitest.mjs run`: **8 passed, 0 failed**.
* **Integration Takeaway:** On any machine or CI with Node $\ge 18$, standard `npm test` will run and pass cleanly.

---

## 7. Known Limitations, Edge Cases & Gaps

1. **`imageToImageData()` is Dead Code:**
   * Fully implemented in `src/shared/imageUtils.js`, but has **0 callers** across the repository.
   * Neither Person 2's UI nor redaction uses it (they use canvas and `ImageBitmap` directly).
   * Person 1's `faceDetector.js` does not use it (it implements its own `preprocess()` for ONNX tensor creation).
   * It should be treated as unused legacy scaffolding.
2. **Very Large Images (4K / 8K):**
   * The canvas draws at full unscaled pixel resolution to preserve Set-of-Mark coordinates. In the extension popup, the canvas container is scrollable (`max-height: 240px; overflow: auto`). While mathematically accurate, an auto-fit/zoom toggle would improve user experience on ultra-high-resolution images.
3. **Overlapping Labels in Densely Clustered Text:**
   * If two PII detections are within 5 pixels of each other, their Set-of-Mark text badges may visually overlap.
4. **Integration Dependency:**
   * Line 70 of `src/ui/popup.js` currently calls `getMockDetections()`. Swapping this to `detectSensitiveRegions(image)` is the sole remaining integration step.

---

## 8. Exact Setup & Run Instructions (Clean Clone to Working Popup)

### Prerequisites
* Google Chrome (or Chromium-based browser)
* Node.js $\ge 18$ (recommended) or Bun

### Step 1: Clone and Checkout Branch
```bash
git clone git@github.com:sanyamagarwal8055/Netra.git
cd Netra
git checkout person2-redaction-ui
```

### Step 2: Install Dependencies (Optional, for tests)
```bash
npm install
```

### Step 3: Run Unit Tests
```bash
# If using Node >= 18:
npm test

# If using Bun:
bun test
```

### Step 4: Load Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. In the top right corner, enable **Developer mode**.
3. Click the **Load unpacked** button in the top left.
4. Select the `Netra/` root folder (the folder containing `manifest.json`).

### Step 5: Test the Extension
1. Click the Extensions (puzzle piece) icon in Chrome and click **NETRA**.
2. Drag and drop any image (PNG, JPG, WebP) into the dropzone (or click to select).
3. The popup will execute on-device redaction against mock data:
   * Displays blurred/pixelated face with blue `FACE-1` tag.
   * Displays masked text with amber `PII-1` tag.
   * Displays solid blackout with red `PII-2` tag.
4. Click the **Original** tab to verify before/after comparison.
5. Click **Download Redacted Image** to save the sanitized PNG.
