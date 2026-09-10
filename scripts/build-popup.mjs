// Bundles src/ui/popup.js (and everything it imports, including
// src/detection's bare `import('onnxruntime-web')` / `import('tesseract.js')`)
// into a single browser-ready ES module at dist/popup.bundle.js.
//
// MV3 popup pages are loaded as native <script type="module">, which has no
// bare-specifier resolution (that's a Node/bundler-only convention) — hence
// this build step. popup.html's <script> tag points at the bundled output,
// not at src/ui/popup.js directly.
//
// The `onnxruntime-web-use-extern-wasm` condition is required: without it,
// onnxruntime-web's package.json#exports resolves the browser import to
// dist/ort.bundle.min.mjs, which resolves its wasm loader relative to its
// own bundled location. With the condition, it resolves to dist/ort.min.mjs
// instead, which honors `ort.env.wasm.wasmPaths` — the path faceDetector.js
// already points at the vendored models/ort-wasm/ assets (see
// scripts/copy-ort-wasm.mjs). Using the wrong variant would silently break
// wasm loading even though the bundle itself builds fine.
//
// Run via `node scripts/build-popup.mjs` (or `npm run build:popup` once
// that script exists in package.json).

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(repoRoot, 'src/ui/popup.js')],
  outfile: path.join(repoRoot, 'dist/popup.bundle.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome100'],
  conditions: ['onnxruntime-web-use-extern-wasm'],
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes to src/ui/popup.js and its imports...');
} else {
  await esbuild.build(buildOptions);
  console.log(`Bundled to ${path.relative(repoRoot, buildOptions.outfile)}`);
}
