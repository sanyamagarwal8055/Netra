# NETRA

Privacy-preserving on-device visual perception prototype — SIH 2026, PS ID 26171, Team Rakshak.

**Current scope:** client-side only. Upload an image → detect sensitive regions on-device (faces, PII text) → render a redacted (Set-of-Mark) output image. No server-side component yet.

See `CLAUDE.md` for file ownership rules and workflow, and `docs/interface-contract.md` for the shared `Detection` data shape.

## Setup

```bash
npm install
```

## Run tests

```bash
npm test
```

## Load the extension in Chrome (once popup.js is functional)

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this repo's root folder

## Project layout

- `src/detection/` — Person 1: face/text/PII detection, exposes `detectSensitiveRegions(image)`
- `src/redaction/` — Person 2: Set-of-Mark + blur/mask rendering, exposes `renderRedactedImage(image, detections)`
- `src/ui/` — Person 2: extension popup
- `src/shared/` — shared contract (`types.js`) and generic image helpers (`imageUtils.js`)
- `src/mock/` — fake detection data for parallel UI development
- `models/` — ONNX model weights (Person 1)
- `docs/interface-contract.md` — the frozen `Detection` shape both modules rely on
