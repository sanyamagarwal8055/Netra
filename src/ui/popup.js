// OWNED BY: Person 2 (Vivaan)
// This shows the intended wiring. Build/test against the mock module first;
// swap the import below for the real detection module once Person 1's
// implementation is merged to main.

// import { detectSensitiveRegions } from '../detection/index.js'; // <-- swap in at integration time
import { getMockDetections } from '../mock/mockDetections.js';
import { renderRedactedImage } from '../redaction/index.js';
import { loadImageFromFile, canvasToDataUrl } from '../shared/imageUtils.js';

// DOM Elements
const imageInput = document.getElementById('imageInput');
const dropzone = document.getElementById('dropzone');
const uploadSection = document.getElementById('uploadSection');
const loadingBar = document.getElementById('loadingBar');
const resultsSection = document.getElementById('resultsSection');

const outputCanvas = document.getElementById('outputCanvas');
const originalPreview = document.getElementById('originalPreview');
const tabRedacted = document.getElementById('tabRedacted');
const tabOriginal = document.getElementById('tabOriginal');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');

const detectionCount = document.getElementById('detectionCount');
const detectionsList = document.getElementById('detectionsList');

let originalObjectUrl = null;

// Drag and drop interaction
['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');
  });
});

dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt?.files;
  if (files && files.length > 0) {
    processFile(files[0]);
  }
});

imageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    processFile(file);
  }
});

async function processFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPG, WebP).');
    return;
  }

  // Show loading state
  uploadSection.hidden = true;
  loadingBar.hidden = false;
  resultsSection.hidden = true;

  try {
    // 1. Load image
    const image = await loadImageFromFile(file);

    // Save original image URL for comparison view
    if (originalObjectUrl) {
      URL.revokeObjectURL(originalObjectUrl);
    }
    originalObjectUrl = URL.createObjectURL(file);
    originalPreview.src = originalObjectUrl;

    // 2. Obtain detections
    // TODO(integration): replace getMockDetections() with
    // await detectSensitiveRegions(image)
    const detections = await getMockDetections();

    // 3. Render redacted image with Set-of-Mark
    const redactedCanvas = renderRedactedImage(image, detections);

    // 4. Update output canvas
    outputCanvas.width = redactedCanvas.width;
    outputCanvas.height = redactedCanvas.height;
    const ctx = outputCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(redactedCanvas, 0, 0);
    }

    // 5. Populate detection breakdown panel
    renderDetectionSummary(detections);

    // Reset view tab to Redacted
    showRedactedTab();

    // Show results
    loadingBar.hidden = true;
    resultsSection.hidden = false;
  } catch (err) {
    console.error('Error processing image in NETRA:', err);
    alert('Error redacting image: ' + err.message);
    resetView();
  }
}

function renderDetectionSummary(detections) {
  detectionsList.innerHTML = '';
  const count = detections?.length || 0;
  detectionCount.textContent = `${count} found`;

  if (count === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'confidence-text';
    emptyMsg.textContent = 'No sensitive regions detected.';
    detectionsList.appendChild(emptyMsg);
    return;
  }

  detections.forEach((det, idx) => {
    const row = document.createElement('div');
    row.className = 'detection-row';

    const tag = document.createElement('div');
    tag.className = 'detection-tag';

    const chip = document.createElement('span');
    chip.className = `chip chip-${det.type || 'text-pii'}`;
    chip.textContent = det.type || 'PII';

    const label = document.createElement('strong');
    label.textContent = det.label || `MARK-${idx + 1}`;

    tag.appendChild(chip);
    tag.appendChild(label);

    const confidence = document.createElement('span');
    confidence.className = 'confidence-text';
    const confPercent = Math.round((det.confidence || 1) * 100);
    confidence.textContent = `${confPercent}% conf`;

    row.appendChild(tag);
    row.appendChild(confidence);
    detectionsList.appendChild(row);
  });
}

function showRedactedTab() {
  tabRedacted.classList.add('active');
  tabOriginal.classList.remove('active');
  outputCanvas.hidden = false;
  originalPreview.hidden = true;
}

function showOriginalTab() {
  tabOriginal.classList.add('active');
  tabRedacted.classList.remove('active');
  outputCanvas.hidden = true;
  originalPreview.hidden = false;
}

tabRedacted.addEventListener('click', showRedactedTab);
tabOriginal.addEventListener('click', showOriginalTab);

function resetView() {
  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
    originalObjectUrl = null;
  }
  imageInput.value = '';
  uploadSection.hidden = false;
  loadingBar.hidden = true;
  resultsSection.hidden = true;
  showRedactedTab();
}

resetBtn.addEventListener('click', resetView);

downloadBtn.addEventListener('click', () => {
  try {
    const dataUrl = canvasToDataUrl(outputCanvas);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `netra-redacted-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Failed to download image:', err);
  }
});

