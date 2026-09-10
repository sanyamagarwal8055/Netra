// Vendors the onnxruntime-web wasm runtime assets into models/ort-wasm/.
//
// MV3 extensions cannot load remotely-hosted code (no fetching from a CDN),
// so the wasm backend's loader files have to ship inside the extension
// bundle instead of being fetched from unpkg/jsdelivr at runtime. This
// script copies them from node_modules (already resolved by npm) into
// models/ort-wasm/, where src/detection/faceDetector.js's
// `ort.env.wasm.wasmPaths` points the loader.
//
// Run via `npm run build:wasm`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'node_modules', 'onnxruntime-web', 'dist');
const destDir = path.join(repoRoot, 'models', 'ort-wasm');

// At runtime, onnxruntime-web's wasm backend dynamically imports
// "ort-wasm-simd-threaded[.variant].mjs" from env.wasm.wasmPaths, which in
// turn fetches the matching ".wasm" binary from the same directory. Vendor
// every variant (base, jsep/WebGPU, jspi, asyncify) so whichever one the
// browser's feature detection picks resolves locally.
const FILES = [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jspi.mjs',
  'ort-wasm-simd-threaded.jspi.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
];

if (!fs.existsSync(srcDir)) {
  console.error(`onnxruntime-web is not installed (expected ${srcDir}). Run npm install first.`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const file of FILES) {
  const src = path.join(srcDir, file);
  if (!fs.existsSync(src)) {
    console.warn(`skip (not found in onnxruntime-web/dist): ${file}`);
    continue;
  }
  fs.copyFileSync(src, path.join(destDir, file));
  copied++;
}

console.log(`Copied ${copied}/${FILES.length} onnxruntime-web wasm asset(s) to ${path.relative(repoRoot, destDir)}${path.sep}`);
