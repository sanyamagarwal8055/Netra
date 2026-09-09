// OWNED BY: Person 1

/**
 * Face detection using YuNet (ONNX Runtime Web).
 *
 * Model: face_detection_yunet_2023mar.onnx (OpenCV Zoo,
 * https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet)
 * Expected at: models/face_detection_yunet_2023mar.onnx (see models/README.md —
 * the weights file itself isn't committed yet).
 *
 * Anchor generation and box decoding are a JS port of the reference
 * postprocessing in opencv_zoo's yunet.py (PriorBox + decode), needed here
 * because we run the raw ONNX graph via onnxruntime-web instead of
 * cv2.FaceDetectorYN, which does this decoding internally in OpenCV's C++ code.
 *
 * CAVEAT: this decode logic has been transcribed from the public reference
 * implementation but has NOT been numerically validated end-to-end against
 * the real model weights (the .onnx file isn't in the repo yet). Once it's
 * added, run a manual smoke test against a real photo before relying on this
 * for anything beyond development.
 */

// Square input simplifies prior-box indexing (the reference implementation's
// row/col loop only lines up cleanly when width == height).
const INPUT_SIZE = 320;
const STEPS = [8, 16, 32];
const MIN_SIZES = [[10, 16, 24], [32, 48], [64, 96, 128]];
const VARIANCE = [0.1, 0.2];
const CONF_THRESHOLD = 0.6;
const NMS_THRESHOLD = 0.3;
const LOC_STRIDE = 14; // 4 bbox values + 10 landmark values per anchor

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
  ort.env.wasm.wasmPaths = 'models/ort-wasm/';
  return ort.InferenceSession.create(modelUrl);
}

function computeFeatureMapSizes(inputSize) {
  const fm2 = Math.floor(Math.floor((inputSize + 1) / 2) / 2);
  const fm3 = Math.floor(fm2 / 2);
  const fm4 = Math.floor(fm3 / 2);
  const fm5 = Math.floor(fm4 / 2);
  return [fm3, fm4, fm5];
}

/**
 * Generate YuNet prior (anchor) boxes for a square input.
 * @param {number} [inputSize]
 * @returns {number[][]} array of [cx, cy, w, h], normalized to 0..1
 */
export function generatePriors(inputSize = INPUT_SIZE) {
  const featureMapSizes = computeFeatureMapSizes(inputSize);
  const priors = [];
  featureMapSizes.forEach((f, k) => {
    const minSizes = MIN_SIZES[k];
    const step = STEPS[k];
    for (let i = 0; i < f; i++) {
      for (let j = 0; j < f; j++) {
        for (const minSize of minSizes) {
          const s = minSize / inputSize;
          const cx = (j + 0.5) * step / inputSize;
          const cy = (i + 0.5) * step / inputSize;
          priors.push([cx, cy, s, s]);
        }
      }
    }
  });
  return priors;
}

/**
 * Decode raw YuNet outputs into (x, y, w, h, score) boxes, in normalized
 * [0,1] input-space coordinates (top-left origin).
 * @param {Float32Array|number[]} loc  flattened [numPriors, 14]
 * @param {Float32Array|number[]} conf flattened [numPriors, 2] (background, face)
 * @param {Float32Array|number[]} iouScores flattened [numPriors, 1]
 * @param {number[][]} priors
 * @returns {{x:number,y:number,w:number,h:number,score:number}[]}
 */
export function decodeDetections(loc, conf, iouScores, priors) {
  const boxes = [];
  for (let idx = 0; idx < priors.length; idx++) {
    const [cx, cy, sKx, sKy] = priors[idx];
    const lx = loc[idx * LOC_STRIDE + 0];
    const ly = loc[idx * LOC_STRIDE + 1];
    const lw = loc[idx * LOC_STRIDE + 2];
    const lh = loc[idx * LOC_STRIDE + 3];

    const bcx = cx + lx * VARIANCE[0] * sKx;
    const bcy = cy + ly * VARIANCE[0] * sKy;
    const bw = sKx * Math.exp(lw * VARIANCE[1]);
    const bh = sKy * Math.exp(lh * VARIANCE[1]);

    const classScore = conf[idx * 2 + 1];
    const iouScore = Math.min(Math.max(iouScores[idx], 0), 1);
    const score = Math.sqrt(Math.max(classScore * iouScore, 0));

    boxes.push({ x: bcx - bw / 2, y: bcy - bh / 2, w: bw, h: bh, score });
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

function pickOutput(outputs, outputNames, keywords, fallbackIndex) {
  const name = outputNames.find((n) => keywords.some((kw) => n.toLowerCase().includes(kw)));
  return outputs[name ?? outputNames[fallbackIndex]].data;
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
  const outputNames = session.outputNames;

  const loc = pickOutput(outputs, outputNames, ['loc', 'box'], 0);
  const conf = pickOutput(outputs, outputNames, ['conf', 'cls', 'score'], 1);
  const iouScores = pickOutput(outputs, outputNames, ['iou'], 2);

  const priors = generatePriors(INPUT_SIZE);
  const decoded = decodeDetections(loc, conf, iouScores, priors);
  const strong = decoded.filter((box) => box.score >= CONF_THRESHOLD);
  const kept = nms(strong, NMS_THRESHOLD);

  return kept.map((box) => ({
    bbox: {
      x: Math.round(box.x * INPUT_SIZE * scaleX),
      y: Math.round(box.y * INPUT_SIZE * scaleY),
      w: Math.round(box.w * INPUT_SIZE * scaleX),
      h: Math.round(box.h * INPUT_SIZE * scaleY),
    },
    confidence: box.score,
  }));
}
