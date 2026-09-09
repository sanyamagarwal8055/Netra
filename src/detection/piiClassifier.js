// OWNED BY: Person 1

/**
 * Regex-only PII classification over OCR line/word data (see ocr.js's
 * flattenBlocks). Deliberately narrow scope, per CLAUDE.md's documented
 * pipeline:
 *   - email:    a single OCR word matching a standard email pattern.
 *   - phone:    a short run of consecutive OCR words (starting at a token
 *               that looks like the start of a number) matching a common
 *               phone-number pattern.
 *   - password: a single OCR word that's entirely mask characters
 *               (•, ●, ∙, or *) — a masked password field rendered as dots
 *               or asterisks.
 * NER-based name detection ('text-pii') is explicitly out of scope for now.
 *
 * KNOWN LIMITATIONS (validated 2026-09-10 against real renders — see
 * scripts/check-detection.mjs and scripts/make-pii-test-image.mjs):
 *   - Regex-only phone matching will false-positive on other 10-digit
 *     numbers (order IDs, dates written as digits, etc.) and false-negative
 *     on formats it doesn't recognize (non-US layouts, extensions).
 *   - Email matching only looks at a single OCR word — if OCR splits an
 *     address across multiple words (rare, but can happen around '@' or '.'
 *     with unusual kerning), it won't be reassembled.
 *   - OBSERVED: even large, high-contrast rendered text isn't transcribed
 *     digit-perfect — a 60px "(555) 123-4567" came back from OCR as
 *     "(553) 123-4567" (5->3). The phone regex still matched (format is
 *     right), so the detection and its bbox are still correct, but the
 *     extracted digits themselves were wrong. Don't treat matchedText as
 *     ground truth, and don't feed it anywhere the actual digits matter.
 *   - OBSERVED, password/masked-field detection is NOT reliable, in two
 *     different failure modes for the two mask glyphs tested:
 *       - A bullet-masked field ("••••••••") was transcribed by Tesseract
 *         as the literal characters "sssssssss" — nothing in MASK_REGEX,
 *         so it was missed entirely.
 *       - An asterisk-masked field ("********") wasn't transcribed at all —
 *         Tesseract's layout analysis didn't even segment it as a text
 *         line, so it never reached the classifier as a "word" to test.
 *     This matches the CLAUDE.md instruction to flag masked-field detection
 *     as an unreliable known limitation rather than working around it by,
 *     e.g., loosening MASK_REGEX to match "sssssssss" — that would just be
 *     overfitting to one observed OCR quirk of one font/mask glyph, not a
 *     real fix. The matcher is left in place for cases where OCR does
 *     preserve the mask glyph faithfully, but don't rely on it firing.
 *   - Small/low-contrast text (16px, #bbbbbb-on-white) was not detected at
 *     all — none of it appeared even as garbled OCR output. This is the
 *     general "OCR is weak on small/low-contrast text" limitation showing
 *     up concretely, not just a theoretical caveat.
 *   - OCR runs over the whole image, including non-text regions (a photo's
 *     texture/folds/patterns) — these generate a lot of low-confidence
 *     garbage "lines" that happened not to match the PII regexes in
 *     testing, but are wasted work and a latent false-positive risk.
 */

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_REGEX = /^(?:\+?\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
const MASK_REGEX = /^[•●∙*]{4,}$/;
const PHONE_START_REGEX = /^[+(]?\d/;
const TRAILING_PUNCTUATION_REGEX = /[,.;:]+$/;

const PHONE_MAX_WINDOW = 4;

function stripTrailingPunctuation(text) {
  return text.replace(TRAILING_PUNCTUATION_REGEX, '');
}

function unionBbox(words) {
  const x0 = Math.min(...words.map((w) => w.bbox.x0));
  const y0 = Math.min(...words.map((w) => w.bbox.y0));
  const x1 = Math.max(...words.map((w) => w.bbox.x1));
  const y1 = Math.max(...words.map((w) => w.bbox.y1));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Tesseract word confidence is 0..100 (and can be -1 for junk); normalize
// to the 0..1 range the Detection contract expects.
function averageConfidence(words) {
  const avg = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
  return Math.min(1, Math.max(0, avg / 100));
}

function matchEmail(words, i) {
  const cleaned = stripTrailingPunctuation(words[i].text);
  if (!EMAIL_REGEX.test(cleaned)) return null;
  return {
    type: 'email',
    bbox: unionBbox([words[i]]),
    confidence: averageConfidence([words[i]]),
    matchedText: cleaned,
    consumed: 1,
  };
}

function matchPhone(words, i) {
  if (!PHONE_START_REGEX.test(words[i].text)) return null;
  for (let len = 1; len <= PHONE_MAX_WINDOW && i + len <= words.length; len++) {
    const windowWords = words.slice(i, i + len);
    const joined = stripTrailingPunctuation(windowWords.map((w) => w.text).join(' '));
    if (PHONE_REGEX.test(joined)) {
      return {
        type: 'phone',
        bbox: unionBbox(windowWords),
        confidence: averageConfidence(windowWords),
        matchedText: joined,
        consumed: len,
      };
    }
  }
  return null;
}

function matchPassword(words, i) {
  if (!MASK_REGEX.test(words[i].text)) return null;
  return {
    type: 'password',
    bbox: unionBbox([words[i]]),
    confidence: averageConfidence([words[i]]),
    matchedText: words[i].text,
    consumed: 1,
  };
}

/**
 * Classify OCR lines (see ocr.js's flattenBlocks) into PII matches.
 * Consumed words are skipped past rather than re-scanned, so a single line
 * can't produce overlapping matches.
 * @param {ReturnType<import('./ocr.js').flattenBlocks>} lines
 * @returns {{type:'email'|'phone'|'password', bbox:{x:number,y:number,w:number,h:number},
 *   confidence:number, matchedText:string}[]}
 */
export function classifyPii(lines) {
  const matches = [];
  for (const line of lines) {
    const words = line.words;
    let i = 0;
    while (i < words.length) {
      const match = matchEmail(words, i) || matchPhone(words, i) || matchPassword(words, i);
      if (match) {
        matches.push(match);
        i += match.consumed;
      } else {
        i += 1;
      }
    }
  }
  return matches;
}
