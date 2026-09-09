// OWNED BY: Person 1
// Do not edit from the redaction/UI side without flagging Person 1 first.

/**
 * @typedef {import('../shared/types.js').Detection} Detection
 */

/**
 * Given an input image, detect all sensitive regions (faces, PII text, etc.)
 * and return them as a list of Detection objects (see src/shared/types.js).
 *
 * @param {ImageBitmap|HTMLImageElement} image
 * @returns {Promise<Detection[]>}
 */
export async function detectSensitiveRegions(image) {
  // TODO(Person 1): implement face detection + OCR + PII classification + fusion.
  throw new Error('detectSensitiveRegions: not implemented yet');
}
