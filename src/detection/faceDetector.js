// OWNED BY: Person 1

/**
 * Face detection using YuNet (ONNX Runtime Web).
 *
 * Model: face_detection_yunet_2023mar.onnx (OpenCV Zoo,
 * https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet)
 * Expected at: models/face_detection_yunet_2023mar.onnx (see models/README.md).
 *
 * Box decoding is a JS port of the reference postprocessing in OpenCV's
 * C++ YuNet implementation (modules/objdetect/src/face_detect.cpp), needed
 * here because we run the raw ONNX graph via onnxruntime-web instead of
 * cv2.FaceDetectorYN, which does this decoding internally.
 *
 * VALIDATED (2026-09-10) against the real 2023mar weights via a manual smoke
 * test (see scripts/check-face-detection.mjs). The real model:
 *   - requires a 640x640 input (not 320x320 — an earlier, unvalidated draft
 *     of this file assumed 320 and would throw on session.run()).
 *   - has 12 separate per-stride outputs (cls_{8,16,32}, obj_{8,16,32},
 *     bbox_{8,16,32}, kps_{8,16,32}) — one anchor per grid cell — rather
 *     than a single concatenated [loc, conf, iou] tensor across all priors.
 *     An earlier draft of this file assumed the latter (SSD/RetinaFace-style
 *     multi-box-per-cell + variance decode) and would have silently produced
 *     garbage boxes. landmarks (kps_*) are decoded by the model but unused
 *     here since Detection has no landmark field.
 */

// Square input simplifies prior-box indexing (the reference implementation's
// row/col loop only lines up cleanly when width == height).
const INPUT_SIZE = 640;
const STEPS = [8, 16, 32];
const CONF_THRESHOLD = 0.6;
const NMS_THRESHOLD = 0.3;

let ortModulePromise = null;
async function getOrt() {
  if (!ortModulePromise) {
    ortModulePromise = import('onnxruntime-web');
  }
  return ortModulePromise;
}

/**
 * Load the YuNet ONNX Runtime Web session.
 * @param {string} [modelUrl]
 * @returns {Promise<import('onnxruntime-web').InferenceSession>}
 */
export async function loadFaceDetectorSession(modelUrl = 'models/face_detection_yunet_2023mar.onnx') {
  const ort = await getOrt();
  // MV3 extensions cannot load remotely-hosted code, so the ORT wasm binaries
  // must be vendored locally (e.g. copied from
  // node_modules/onnxruntime-web/dist) rather than fetched from a CDN.
  // TODO(Person 1): wire up that copy step once a build pipeline exists.
  // Node (used for the manual smoke test in scripts/) resolves onnxruntime-web
  // to its own ort.node.min.mjs backend and doesn't need this — setting it
  // there breaks module resolution (it tries to `import` the path string).
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  if (!isNode) {
    ort.env.wasm.wasmPaths = 'models/ort-wasm/';
  }
  return ort.InferenceSession.create(modelUrl);
}

/**
 * Generate YuNet grid-cell anchors for a square input: one anchor per
 * (row, col) cell at each stride, in the order the model's flattened
 * per-stride outputs are laid out (row-major).
 * @param {number} [inputSize]
 * @returns {{row:number, col:number, stride:number}[]}
 */
export function generatePriors(inputSize = INPUT_SIZE) {
  const priors = [];
  for (const stride of STEPS) {
    const fm = inputSize / stride;
    for (let row = 0; row < fm; row++) {
      for (let col = 0; col < fm; col++) {
        priors.push({ row, col, stride });
      }
    }
  }
  return priors;
}

/**
 * Decode one stride's raw YuNet outputs into (x, y, w, h, score) boxes, in
 * input-space pixel coordinates (top-left origin).
 * Formula per OpenCV's objdetect/src/face_detect.cpp:
 *   cx = (col + bbox[0]) * stride, cy = (row + bbox[1]) * stride
 *   w  = exp(bbox[2]) * stride,    h  = exp(bbox[3]) * stride
 *   score = sqrt(clamp(cls,0,1) * clamp(obj,0,1))
 * @param {Float32Array|number[]} cls flattened [numCells] classification score
 * @param {Float32Array|number[]} obj flattened [numCells] objectness score
 * @param {Float32Array|number[]} bbox flattened [numCells, 4]
 * @param {number} fm feature map size (grid is fm x fm)
 * @param {number} stride
 * @returns {{x:number,y:number,w:number,h:number,score:number}[]}
 */
export function decodeStride(cls, obj, bbox, fm, stride) {
  const boxes = [];
  for (let row = 0; row < fm; row++) {
    for (let col = 0; col < fm; col++) {
      const idx = row * fm + col;
      const clsScore = Math.min(Math.max(cls[idx], 0), 1);
      const objScore = Math.min(Math.max(obj[idx], 0), 1);
      const score = Math.sqrt(clsScore * objScore);

      const bx = bbox[idx * 4 + 0];
      const by = bbox[idx * 4 + 1];
      const bw = bbox[idx * 4 + 2];
      const bh = bbox[idx * 4 + 3];

      const cx = (col + bx) * stride;
      const cy = (row + by) * stride;
      const w = Math.exp(bw) * stride;
      const h = Math.exp(bh) * stride;

      boxes.push({ x: cx - w / 2, y: cy - h / 2, w, h, score });
    }
  }
  return boxes;
}

function boxArea(box) {
  return Math.max(box.w, 0) * Math.max(box.h, 0);
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const unionArea = boxArea(a) + boxArea(b) - interArea;
  return unionArea <= 0 ? 0 : interArea / unionArea;
}

/**
 * Greedy IoU-based non-max suppression.
 * @param {{x:number,y:number,w:number,h:number,score:number}[]} boxes
 * @param {number} [threshold]
 * @returns {{x:number,y:number,w:number,h:number,score:number}[]}
 */
export function nms(boxes, threshold = NMS_THRESHOLD) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const candidate of sorted) {
    if (kept.every((k) => iou(k, candidate) <= threshold)) {
      kept.push(candidate);
    }
  }
  return kept;
}

/**
 * Draw `image` into a square INPUT_SIZE x INPUT_SIZE canvas and return a
 * BGR, NCHW Float32Array tensor plus the scale factors needed to map
 * detections back to the source image's coordinates.
 * @param {ImageBitmap|HTMLImageElement} image
 * @param {number} [inputSize]
 */
export function preprocess(image, inputSize = INPUT_SIZE) {
  const srcW = image.width;
  const srcH = image.height;
  const canvas = new OffscreenCanvas(inputSize, inputSize);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, inputSize, inputSize);
  const { data } = ctx.getImageData(0, 0, inputSize, inputSize);

  const planeSize = inputSize * inputSize;
  const tensorData = new Float32Array(3 * planeSize);
  for (let p = 0; p < planeSize; p++) {
    const r = data[p * 4 + 0];
    const g = data[p * 4 + 1];
    const b = data[p * 4 + 2];
    // BGR channel order, matching the OpenCV-trained YuNet model.
    tensorData[p] = b;
    tensorData[planeSize + p] = g;
    tensorData[2 * planeSize + p] = r;
  }

  return { tensorData, scaleX: srcW / inputSize, scaleY: srcH / inputSize };
}

/**
 * Run YuNet face detection on `image` and return boxes in source-image pixel coordinates.
 * @param {import('onnxruntime-web').InferenceSession} session
 * @param {ImageBitmap|HTMLImageElement} image
 * @returns {Promise<{bbox:{x:number,y:number,w:number,h:number}, confidence:number}[]>}
 */
export async function runFaceDetection(session, image) {
  const ort = await getOrt();
  const { tensorData, scaleX, scaleY } = preprocess(image, INPUT_SIZE);
  const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);

  const feeds = { [session.inputNames[0]]: inputTensor };
  const outputs = await session.run(feeds);

  let decoded = [];
  for (const stride of STEPS) {
    const fm = INPUT_SIZE / stride;
    const cls = outputs[`cls_${stride}`].data;
    const obj = outputs[`obj_${stride}`].data;
    const bbox = outputs[`bbox_${stride}`].data;
    decoded = decoded.concat(decodeStride(cls, obj, bbox, fm, stride));
  }

  const strong = decoded.filter((box) => box.score >= CONF_THRESHOLD);
  const kept = nms(strong, NMS_THRESHOLD);

  // decodeStride already returns pixel coordinates in the INPUT_SIZE x
  // INPUT_SIZE preprocessed canvas, so only the source-image scale factors
  // (not an extra INPUT_SIZE multiply) map them back to source pixels.
  return kept.map((box) => ({
    bbox: {
      x: Math.round(box.x * scaleX),
      y: Math.round(box.y * scaleY),
      w: Math.round(box.w * scaleX),
      h: Math.round(box.h * scaleY),
    },
    confidence: box.score,
  }));
}
