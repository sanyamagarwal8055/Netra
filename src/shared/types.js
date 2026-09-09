/**
 * SHARED FILE — this is the contract between the detection module (Person 1)
 * and the redaction/UI module (Person 2).
 *
 * Do not change this shape without messaging the other person first.
 * Both modules are written against exactly this shape.
 */

/**
 * @typedef {Object} BoundingBox
 * @property {number} x      // top-left x, in source image pixels
 * @property {number} y      // top-left y, in source image pixels
 * @property {number} w      // width in pixels
 * @property {number} h      // height in pixels
 */

/**
 * @typedef {'face'|'email'|'phone'|'password'|'text-pii'} DetectionType
 */

/**
 * @typedef {Object} Detection
 * @property {string} id                 // unique per detection, e.g. "det-1"
 * @property {DetectionType} type
 * @property {BoundingBox} bbox
 * @property {string} label               // short text shown in the Set-of-Mark overlay, e.g. "PII-1"
 * @property {number} confidence           // 0 to 1
 */

// Nothing is exported at runtime — this file exists for the JSDoc typedefs above,
// so editors/agents on both sides get the same shape via IntelliSense/JSDoc.
export {};
