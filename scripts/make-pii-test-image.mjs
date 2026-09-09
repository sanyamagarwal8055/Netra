// ONE-OFF TEST FIXTURE GENERATOR — not part of the test suite. Composites a
// real photo (a genuine face-detection challenge) with a rendered text
// banner (genuine, actually-rasterized pixels Tesseract must actually OCR —
// not a mocked Detection) containing an email, a phone number, and two
// masked-password variants, to end-to-end smoke-test the fused
// face+OCR+PII pipeline in one image.
//
// Produces two variants:
//   pii-test-easy.png  — large, high-contrast black-on-white text.
//   pii-test-hard.png  — small, low-contrast gray-on-white text, to
//                        demonstrate (not just assert) OCR's known weak
//                        spot on small/low-contrast text.
//
// Usage: node scripts/make-pii-test-image.mjs

import path from 'node:path';
import fs from 'node:fs/promises';
import pkg from '@napi-rs/canvas';

const { createCanvas, loadImage } = pkg;

const SOURCE_IMAGE = path.join('scripts', 'test-images', 'obama-official-portrait.jpg');
const BANNER_HEIGHT = 700;

async function makeVariant({ outFile, fontSize, textColor, lineGap }) {
  const source = await loadImage(SOURCE_IMAGE);
  const canvas = createCanvas(source.width, source.height + BANNER_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);

  ctx.fillStyle = textColor;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';
  const lines = [
    'Contact: jane.doe@example.com',
    'Phone: (555) 123-4567',
    'Password: ••••••••',
    'PIN: ********',
  ];
  let y = source.height + 40;
  for (const line of lines) {
    ctx.fillText(line, 40, y);
    y += fontSize + lineGap;
  }

  const outPath = path.join('scripts', 'test-images', outFile);
  await fs.writeFile(outPath, canvas.toBuffer('image/png'));
  console.log(`Wrote ${outPath} (${canvas.width}x${canvas.height}, font=${fontSize}px, color=${textColor})`);
}

await makeVariant({ outFile: 'pii-test-easy.png', fontSize: 60, textColor: '#000000', lineGap: 30 });
await makeVariant({ outFile: 'pii-test-hard.png', fontSize: 16, textColor: '#bbbbbb', lineGap: 10 });
