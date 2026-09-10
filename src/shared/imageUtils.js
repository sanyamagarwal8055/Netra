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
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Convert an ImageBitmap/HTMLImageElement into ImageData for pixel-level processing.
 * @param {ImageBitmap|HTMLImageElement} image
 * @returns {ImageData}
 */
export function imageToImageData(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('imageUtils.imageToImageData: failed to get 2d context');
  }
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Render a canvas back out to a downloadable/displayable image (e.g. a data URL).
 * @param {HTMLCanvasElement} canvas
 * @returns {string} data URL
 */
export function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

