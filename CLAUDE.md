# CLAUDE.md — NETRA Project Rules

Project: NETRA — privacy-preserving on-device visual perception prototype for SIH 2026 (PS ID 26171, Team: Rakshak).

**Current scope:** client-side only. Prototype takes an image as input and produces a redacted (Set-of-Mark) image as output. No server-side / cloud VLM component is in scope right now. Do not add server-side code, FastAPI, or cloud VLM integration unless this file is explicitly updated to expand scope.

This file is the shared source of truth for how the two contributors work in this repo. Any AI assistant (Claude Code or otherwise) working in this repo must follow these rules before writing or editing any file.

---

## 1. Contributors and modules

- **Person 1** — owns the **Detection / Perception module**: given a raw image, find sensitive regions (faces, text, PII) and return them in a standard format.
- **Person 2 (Vivaan)** — owns the **Redaction / UI module**: given an image and a list of detections, render the redacted output and drive the extension popup UI.

---

## 2. File ownership

### Person 1 owns (do not edit without Person 1's sign-off):
- `src/detection/**`
- `models/**`
- `tests/detection/**`

### Person 2 owns (do not edit without Person 2's sign-off):
- `src/redaction/**`
- `src/ui/**`
- `src/mock/**`
- `src/shared/imageUtils.js`  — ownership decided 10-09-2026; was previously shared/unresolved
- `tests/redaction/**`

### Shared — requires coordination before editing:
- `manifest.json`
- `package.json`
- `src/shared/types.js`
- `README.md`
- `CLAUDE.md`

**Rule:** never edit a file outside your ownership list, and never edit a shared file, without first flagging it to the other person. If an AI assistant is asked to make a change that touches a file it doesn't own, it must stop and say so rather than making the edit silently.

---

## 3. The interface contract

The `Detection` object shape defined in `src/shared/types.js` is the contract between the two modules. It must be agreed by both people before either writes real feature code, and once agreed, it is frozen — neither person changes it unilaterally. Any change requires an explicit message to the other person first.

Draft shape (confirm before use):

```js
/**
 * @typedef {Object} Detection
 * @property {string} id
 * @property {'face'|'email'|'phone'|'password'|'text-pii'} type
 * @property {{x:number, y:number, w:number, h:number}} bbox
 * @property {string} label
 * @property {number} confidence
 */
```

Person 1's detection module exposes:
```js
detectSensitiveRegions(image): Promise<Detection[]>
```

Person 2's redaction module exposes:
```js
renderRedactedImage(image, detections: Detection[]): <redacted image output>
```

Person 2 develops against `src/mock/mockDetections.js` (fake `Detection[]` matching the contract) until Person 1's real implementation is ready to integrate.

---

## 4. Workflow rules

1. Do not implement features until both people have agreed the `Detection` contract in `src/shared/types.js`.
2. Work happens on individual branches, never directly on `main`:
   - `person1-detection`
   - `person2-redaction-ui`
3. Shared-file changes (`manifest.json`, `package.json`, `src/shared/*`) must be small, single-purpose commits, and the other person must be pinged before merging.
4. Integration order: Person 1's detection branch merges to `main` first (it has no dependency on Person 2's work). Person 2 then rebases/pulls `main` and swaps the mock detection call for the real one.
5. Pull requests are reviewed by the other person before merging, using squash-and-merge for a clean history.
6. If a merge conflict appears in a file you don't own, do not resolve it yourself — flag it to the owner.
7. When one person's task requires the other's actual code/output (not just the agreed interface), stop and ask for the exact snippet rather than assuming its contents or behavior.

---

## 5. Technical approach (decided, not to be re-litigated without discussion)

This is computer-vision-only. There is no DOM or Accessibility Tree access anywhere in this prototype — the input is a static image, not a live browser tab. Nobody trains a model from scratch; the detection side composes pretrained, open-source models via in-browser inference.

**Detection pipeline (Person 1):**
1. Face detection on the raw image (e.g. YuNet via ONNX Runtime Web) → face bounding boxes.
2. OCR to locate and extract text regions (e.g. Tesseract.js).
3. PII classification on extracted text — regex first for structured PII (email, phone), optionally a small NER model for names.
4. Fusion — merge face + PII detections into one `Detection[]`, resolve overlaps, assign type/label/confidence.

**Redaction pipeline (Person 2):**
1. Draw the original image to canvas.
2. Redact each `Detection` by type: blur or pixelate for `face`, solid black-out for `password`, blur or a masking bar for `email`/`phone`/`text-pii`.
3. Draw a Set-of-Mark numbered label near each redacted region.
4. Export the final canvas as the output image.
5. Empty `detections` array → return the original image unmodified, don't error.

---

## 6. Out of scope for now

- Server-side processing, FastAPI backend, cloud VLM / grounded action reasoning
- Chrome DevTools Protocol accessibility-tree capture, DOM-first PII detection
- Any multi-step task planning or "verified action" execution

These were part of the original PPT concept but are deferred until the core image-in / redacted-image-out prototype works end-to-end.
