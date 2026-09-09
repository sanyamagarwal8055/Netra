# Models

OWNED BY: Person 1

Place ONNX model weights here (e.g. a lightweight face detector, a tiny NER model
for PII text classification). Note their source, license, and approximate size
below as you add them.

| File | Purpose | Source | License | Size |
|------|---------|--------|---------|------|
| `face_detection_yunet_2023mar.onnx` | Face detection (YuNet) | [opencv_zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | Apache-2.0 | ~230 KB |

**Not committed yet** — download `face_detection_yunet_2023mar.onnx` from the link above and place it
in this folder before running `detectSensitiveRegions()` against real images (`src/detection/faceDetector.js`
expects it at `models/face_detection_yunet_2023mar.onnx`).

### ORT wasm assets (MV3 note)

`src/detection/faceDetector.js` points `onnxruntime-web`'s wasm loader at `models/ort-wasm/`. Manifest V3
extensions can't load remotely-hosted code, so the `.wasm`/`.mjs` files from
`node_modules/onnxruntime-web/dist` need to be copied into that folder as part of the build — there's no
build pipeline for that yet (TODO).
