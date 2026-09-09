// OWNED BY: Person 2 (Vivaan)
// This shows the intended wiring. Build/test against the mock module first;
// swap the import below for the real detection module once Person 1's
// implementation is merged to main.

// import { detectSensitiveRegions } from '../detection/index.js'; // <-- swap in at integration time
import { getMockDetections } from '../mock/mockDetections.js';
import { renderRedactedImage } from '../redaction/index.js';
import { loadImageFromFile } from '../shared/imageUtils.js';

const imageInput = document.getElementById('imageInput');
const outputCanvas = document.getElementById('outputCanvas');

imageInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const image = await loadImageFromFile(file);

  // TODO(integration): replace getMockDetections() with
  // await detectSensitiveRegions(image)
  const detections = await getMockDetections();

  const redactedCanvas = renderRedactedImage(image, detections);
  // TODO(Person 2): draw redactedCanvas onto outputCanvas, or replace it in the DOM.
});
