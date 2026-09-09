// OWNED BY: Person 1

/**
 * OCR via Tesseract.js — locates text regions in an image and extracts the
 * text string in each one, for downstream PII classification (see
 * piiClassifier.js).
 *
 * KNOWN LIMITATION: small or low-contrast text is a well-documented weak
 * point for Tesseract's LSTM engine — expect missed lines and transcription
 * errors (dropped/substituted characters) there, which will silently cause
 * classifyPii() to miss or mis-extract PII. This isn't hypothetical — see
 * scripts/check-detection.mjs and scripts/make-pii-test-image.mjs: a 16px
 * #bbbbbb-on-white line wasn't detected at all (not even as garbled OCR
 * output), and even 60px high-contrast text came back with a wrong digit
 * ("555" read as "553"). See piiClassifier.js's file header for the full
 * list of observed failures, including masked-password detection.
 *
 * TODO(Person 1): same MV3 CDN-loading gap already solved for
 * onnxruntime-web (see faceDetector.js and `npm run build:wasm`) applies
 * here too — by default Tesseract.js fetches its worker script, wasm core,
 * and language traineddata from a CDN, which MV3 extensions cannot do.
 * Not yet vendored locally; flagged as a known gap, not fixed in this pass.
 */

let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng');
    })();
  }
  return workerPromise;
}

/**
 * Flatten Tesseract's blocks -> paragraphs -> lines -> words tree (from
 * `recognize(..., { blocks: true })`) into a flat list of lines, each
 * carrying its words with bbox/confidence. Pure function, exported so it
 * can be unit-tested with synthetic data instead of running real OCR.
 * @param {Array} blocks Tesseract's `data.blocks`
 * @returns {{text:string, confidence:number, bbox:{x0:number,y0:number,x1:number,y1:number},
 *   words:{text:string, confidence:number, bbox:{x0:number,y0:number,x1:number,y1:number}}[]}[]}
 */
export function flattenBlocks(blocks) {
  const lines = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        lines.push({
          text: line.text,
          confidence: line.confidence,
          bbox: line.bbox,
          words: (line.words ?? []).map((w) => ({
            text: w.text,
            confidence: w.confidence,
            bbox: w.bbox,
          })),
        });
      }
    }
  }
  return lines;
}

const isNode = typeof process !== 'undefined' && !!process.versions?.node;

/**
 * Run OCR on `image` and return its text lines (see flattenBlocks), in
 * source-image pixel coordinates (no resizing is done, unlike the face
 * detector's fixed 640x640 input — full resolution gives OCR the best
 * chance on small text).
 * @param {ImageBitmap|HTMLImageElement} image
 * @returns {Promise<ReturnType<typeof flattenBlocks>>}
 */
export async function runOcr(image) {
  const worker = await getWorker();

  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  // Tesseract's browser image loader accepts a real OffscreenCanvas
  // directly (it calls canvas.convertToBlob() internally). Under Node —
  // only exercised by the manual smoke test in scripts/, since the shipped
  // extension always runs in a browser — Tesseract resolves to its
  // Node-specific loader instead, which expects a Buffer, not a canvas
  // object, hence the branch.
  const source = isNode ? canvas.toBuffer('image/png') : canvas;

  const { data } = await worker.recognize(source, {}, { blocks: true });
  return flattenBlocks(data.blocks);
}
