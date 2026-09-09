// OWNED BY: Person 2 (Vivaan)
// Do not edit from the detection side without flagging Person 2 first.

/**
 * @typedef {import('../shared/types.js').Detection} Detection
 */

/**
 * Given the original image and a list of Detections, draw the redacted
 * (Set-of-Mark) output: blur/mask sensitive regions and label them.
 *
 * @param {ImageBitmap|HTMLImageElement} image
 * @param {Detection[]} detections
 * @returns {HTMLCanvasElement} canvas containing the redacted image
 */
export function renderRedactedImage(image, detections) {
  // TODO(Person 2): implement Set-of-Mark overlay + blur/mask rendering.
  throw new Error('renderRedactedImage: not implemented yet');
}
