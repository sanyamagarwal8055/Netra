import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderRedactedImage } from '../../src/redaction/index.js';
import { mockDetections } from '../../src/mock/mockDetections.js';

// Setup DOM / Canvas mock for Node test environment
function setupCanvasMock() {
  const contextCalls = {
    drawImage: [],
    fillRect: [],
    strokeRect: [],
    fillText: [],
    beginPath: 0,
    fill: 0,
  };

  const mockContext = {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn((...args) => contextCalls.drawImage.push(args)),
    fillRect: vi.fn((...args) => contextCalls.fillRect.push(args)),
    strokeRect: vi.fn((...args) => contextCalls.strokeRect.push(args)),
    fillText: vi.fn((...args) => contextCalls.fillText.push(args)),
    measureText: vi.fn((text) => ({ width: text.length * 8 })),
    beginPath: vi.fn(() => contextCalls.beginPath++),
    closePath: vi.fn(),
    fill: vi.fn(() => contextCalls.fill++),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    lineWidth: 1,
    strokeStyle: '#000000',
    fillStyle: '#000000',
    font: '',
    imageSmoothingEnabled: true,
  };

  // Mock global document.createElement('canvas')
  globalThis.document = {
    createElement: vi.fn((tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
        };
      }
      return {};
    }),
  };

  return { mockContext, contextCalls };
}

describe('Redaction Engine (src/redaction/index.js)', () => {
  let mockContext;
  let contextCalls;

  beforeEach(() => {
    const mock = setupCanvasMock();
    mockContext = mock.mockContext;
    contextCalls = mock.contextCalls;
  });

  const fakeImage = {
    width: 640,
    height: 480,
    naturalWidth: 640,
    naturalHeight: 480,
  };

  it('renders base image at original dimensions', () => {
    const canvas = renderRedactedImage(fakeImage, []);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(mockContext.drawImage).toHaveBeenCalledWith(fakeImage, 0, 0, 640, 480);
  });

  it('handles empty detections without error or redaction overlays', () => {
    const canvas = renderRedactedImage(fakeImage, []);
    expect(canvas).toBeDefined();
    expect(contextCalls.fillRect.length).toBe(0);
    expect(contextCalls.strokeRect.length).toBe(0);
  });

  it('handles null or undefined detections gracefully', () => {
    expect(() => renderRedactedImage(fakeImage, null)).not.toThrow();
    expect(() => renderRedactedImage(fakeImage, undefined)).not.toThrow();
  });

  it('redacts password with solid blackout', () => {
    const detections = [
      {
        id: 'pwd-1',
        type: 'password',
        bbox: { x: 50, y: 100, w: 120, h: 25 },
        label: 'PASS-1',
        confidence: 0.95,
      },
    ];

    renderRedactedImage(fakeImage, detections);

    // Password should trigger fillRect with solid dark color
    expect(mockContext.fillRect).toHaveBeenCalledWith(50, 100, 120, 25);
    // Should draw Set-of-Mark stroke border
    expect(mockContext.strokeRect).toHaveBeenCalledWith(50, 100, 120, 25);
    // Should draw Set-of-Mark label
    expect(mockContext.fillText).toHaveBeenCalledWith(
      expect.stringContaining('PASS-1'),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('redacts face with pixelation and Set-of-Mark label', () => {
    const detections = [
      {
        id: 'face-1',
        type: 'face',
        bbox: { x: 100, y: 50, w: 150, h: 180 },
        label: 'FACE-1',
        confidence: 0.99,
      },
    ];

    renderRedactedImage(fakeImage, detections);

    // Should create offscreen canvas for pixelation and draw it back
    expect(mockContext.drawImage).toHaveBeenCalled();
    expect(mockContext.strokeRect).toHaveBeenCalledWith(100, 50, 150, 180);
    expect(mockContext.fillText).toHaveBeenCalledWith(
      'FACE-1',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('redacts PII text (email, phone, text-pii) with solid masking bars', () => {
    const detections = [
      {
        id: 'email-1',
        type: 'email',
        bbox: { x: 20, y: 200, w: 160, h: 20 },
        label: 'PII-1',
        confidence: 0.89,
      },
      {
        id: 'phone-1',
        type: 'phone',
        bbox: { x: 20, y: 240, w: 140, h: 20 },
        label: 'PII-2',
        confidence: 0.91,
      },
    ];

    renderRedactedImage(fakeImage, detections);

    expect(mockContext.fillRect).toHaveBeenCalledWith(20, 200, 160, 20);
    expect(mockContext.fillRect).toHaveBeenCalledWith(20, 240, 140, 20);
    expect(mockContext.strokeRect).toHaveBeenCalledWith(20, 200, 160, 20);
    expect(mockContext.strokeRect).toHaveBeenCalledWith(20, 240, 140, 20);
  });

  it('clamps bounding boxes that exceed image dimensions', () => {
    const detections = [
      {
        id: 'overflow-1',
        type: 'email',
        bbox: { x: 600, y: 450, w: 200, h: 100 }, // Extends beyond 640x480
        label: 'OVERFLOW',
        confidence: 0.85,
      },
    ];

    expect(() => renderRedactedImage(fakeImage, detections)).not.toThrow();
    // Clamped width should be 640 - 600 = 40, height: 480 - 450 = 30
    expect(mockContext.fillRect).toHaveBeenCalledWith(600, 450, 40, 30);
  });

  it('successfully processes the provided mock detections from mockDetections.js', () => {
    expect(() => renderRedactedImage(fakeImage, mockDetections)).not.toThrow();
    expect(mockContext.strokeRect).toHaveBeenCalledTimes(mockDetections.length);
  });
});
