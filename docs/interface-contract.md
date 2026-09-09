# Interface Contract

This is the agreed handoff point between the detection module (Person 1) and
the redaction/UI module (Person 2). See `src/shared/types.js` for the
authoritative JSDoc definition — this file is a human-readable summary.

## Detection object

```js
{
  id: 'det-1',
  type: 'face' | 'email' | 'phone' | 'password' | 'text-pii',
  bbox: { x: 120, y: 60, w: 140, h: 160 }, // pixels, top-left origin
  label: 'FACE-1',    // shown in the Set-of-Mark overlay
  confidence: 0.97,   // 0 to 1
}
```

## Function signatures

- `detectSensitiveRegions(image): Promise<Detection[]>` — Person 1, `src/detection/index.js`
- `renderRedactedImage(image, detections): HTMLCanvasElement` — Person 2, `src/redaction/index.js`

## Change process

If either signature or the Detection shape needs to change, message the other
person before editing — do not change silently, since both modules depend on
this exact shape matching.
