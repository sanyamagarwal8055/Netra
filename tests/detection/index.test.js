import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/detection/faceDetector.js', () => ({
  loadFaceDetectorSession: vi.fn().mockResolvedValue({ fake: 'session' }),
  runFaceDetection: vi.fn().mockResolvedValue([
    { bbox: { x: 10, y: 20, w: 30, h: 40 }, confidence: 0.87 },
    { bbox: { x: 50, y: 60, w: 20, h: 20 }, confidence: 0.65 },
  ]),
}));

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
});
