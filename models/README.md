# Models

OWNED BY: Person 1

Place ONNX model weights here (e.g. a lightweight face detector, a tiny NER model
for PII text classification). Note their source, license, and approximate size
below as you add them.

| File | Purpose | Source | License | Size |
|------|---------|--------|---------|------|
| `face_detection_yunet_2023mar.onnx` | Face detection (YuNet) | [opencv_zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | Apache-2.0 | ~230 KB |

Committed at `models/face_detection_yunet_2023mar.onnx`, matching what `src/detection/faceDetector.js` expects.

### ORT wasm assets (MV3 note)

`src/detection/faceDetector.js` points `onnxruntime-web`'s wasm loader at `models/ort-wasm/` (via
`chrome.runtime.getURL('models/ort-wasm/')` in an extension context, since Manifest V3 pages resolve plain
relative URLs against the importing module, not the extension root). Extensions also can't load
remotely-hosted code, so the `.wasm`/`.mjs` loader files need to live locally rather than being fetched
from a CDN — run `npm run build:wasm` (see `scripts/copy-ort-wasm.mjs`) to copy them from
`node_modules/onnxruntime-web/dist` into `models/ort-wasm/`. `models/ort-wasm/` itself is gitignored
(regenerate it after every `npm install`, or whenever `onnxruntime-web` is upgraded).
