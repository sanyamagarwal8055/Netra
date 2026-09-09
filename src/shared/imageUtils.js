/**
 * SHARED FILE — generic image conversion helpers used by both modules.
 * Signatures below are agreed. If you need to change a signature, message
 * the other person first — both modules call these.
 */

/**
 * Load a File (from an <input type="file">) into an HTMLImageElement or ImageBitmap.
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
export async function loadImageFromFile(file) {
  throw new Error('imageUtils.loadImageFromFile: not implemented yet');
}

/**
 * Convert an ImageBitmap/HTMLImageElement into ImageData for pixel-level processing.
 * @param {ImageBitmap|HTMLImageElement} image
 * @returns {ImageData}
 */
export function imageToImageData(image) {
  throw new Error('imageUtils.imageToImageData: not implemented yet');
}

/**
 * Render a canvas back out to a downloadable/displayable image (e.g. a data URL).
 * @param {HTMLCanvasElement} canvas
 * @returns {string} data URL
 */
export function canvasToDataUrl(canvas) {
  throw new Error('imageUtils.canvasToDataUrl: not implemented yet');
}
