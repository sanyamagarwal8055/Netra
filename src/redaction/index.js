// OWNED BY: Person 2 (Vivaan)
// Do not edit from the detection side without flagging Person 2 first.

/**
 * @typedef {import('../shared/types.js').Detection} Detection
 */

/**
 * Given the original image and a list of Detections, draw the redacted
 * (Set-of-Mark) output: blur/mask sensitive regions and label them.
 *
 * @param {ImageBitmap|HTMLImageElement} image
 * @param {Detection[]} detections
 * @returns {HTMLCanvasElement} canvas containing the redacted image
 */
export function renderRedactedImage(image, detections) {
  const width = image.naturalWidth || image.width || 0;
  const height = image.naturalHeight || image.height || 0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('renderRedactedImage: failed to obtain 2d canvas context');
  }

  // Step 1: Draw base image at natural resolution
  ctx.drawImage(image, 0, 0, width, height);

  // If no detections or empty array, return base image canvas intact
  if (!detections || !Array.isArray(detections) || detections.length === 0) {
    return canvas;
  }

  // Color mapping per detection type for Set-of-Mark borders & labels
  const TYPE_THEMES = {
    face: { border: '#3b82f6', bg: '#1d4ed8', text: '#ffffff' },
    password: { border: '#ef4444', bg: '#b91c1c', text: '#ffffff' },
    email: { border: '#f59e0b', bg: '#b45309', text: '#ffffff' },
    phone: { border: '#10b981', bg: '#047857', text: '#ffffff' },
    'text-pii': { border: '#8b5cf6', bg: '#6d28d9', text: '#ffffff' },
  };

  const defaultTheme = { border: '#6b7280', bg: '#374151', text: '#ffffff' };

  // Step 2: Apply redaction per detection
  for (const det of detections) {
    if (!det.bbox) continue;

    // Clamp coordinates within image bounds
    const bx = Math.max(0, Math.min(width, det.bbox.x));
    const by = Math.max(0, Math.min(height, det.bbox.y));
    const bw = Math.max(0, Math.min(width - bx, det.bbox.w));
    const bh = Math.max(0, Math.min(height - by, det.bbox.h));

    if (bw <= 0 || bh <= 0) continue;

    if (det.type === 'face') {
      // Pixelation for faces: downscale then upscale with smoothing disabled
      const pixelSize = Math.max(4, Math.floor(Math.min(bw, bh) / 8));
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.max(1, Math.floor(bw / pixelSize));
      offscreen.height = Math.max(1, Math.floor(bh / pixelSize));
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, offscreen.width, offscreen.height);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offscreen, 0, 0, offscreen.width, offscreen.height, bx, by, bw, bh);
        ctx.restore();
      }
    } else if (det.type === 'password') {
      // Solid blackout for passwords
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(bx, by, bw, bh);
    } else {
      // Solid masking bar for email, phone, text-pii
      ctx.fillStyle = '#111827';
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  // Step 3: Draw Set-of-Mark overlays (borders + label badges) on top
  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    if (!det.bbox) continue;

    const bx = Math.max(0, Math.min(width, det.bbox.x));
    const by = Math.max(0, Math.min(height, det.bbox.y));
    const bw = Math.max(0, Math.min(width - bx, det.bbox.w));
    const bh = Math.max(0, Math.min(height - by, det.bbox.h));

    if (bw <= 0 || bh <= 0) continue;

    const theme = TYPE_THEMES[det.type] || defaultTheme;

    // Draw bounding box border
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(bx, by, bw, bh);

    // Prepare label badge
    const labelText = det.label || `${det.type.toUpperCase()}-${i + 1}`;
    const fontSize = Math.max(11, Math.min(14, Math.floor(bh * 0.4)));
    ctx.font = `bold ${fontSize}px sans-serif`;

    const paddingX = 6;
    const paddingY = 3;
    const textMetrics = ctx.measureText(labelText);
    const badgeW = textMetrics.width + paddingX * 2;
    const badgeH = fontSize + paddingY * 2;

    // Position badge above bbox, or inside if too close to the canvas top
    let badgeX = bx;
    let badgeY = by - badgeH - 2;
    if (badgeY < 0) {
      badgeY = by + 2;
    }
    if (badgeX + badgeW > width) {
      badgeX = Math.max(0, width - badgeW);
    }

    // Badge background pill
    ctx.fillStyle = theme.bg;
    ctx.beginPath();
    const r = 3; // border radius
    ctx.moveTo(badgeX + r, badgeY);
    ctx.lineTo(badgeX + badgeW - r, badgeY);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
    ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH);
    ctx.lineTo(badgeX + r, badgeY + badgeH);
    ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
    ctx.lineTo(badgeX, badgeY + r);
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
    ctx.closePath();
    ctx.fill();

    // Badge text
    ctx.fillStyle = theme.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, badgeX + paddingX, badgeY + badgeH / 2);
    ctx.restore();
  }

  // Step 4: Return rendered canvas
  return canvas;
}

