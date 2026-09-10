// OWNED BY: Person 1
// Do not edit from the redaction/UI side without flagging Person 1 first.

import { loadFaceDetectorSession, runFaceDetection } from './faceDetector.js';
import { runOcr } from './ocr.js';
import { classifyPii } from './piiClassifier.js';

/**
 * @typedef {import('../shared/types.js').Detection} Detection
 */

let sessionPromise = null;
function getSession() {
  if (!sessionPromise) {
    sessionPromise = loadFaceDetectorSession();
  }
  return sessionPromise;
}

const LABEL_PREFIX = {
  face: 'FACE',
  email: 'EMAIL',
  phone: 'PHONE',
  password: 'PWD',
};

/**
 * Given an input image, detect all sensitive regions (faces, PII text, etc.)
 * and return them as a list of Detection objects (see src/shared/types.js).
 *
 * Face detection and OCR/PII classification are independent pipelines
 * (bounding a face vs. bounding OCR'd text) whose outputs essentially never
 * legitimately overlap in practice, so fusion here is a plain concatenation
 * rather than a cross-type NMS pass: suppressing one detection because it
 * happens to overlap the other would silently drop a genuinely distinct
 * sensitive region (e.g. a face AND a name badge behind it) from the
 * output. Each pipeline is responsible for de-duplicating its own
 * detections (runFaceDetection already does IoU-based NMS internally;
 * classifyPii's line-by-line, non-overlapping word consumption means it
 * can't produce overlapping PII matches of its own).
 *
 * NER-based name detection ('text-pii') is not implemented yet — only
 * regex-matched email/phone, plus masked-password detection. See
 * piiClassifier.js for known accuracy limitations of the regex approach.
 *
 * @param {ImageBitmap|HTMLImageElement} image
 * @returns {Promise<Detection[]>}
 */
export async function detectSensitiveRegions(image) {
  const session = await getSession();
  const [faces, ocrLines] = await Promise.all([
    runFaceDetection(session, image),
    runOcr(image),
  ]);
  const piiMatches = classifyPii(ocrLines);

  const detections = [];
  const labelCounters = {};
  let idCounter = 0;

  const addDetection = (type, bbox, confidence) => {
    labelCounters[type] = (labelCounters[type] ?? 0) + 1;
    idCounter += 1;
    detections.push({
      id: `det-${idCounter}`,
      type,
      bbox,
      label: `${LABEL_PREFIX[type]}-${labelCounters[type]}`,
      confidence,
    });
  };

  for (const face of faces) addDetection('face', face.bbox, face.confidence);
  for (const match of piiMatches) addDetection(match.type, match.bbox, match.confidence);

  return detections;
}
