// OWNED BY: Person 1
// Do not edit from the redaction/UI side without flagging Person 1 first.

import { loadFaceDetectorSession, runFaceDetection } from './faceDetector.js';

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

/**
 * Given an input image, detect all sensitive regions (faces, PII text, etc.)
 * and return them as a list of Detection objects (see src/shared/types.js).
 *
 * Currently implements face detection only. OCR + PII classification + fusion
 * (see CLAUDE.md's documented detection pipeline) are TODO.
 *
 * @param {ImageBitmap|HTMLImageElement} image
 * @returns {Promise<Detection[]>}
 */
export async function detectSensitiveRegions(image) {
  const session = await getSession();
  const faces = await runFaceDetection(session, image);

  return faces.map((face, i) => ({
    id: `det-${i + 1}`,
    type: 'face',
    bbox: face.bbox,
    label: `FACE-${i + 1}`,
    confidence: face.confidence,
  }));

  // TODO(Person 1): OCR (Tesseract.js) to locate text regions, PII
  // classification (regex first, optionally a small NER model), then fuse
  // those detections with the faces above into one Detection[] with
  // resolved overlaps.
}
