// ONE-OFF MANUAL SMOKE TEST — not part of the test suite (see tests/detection/
// for the real, permanent unit tests). Run this by hand after touching
// anything in src/detection/ to sanity-check the full pipeline (face
// detection + OCR + PII classification + fusion) against real model/OCR
// weights and a real image, per the notes in faceDetector.js's and ocr.js's
// file headers.
//
// Formerly scripts/check-face-detection.mjs (face-only); renamed and
// extended once OCR/PII classification were added, since
// detectSensitiveRegions() now returns both.
//
// Usage (from the repo root):
//   node scripts/check-detection.mjs <path-to-image.jpg|png>
//
// Prints:
//   1. The real detectSensitiveRegions() output (the actual contract:
//      id/type/bbox/label/confidence) for every detection type.
//   2. A debug view of the raw OCR line text and the PII matches
//      classifyPii() derived from it (including the matched substring),
//      so you can verify OCR actually read the right characters — a high
//      confidence + a bbox alone doesn't prove that.
// ...and writes an annotated copy of the image (color-coded boxes per
// type + label/confidence) next to the input so you can eyeball placement.
//
// Setup: this script's image decoding needs @napi-rs/canvas, which is NOT a
// project dependency (Node has no built-in JPEG/PNG decoder or OffscreenCanvas,
// both of which the real detectSensitiveRegions() pipeline needs). It's
// installed only in scripts/node_modules via scripts/package.json, so it does
// NOT touch the shared root package.json. Run once: `cd scripts && npm install`.
//
// First run will also download Tesseract.js's English language data and wasm
// core over the network (cached under scripts/node_modules/tesseract.js-core
// and a local traineddata cache afterward) — see ocr.js's file header for the
// known MV3 CDN-loading gap this doesn't yet solve.

import path from 'node:path';
import fs from 'node:fs/promises';
import pkg from '@napi-rs/canvas';

const { createCanvas, loadImage } = pkg;

// detectSensitiveRegions() -> runFaceDetection()/runOcr() call
// `new OffscreenCanvas(...)`, which doesn't exist in Node. Polyfill it with
// @napi-rs/canvas's Canvas, which implements the same getContext('2d') /
// drawImage / getImageData surface those rely on. ocr.js also calls
// `canvas.toBuffer(...)` directly under Node (see its file header), so the
// polyfill forwards that too.
globalThis.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this._canvas = createCanvas(width, height);
  }
  getContext(type) {
    return this._canvas.getContext(type);
  }
  toBuffer(...args) {
    return this._canvas.toBuffer(...args);
  }
};

const { detectSensitiveRegions } = await import('../src/detection/index.js');
const { runOcr, terminateOcrWorker } = await import('../src/detection/ocr.js');
const { classifyPii } = await import('../src/detection/piiClassifier.js');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node scripts/check-detection.mjs <path-to-image.jpg|png>');
  process.exit(1);
}

const image = await loadImage(imagePath);
console.log(`Loaded ${imagePath} (${image.width}x${image.height})`);

console.time('detectSensitiveRegions');
const detections = await detectSensitiveRegions(image);
console.timeEnd('detectSensitiveRegions');

console.log(`\n=== detectSensitiveRegions() output (${detections.length} detection(s)) ===`);
if (detections.length === 0) {
  console.log('(none)');
} else {
  for (const d of detections) {
    const { x, y, w, h } = d.bbox;
    console.log(
      `  [${d.type}] ${d.label}  bbox={x:${x}, y:${y}, w:${w}, h:${h}}  confidence=${d.confidence.toFixed(3)}`,
    );
  }
}

// Debug view: what did OCR actually read, and what did the regex
// classifier match against it? This is the only way to confirm correctness
// (a bbox + confidence number alone doesn't prove the text was read right).
console.log('\n=== Raw OCR lines ===');
const ocrLines = await runOcr(image);
if (ocrLines.length === 0) {
  console.log('(no text found)');
} else {
  for (const line of ocrLines) {
    console.log(`  "${line.text}"  (line confidence=${line.confidence.toFixed(1)})`);
  }
}

console.log('\n=== PII matches (classifyPii) ===');
const piiMatches = classifyPii(ocrLines);
if (piiMatches.length === 0) {
  console.log('(none)');
} else {
  for (const m of piiMatches) {
    console.log(`  [${m.type}] matchedText="${m.matchedText}"  confidence=${m.confidence.toFixed(3)}`);
  }
}

// Draw an annotated copy, color-coded per type, so you can visually confirm
// box placement.
const BOX_COLOR = {
  face: '#00ff00',
  email: '#ff3b3b',
  phone: '#3b82ff',
  password: '#ffa500',
};

const canvas = createCanvas(image.width, image.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(image, 0, 0);
ctx.lineWidth = Math.max(2, Math.round(image.width / 300));
ctx.font = `${Math.max(16, Math.round(image.width / 60))}px sans-serif`;
for (const d of detections) {
  const { x, y, w, h } = d.bbox;
  const color = BOX_COLOR[d.type] ?? '#ffffff';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.strokeRect(x, y, w, h);
  ctx.fillText(`${d.label} ${d.confidence.toFixed(2)}`, x, Math.max(0, y - 6));
}

const parsed = path.parse(imagePath);
const outPath = path.join(parsed.dir, `${parsed.name}.annotated.png`);
await fs.writeFile(outPath, canvas.toBuffer('image/png'));
console.log(`\nAnnotated image written to ${outPath}`);

// Without this, Tesseract's worker_threads Worker keeps this process alive
// indefinitely after the script's own logic is done.
await terminateOcrWorker();
