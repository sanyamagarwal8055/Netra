// Vendors Tesseract.js's runtime assets (worker script, wasm core, English
// language data) into models/tesseract/.
//
// Same MV3 constraint already solved for onnxruntime-web (see
// copy-ort-wasm.mjs): extensions can't load remotely-hosted code, but
// Tesseract.js defaults to fetching its worker script, wasm core, and
// language traineddata from jsdelivr. The worker script and wasm core are
// copied from node_modules (already resolved by npm, same idea as the ORT
// assets). The English language data is different: npm doesn't ship
// traineddata files at all — jsdelivr is the *only* distribution channel
// for them, even for local vendoring — so this does a one-time network
// fetch + decompress during the build, no different in kind from how
// models/face_detection_yunet_2023mar.onnx itself was obtained. The
// resulting local file is what makes the shipped extension CDN-free, even
// though building it once requires the network.
//
// Run via `npm run build:tesseract`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const destDir = path.join(repoRoot, 'models', 'tesseract');

fs.mkdirSync(destDir, { recursive: true });

// --- worker script ---
const workerSrc = path.join(repoRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
if (!fs.existsSync(workerSrc)) {
  console.error(`tesseract.js is not installed (expected ${workerSrc}). Run npm install first.`);
  process.exit(1);
}
fs.copyFileSync(workerSrc, path.join(destDir, 'worker.min.js'));
console.log('Copied worker.min.js');

// --- wasm core ---
// ocr.js always requests OEM.LSTM_ONLY (createWorker's default), so only
// the "*-lstm" core variants are ever reachable at runtime — the legacy
// (non-LSTM) engine variants are deliberately not vendored since nothing
// in this codebase selects them. All three LSTM variants ARE vendored
// because which one gets picked depends on the browser's WASM SIMD
// support, detected at runtime (see tesseract.js's browser getCore.js).
const coreDir = path.join(repoRoot, 'node_modules', 'tesseract.js-core');
const CORE_FILES = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm',
];
let coreCopied = 0;
for (const file of CORE_FILES) {
  const src = path.join(coreDir, file);
  if (!fs.existsSync(src)) {
    console.warn(`skip (not found in tesseract.js-core): ${file}`);
    continue;
  }
  fs.copyFileSync(src, path.join(destDir, file));
  coreCopied++;
}
console.log(`Copied ${coreCopied}/${CORE_FILES.length} wasm core file(s)`);

// --- English language data ---
// "_best_int" matches what Tesseract.js itself requests by default when
// lstmOnly is true (our case) — see its worker-script/index.js. Kept
// gzipped (~2.9MB vs ~5.2MB decompressed) since Tesseract.js's loader
// auto-detects gzip via magic bytes and decompresses at load time
// regardless — no reason to ship the larger decompressed file in the
// extension bundle. ocr.js relies on the `gzip` option's default (true)
// matching this ".gz" filename; don't rename this file without also
// changing that.
const LANG_DATA_URL = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
const langDataDest = path.join(destDir, 'eng.traineddata.gz');
if (fs.existsSync(langDataDest)) {
  console.log(`eng.traineddata.gz already present, skipping download (delete ${path.relative(repoRoot, langDataDest)} to force a re-fetch)`);
} else {
  console.log(`Downloading ${LANG_DATA_URL} ...`);
  const res = await fetch(LANG_DATA_URL);
  if (!res.ok) {
    throw new Error(`Failed to download eng.traineddata.gz: HTTP ${res.status}`);
  }
  const gz = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(langDataDest, gz);
  console.log(`Wrote ${path.relative(repoRoot, langDataDest)} (${gz.length} bytes)`);
}
