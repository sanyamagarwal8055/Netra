import { describe, it, expect } from 'vitest';
import { flattenBlocks } from '../../src/detection/ocr.js';

describe('flattenBlocks', () => {
  it('flattens blocks -> paragraphs -> lines into a flat line list with words', () => {
    const blocks = [
      {
        paragraphs: [
          {
            lines: [
              {
                text: 'hello world',
                confidence: 91,
                bbox: { x0: 0, y0: 0, x1: 100, y1: 20 },
                words: [
                  { text: 'hello', confidence: 95, bbox: { x0: 0, y0: 0, x1: 45, y1: 20 } },
                  { text: 'world', confidence: 87, bbox: { x0: 50, y0: 0, x1: 100, y1: 20 } },
                ],
              },
            ],
          },
        ],
      },
    ];

    const lines = flattenBlocks(blocks);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('hello world');
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0]).toEqual({
      text: 'hello',
      confidence: 95,
      bbox: { x0: 0, y0: 0, x1: 45, y1: 20 },
    });
  });

  it('flattens multiple blocks/paragraphs/lines in document order', () => {
    const makeLine = (text) => ({
      text,
      confidence: 90,
      bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
      words: [{ text, confidence: 90, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }],
    });
    const blocks = [
      { paragraphs: [{ lines: [makeLine('first'), makeLine('second')] }] },
      { paragraphs: [{ lines: [makeLine('third')] }, { lines: [makeLine('fourth')] }] },
    ];

    const lines = flattenBlocks(blocks);
    expect(lines.map((l) => l.text)).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it('returns an empty array for null/empty input rather than throwing', () => {
    expect(flattenBlocks(null)).toEqual([]);
    expect(flattenBlocks([])).toEqual([]);
    expect(flattenBlocks([{ paragraphs: [] }])).toEqual([]);
  });
});
