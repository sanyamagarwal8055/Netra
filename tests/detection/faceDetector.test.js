import { describe, it, expect } from 'vitest';
import { generatePriors, decodeDetections, nms } from '../../src/detection/faceDetector.js';

describe('generatePriors', () => {
  it('produces normalized [0,1] priors with positive width/height', () => {
    const priors = generatePriors(320);
    expect(priors.length).toBeGreaterThan(0);
    for (const [cx, cy, w, h] of priors) {
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cx).toBeLessThanOrEqual(1);
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(1);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
  });

  it('is deterministic for a given input size', () => {
    expect(generatePriors(320)).toEqual(generatePriors(320));
  });
});

describe('decodeDetections', () => {
  it('reproduces the prior box exactly when loc deltas are zero and confidence is 1', () => {
    const priors = [[0.5, 0.5, 0.1, 0.2]];
    const loc = new Float32Array(14); // all-zero deltas
    const conf = new Float32Array([0, 1]); // background=0, face=1
    const iouScores = new Float32Array([1]);

    const [box] = decodeDetections(loc, conf, iouScores, priors);
    expect(box.x).toBeCloseTo(0.5 - 0.05);
    expect(box.y).toBeCloseTo(0.5 - 0.1);
    expect(box.w).toBeCloseTo(0.1);
    expect(box.h).toBeCloseTo(0.2);
    expect(box.score).toBeCloseTo(1);
  });

  it('clamps out-of-range iou scores before combining with class score', () => {
    const priors = [[0.5, 0.5, 0.1, 0.1]];
    const loc = new Float32Array(14);
    const conf = new Float32Array([0, 1]);
    const iouScores = new Float32Array([5]); // should clamp to 1

    const [box] = decodeDetections(loc, conf, iouScores, priors);
    expect(box.score).toBeCloseTo(1);
  });
});

describe('nms', () => {
  it('drops heavily overlapping boxes, keeping the higher-scoring one', () => {
    const boxes = [
      { x: 0, y: 0, w: 10, h: 10, score: 0.9 },
      { x: 1, y: 1, w: 10, h: 10, score: 0.5 },
    ];
    const kept = nms(boxes, 0.3);
    expect(kept).toHaveLength(1);
    expect(kept[0].score).toBe(0.9);
  });

  it('keeps non-overlapping boxes', () => {
    const boxes = [
      { x: 0, y: 0, w: 10, h: 10, score: 0.9 },
      { x: 100, y: 100, w: 10, h: 10, score: 0.5 },
    ];
    const kept = nms(boxes, 0.3);
    expect(kept).toHaveLength(2);
  });
});
