// Used by Person 2 to develop/test the redaction+UI module before Person 1's
// real detectSensitiveRegions() is ready. Matches the Detection shape in
// src/shared/types.js exactly.

/**
 * @typedef {import('../shared/types.js').Detection} Detection
 */

/** @type {Detection[]} */
export const mockDetections = [
  {
    id: 'det-1',
    type: 'face',
    bbox: { x: 120, y: 60, w: 140, h: 160 },
    label: 'FACE-1',
    confidence: 0.97,
  },
  {
    id: 'det-2',
    type: 'email',
    bbox: { x: 40, y: 320, w: 220, h: 24 },
    label: 'PII-1',
    confidence: 0.88,
  },
  {
    id: 'det-3',
    type: 'password',
    bbox: { x: 40, y: 360, w: 180, h: 24 },
    label: 'PII-2',
    confidence: 0.92,
  },
];

/**
 * @returns {Promise<Detection[]>} resolves like the real detectSensitiveRegions() would
 */
export async function getMockDetections() {
  return mockDetections;
}
