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
 * MV3 note: same CDN-loading gap already solved for onnxruntime-web (see
 * faceDetector.js and `npm run build:wasm`) applied here too — by default
 * Tesseract.js fetches its worker script, wasm core, and language
 * traineddata from jsdelivr, which MV3 extensions cannot do. `npm run
 * build:tesseract` (scripts/copy-tesseract-assets.mjs) vendors all three
 * into models/tesseract/, and getWorker() below points at that local
 * directory instead of letting Tesseract.js fall back to its CDN defaults.
 */

const isNode = typeof process !== 'undefined' && !!process.versions?.node;

function localAssetPath(relativePath) {
  const hasExtensionRuntime = typeof chrome !== 'undefined' && !!chrome.runtime?.getURL;
  // Same reasoning as faceDetector.js's wasmPaths fix: a bare relative
  // string resolves against the importing module's URL once bundled, not
  // the extension root, so chrome.runtime.getURL is needed for a
  // bundle-layout-proof absolute URL. Fall back to the relative path for a
  // plain (non-extension) browser page during dev.
  return hasExtensionRuntime ? chrome.runtime.getURL(relativePath) : relativePath;
}

let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      // Node's worker/core loading is already fully local by construction
      // (getCore() `require()`s tesseract.js-core directly; workerPath
      // would need to be a Node worker_threads-compatible module, and
      // worker.min.js is a browser bundle that is NOT one — passing it
      // under Node would break worker spawning). Its language-data loading
      // is the one piece that's CDN-by-default under Node too, so that's
      // the only path pointed locally here; workerPath/corePath are left
      // untouched (Node's own internal defaults) when isNode.
      const options = isNode
        ? { langPath: 'models/tesseract', cacheMethod: 'none' }
        : {
            workerPath: localAssetPath('models/tesseract/worker.min.js'),
            corePath: localAssetPath('models/tesseract/'),
            langPath: localAssetPath('models/tesseract/'),
            cacheMethod: 'none',
          };
      return createWorker('eng', OEM.LSTM_ONLY, options);
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

/**
 * Terminate the cached OCR worker, if one was ever created. The browser
 * extension doesn't need this (the worker thread dies with the popup page),
 * but a standalone Node script does — otherwise Tesseract's worker_threads
 * Worker keeps the process alive indefinitely after the script's own logic
 * finishes (see scripts/check-detection.mjs, which calls this at the end).
 */
export async function terminateOcrWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}
