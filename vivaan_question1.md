# Technical Debrief: Investigation & Test Execution
**Document:** `vivaan_question1.md`  
**Date:** September 10, 2026  
**Author:** Vivaan (Person 2)  
**Topic:** Preprocessing Architecture (`imageToImageData`) & Local Test Runner Resolution (`npm test` vs `bun test`)

---

## Part 1: The `imageToImageData()` Preprocessing Question

### 1. Context
There was an unresolved architectural question regarding image preprocessing across modules:
* Person 1's detection module (`src/detection/faceDetector.js`) implements its own internal `preprocess()` function that converts raw images directly into ONNX tensors.
* It does **not** call `imageToImageData()` from `src/shared/imageUtils.js`.

### 2. Codebase Investigation
A global search across the entire repository revealed:
* **Definition:** `src/shared/imageUtils.js` (line 36) exports `imageToImageData(image)`.
* **Usage in `src/redaction/**`:** **0 calls** (Person 2 operates directly via HTML5 Canvas 2D contexts and `ImageBitmap`s).
* **Usage in `src/ui/**`:** **0 calls**.
* **Usage in `src/mock/**`:** **0 calls**.
* **Usage in `src/detection/**`:** **0 calls**.
* **Usage in `tests/**`:** **0 calls**.

### 3. Technical Reason & Verdict
* **What `imageToImageData()` was designed for:** It was scaffolded early on under the assumption that someone might need raw browser pixel buffers (`ImageData` / `Uint8ClampedArray` with interleaved RGBA channels).
* **Why Person 1 does not need it:** ONNX vision models do not accept browser `ImageData`. They require model-specific tensors:
  1. Specific fixed input dimensions (e.g. $1 \times 3 \times 320 \times 240$ or $1 \times 3 \times 640 \times 640$).
  2. Planar RGB ordering (NCHW format), whereas `ImageData` is interleaved RGBA ($R, G, B, A, R, G, B, A\dots$).
  3. Normalized Float32 data (e.g. $[0.0, 1.0]$ or mean/std normalization), whereas `ImageData` is raw 8-bit integers (`0–255`).
* **Why Person 2 does not need it:** Redaction runs on canvas (`drawImage`, `fillRect`, pixelation downscale/upscale), not raw `ImageData` arrays.
* **Verdict:** `imageToImageData()` is currently **dead code and redundant functionality**. Person 1 should **not** refactor their working ONNX tensor conversion to use it. It can safely remain unused or be removed with team sign-off.

---

## Part 2: The `npm test` Failure & Resolution

### 1. The Issue
Running `npm test` produced a runtime crash:
```text
> netra-extension@0.1.0 test
> vitest run

file:///home/vivaan/Documents/SIH/node_modules/vitest/dist/chunks/cac.CB_9Zo9Q.js:1387
    const helpSection = info.find((current) => current.title?.startsWith("For more info, run any command"));
                                                             ^
SyntaxError: Unexpected token '.'
    at Loader.moduleStrategy (internal/modules/esm/translators.js:133:18)
```

### 2. Root Cause
* The system's default Node runtime is **`v12.22.9`** (Node 12 reached End-of-Life in April 2022).
* `package.json` specifies `vitest@^2.0.0`, which strictly requires **Node.js $\ge 18.0.0$**.
* Modern libraries use Optional Chaining (`?.`). Because Node 12 does not support `?.`, it crashed immediately on parsing Vitest's CLI scripts.
* An attempt to install `nvm` via `curl` failed due to a local network SSL inspection/proxy block (`curl: (35) error:0A00010B:SSL routines::wrong version number`).

### 3. Resolution: `bun test`
The local machine already has **Bun `v1.3.14`** installed at `~/.bun/bin/bun`. Bun includes a built-in test runner fully compatible with Vitest/Jest test suites and modern ES syntax.

Running:
```bash
bun test
```
Result:
```text
bun test v1.3.14 (0d9b296a)

tests/redaction/redaction.test.js:
✓ Redaction Engine (src/redaction/index.js) > renders base image at original dimensions [1.59ms]
✓ Redaction Engine (src/redaction/index.js) > handles empty detections without error or redaction overlays [0.09ms]
✓ Redaction Engine (src/redaction/index.js) > handles null or undefined detections gracefully [0.08ms]
✓ Redaction Engine (src/redaction/index.js) > redacts password with solid blackout [0.16ms]
✓ Redaction Engine (src/redaction/index.js) > redacts face with pixelation and Set-of-Mark label [0.08ms]
✓ Redaction Engine (src/redaction/index.js) > redacts PII text (email, phone, text-pii) with solid masking bars [0.08ms]
✓ Redaction Engine (src/redaction/index.js) > clamps bounding boxes that exceed image dimensions [0.06ms]
✓ Redaction Engine (src/redaction/index.js) > successfully processes the provided mock detections from mockDetections.js [0.06ms]

 8 pass
 0 fail
 22 expect() calls
Ran 8 tests across 1 file. [26.00ms]
```

### 4. Summary & Takeaway
1. **Unit tests are 100% operational and passing (8/8).**
2. For testing locally in this environment, use `bun test`.
3. If Person 1 or CI runs `npm test`, they will need Node $\ge 18$ installed on their machine.
