import { describe, it, expect } from 'vitest';
import { classifyPii } from '../../src/detection/piiClassifier.js';

// Builds a synthetic OCR line (matching ocr.js's flattenBlocks shape) from
// plain word strings laid out left-to-right, so tests don't need real OCR.
function makeLine(wordTexts, { confidence = 90 } = {}) {
  const words = wordTexts.map((text, i) => ({
    text,
    confidence,
    bbox: { x0: i * 100, y0: 0, x1: i * 100 + 90, y1: 20 },
  }));
  return {
    text: wordTexts.join(' '),
    confidence,
    bbox: { x0: 0, y0: 0, x1: words.length * 100, y1: 20 },
    words,
  };
}

describe('classifyPii', () => {
  it('detects a single-word email and normalizes confidence to 0..1', () => {
    const lines = [makeLine(['Contact:', 'jane.doe@example.com'], { confidence: 88 })];
    const matches = classifyPii(lines);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ type: 'email', matchedText: 'jane.doe@example.com' });
    expect(matches[0].confidence).toBeCloseTo(0.88);
  });

  it('strips trailing punctuation from an email before matching', () => {
    const lines = [makeLine(['Email', 'me:', 'jane.doe@example.com,'])];
    const matches = classifyPii(lines);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedText).toBe('jane.doe@example.com');
  });

  it('detects a phone number split across multiple OCR words, with a unioned bbox', () => {
    const lines = [makeLine(['Call', '(555)', '123-4567', 'today'])];
    const matches = classifyPii(lines);

    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('phone');
    expect(matches[0].matchedText).toBe('(555) 123-4567');
    // union of the "(555)" (index 1) and "123-4567" (index 2) word boxes
    expect(matches[0].bbox).toEqual({ x: 100, y: 0, w: 190, h: 20 });
  });

  it('detects a phone number rendered as a single unbroken token', () => {
    const lines = [makeLine(['5551234567'])];
    const matches = classifyPii(lines);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('phone');
  });

  it('does not treat an unrelated preceding word as part of the phone number', () => {
    const lines = [makeLine(['Order', '5551234567'])];
    const matches = classifyPii(lines);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedText).toBe('5551234567');
  });

  it('detects a masked password field as its own type', () => {
    const lines = [makeLine(['Password:', '••••••••'])];
    const matches = classifyPii(lines);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('password');
    expect(matches[0].matchedText).toBe('••••••••');
  });

  it('detects an asterisk-masked password field', () => {
    const lines = [makeLine(['pwd', '********'])];
    const matches = classifyPii(lines);
    expect(matches.some((m) => m.type === 'password')).toBe(true);
  });

  it('does not flag ordinary short words as masked passwords', () => {
    const lines = [makeLine(['just', 'a', 'normal', 'sentence'])];
    expect(classifyPii(lines)).toHaveLength(0);
  });

  it('does not match plain prose with no PII', () => {
    const lines = [makeLine(['The', 'quick', 'brown', 'fox'])];
    expect(classifyPii(lines)).toHaveLength(0);
  });

  it('finds multiple distinct matches across multiple lines', () => {
    const lines = [
      makeLine(['Email:', 'a@b.com']),
      makeLine(['Phone:', '555-123-4567']),
      makeLine(['Password:', '••••']),
    ];
    const matches = classifyPii(lines);
    expect(matches.map((m) => m.type).sort()).toEqual(['email', 'password', 'phone']);
  });

  it('does not re-scan words already consumed by an earlier match on the same line', () => {
    // "555-123-4567" alone (len 1) already satisfies PHONE_REGEX, so the
    // classifier should consume just that one word, not swallow "and" too.
    const lines = [makeLine(['555-123-4567', 'and', 'a@b.com'])];
    const matches = classifyPii(lines);
    expect(matches).toHaveLength(2);
    expect(matches[0].matchedText).toBe('555-123-4567');
    expect(matches[1].matchedText).toBe('a@b.com');
  });
});
