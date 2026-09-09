import { describe, it, expect } from 'vitest';
import { generatePriors, decodeStride, nms } from '../../src/detection/faceDetector.js';

describe('generatePriors', () => {
  it('produces one row-major {row,col,stride} anchor per grid cell, across all strides', () => {
    const priors = generatePriors(640);
    // strides [8,16,32] over a 640 input -> grids of 80x80, 40x40, 20x20
    expect(priors.length).toBe(80 * 80 + 40 * 40 + 20 * 20);
    for (const { row, col, stride } of priors) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(col).toBeGreaterThanOrEqual(0);
      expect([8, 16, 32]).toContain(stride);
    }
    // row-major order within the first (stride-8) grid
    expect(priors[0]).toEqual({ row: 0, col: 0, stride: 8 });
    expect(priors[1]).toEqual({ row: 0, col: 1, stride: 8 });
    expect(priors[80]).toEqual({ row: 1, col: 0, stride: 8 });
  });

  it('is deterministic for a given input size', () => {
    expect(generatePriors(640)).toEqual(generatePriors(640));
  });
});

describe('decodeStride', () => {
  it('reproduces the cell-center box exactly when bbox deltas are zero and scores are 1', () => {
    const fm = 1;
    const stride = 8;
    const cls = new Float32Array([1]);
    const obj = new Float32Array([1]);
    const bbox = new Float32Array([0, 0, 0, 0]); // dx=dy=0, w=h=exp(0)*stride

    const [box] = decodeStride(cls, obj, bbox, fm, stride);
    expect(box.x).toBeCloseTo(0 - stride / 2);
    expect(box.y).toBeCloseTo(0 - stride / 2);
    expect(box.w).toBeCloseTo(stride);
    expect(box.h).toBeCloseTo(stride);
    expect(box.score).toBeCloseTo(1);
  });

  it('clamps out-of-range scores before combining cls and obj', () => {
    const fm = 1;
    const stride = 8;
    const cls = new Float32Array([5]); // should clamp to 1
    const obj = new Float32Array([1]);
    const bbox = new Float32Array([0, 0, 0, 0]);

    const [box] = decodeStride(cls, obj, bbox, fm, stride);
    expect(box.score).toBeCloseTo(1);
  });

  it('offsets the cell center by (col, row) before scaling by stride', () => {
    const fm = 2;
    const stride = 8;
    const cls = new Float32Array([1, 1, 1, 1]);
    const obj = new Float32Array([1, 1, 1, 1]);
    const bbox = new Float32Array(2 * 2 * 4); // all-zero deltas

    const boxes = decodeStride(cls, obj, bbox, fm, stride);
    // idx 1 -> row 0, col 1 -> cx = (1 + 0) * 8 = 8
    expect(boxes[1].x).toBeCloseTo(8 - stride / 2);
    // idx 2 -> row 1, col 0 -> cy = (1 + 0) * 8 = 8
    expect(boxes[2].y).toBeCloseTo(8 - stride / 2);
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
