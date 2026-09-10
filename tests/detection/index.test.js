import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/detection/faceDetector.js', () => ({
  loadFaceDetectorSession: vi.fn().mockResolvedValue({ fake: 'session' }),
  runFaceDetection: vi.fn().mockResolvedValue([
    { bbox: { x: 10, y: 20, w: 30, h: 40 }, confidence: 0.87 },
    { bbox: { x: 50, y: 60, w: 20, h: 20 }, confidence: 0.65 },
  ]),
}));

vi.mock('../../src/detection/ocr.js', () => ({
  runOcr: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/detection/piiClassifier.js', () => ({
  classifyPii: vi.fn().mockReturnValue([]),
}));

import { runOcr } from '../../src/detection/ocr.js';
import { classifyPii } from '../../src/detection/piiClassifier.js';
import { detectSensitiveRegions } from '../../src/detection/index.js';

describe('detectSensitiveRegions', () => {
  it('maps face detections into Detection objects matching the shared contract', async () => {
    const fakeImage = { width: 100, height: 100 };
    const result = await detectSensitiveRegions(fakeImage);

    expect(result).toHaveLength(2);
    for (const det of result) {
      expect(typeof det.id).toBe('string');
      expect(det.type).toBe('face');
      expect(typeof det.label).toBe('string');
      expect(det.confidence).toBeGreaterThanOrEqual(0);
      expect(det.confidence).toBeLessThanOrEqual(1);
      expect(det.bbox).toEqual(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          w: expect.any(Number),
          h: expect.any(Number),
        })
      );
    }
    expect(result[0].id).not.toBe(result[1].id);
    expect(result[0].label).toBe('FACE-1');
    expect(result[1].label).toBe('FACE-2');
  });

  it('fuses face and PII detections, numbering labels per type', async () => {
    classifyPii.mockReturnValueOnce([
      { type: 'email', bbox: { x: 1, y: 2, w: 3, h: 4 }, confidence: 0.9, matchedText: 'a@b.com' },
      { type: 'phone', bbox: { x: 5, y: 6, w: 7, h: 8 }, confidence: 0.8, matchedText: '5551234567' },
      { type: 'email', bbox: { x: 9, y: 10, w: 3, h: 4 }, confidence: 0.7, matchedText: 'c@d.com' },
      { type: 'password', bbox: { x: 11, y: 12, w: 5, h: 6 }, confidence: 0.6, matchedText: '****' },
    ]);

    const result = await detectSensitiveRegions({ width: 100, height: 100 });

    expect(result).toHaveLength(6); // 2 faces + 4 PII matches
    const byType = (type) => result.filter((d) => d.type === type);
    expect(byType('face').map((d) => d.label)).toEqual(['FACE-1', 'FACE-2']);
    expect(byType('email').map((d) => d.label)).toEqual(['EMAIL-1', 'EMAIL-2']);
    expect(byType('phone').map((d) => d.label)).toEqual(['PHONE-1']);
    expect(byType('password').map((d) => d.label)).toEqual(['PWD-1']);

    // No two detections share an id, and every id/type/bbox/label/confidence
    // field is present per the shared Detection contract, including for the
    // non-face types.
    const ids = new Set(result.map((d) => d.id));
    expect(ids.size).toBe(result.length);
    for (const det of byType('email').concat(byType('phone'), byType('password'))) {
      expect(['email', 'phone', 'password']).toContain(det.type);
      expect(det.confidence).toBeGreaterThanOrEqual(0);
      expect(det.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('returns only face detections when OCR finds no PII', async () => {
    runOcr.mockResolvedValueOnce([]);
    classifyPii.mockReturnValueOnce([]);

    const result = await detectSensitiveRegions({ width: 100, height: 100 });
    expect(result.every((d) => d.type === 'face')).toBe(true);
  });
});
