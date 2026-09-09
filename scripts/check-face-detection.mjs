// ONE-OFF MANUAL SMOKE TEST — not part of the test suite (see tests/detection/
// for the real, permanent unit tests). Run this by hand after touching
// src/detection/faceDetector.js to sanity-check it against the real model
// weights and a real photo, per the note in faceDetector.js's file header.
//
// Usage (from the repo root):
//   node scripts/check-face-detection.mjs <path-to-image.jpg|png>
//
// Prints each detected face's bbox (x, y, w, h) and confidence, and writes
// an annotated copy of the image (boxes + confidence drawn on top) next to
// the input so you can eyeball whether the boxes actually land on faces.
//
// Setup: this script's image decoding needs @napi-rs/canvas, which is NOT a
// project dependency (Node has no built-in JPEG/PNG decoder or OffscreenCanvas,
// both of which the real detectSensitiveRegions() pipeline needs). It's
// installed only in scripts/node_modules via scripts/package.json, so it does
// NOT touch the shared root package.json. Run once: `cd scripts && npm install`.

import path from 'node:path';
import pkg from '@napi-rs/canvas';

const { createCanvas, loadImage } = pkg;

// detectSensitiveRegions() -> runFaceDetection() -> preprocess() calls
// `new OffscreenCanvas(...)`, which doesn't exist in Node. Polyfill it with
// @napi-rs/canvas's Canvas, which implements the same getContext('2d') /
// drawImage / getImageData surface preprocess() relies on.
globalThis.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this._canvas = createCanvas(width, height);
  }
  getContext(type) {
    return this._canvas.getContext(type);
  }
};

const { detectSensitiveRegions } = await import('../src/detection/index.js');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node scripts/check-face-detection.mjs <path-to-image.jpg|png>');
  process.exit(1);
}

const image = await loadImage(imagePath);
console.log(`Loaded ${imagePath} (${image.width}x${image.height})`);

console.time('detectSensitiveRegions');
const detections = await detectSensitiveRegions(image);
console.timeEnd('detectSensitiveRegions');

if (detections.length === 0) {
  console.log('No faces detected.');
} else {
  console.log(`Detected ${detections.length} face(s):`);
  for (const d of detections) {
    const { x, y, w, h } = d.bbox;
    console.log(
      `  ${d.label}  bbox={x:${x}, y:${y}, w:${w}, h:${h}}  confidence=${d.confidence.toFixed(3)}`,
    );
  }
}

// Draw an annotated copy so you can visually confirm the boxes land on faces.
const canvas = createCanvas(image.width, image.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(image, 0, 0);
ctx.strokeStyle = '#00ff00';
ctx.lineWidth = Math.max(2, Math.round(image.width / 300));
ctx.font = `${Math.max(16, Math.round(image.width / 40))}px sans-serif`;
ctx.fillStyle = '#00ff00';
for (const d of detections) {
  const { x, y, w, h } = d.bbox;
  ctx.strokeRect(x, y, w, h);
  ctx.fillText(`${d.label} ${d.confidence.toFixed(2)}`, x, Math.max(0, y - 6));
}

const parsed = path.parse(imagePath);
const outPath = path.join(parsed.dir, `${parsed.name}.annotated.png`);
await import('node:fs/promises').then((fs) => fs.writeFile(outPath, canvas.toBuffer('image/png')));
console.log(`Annotated image written to ${outPath}`);
