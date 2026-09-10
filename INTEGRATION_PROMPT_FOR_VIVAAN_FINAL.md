Person 1 has merged their detection module into main. Do the following, in 
order, and report back honestly at each step — don't report success unless 
you've actually confirmed it, not just run the command without an error.

1. Confirm we're on person2-redaction-ui, then run `git pull origin main`. 
   Show me what files changed as a result.

2. Run `npm install`. Confirm `onnxruntime-web` and `tesseract.js` are now 
   present in node_modules (they were added to the shared package.json by 
   Person 1).

3. Run `npm run build:wasm` and then `npm run build:tesseract`. After each, 
   actually check the filesystem (not just the command's exit code) to 
   confirm real files were created in models/ort-wasm/ and models/tesseract/ 
   — list what's in each folder.

4. In src/ui/popup.js, replace the mock detection call with the real one:
   - Change the import to bring in detectSensitiveRegions from 
     '../detection/index.js' instead of (or alongside) getMockDetections
   - Replace `const detections = await getMockDetections();` with 
     `const detections = await detectSensitiveRegions(image);`
   - Do NOT change anything else in this file — this should be a minimal, 
     surgical swap, not a rewrite

5. Run the existing unit test suite (npm test) to confirm nothing broke 
   from the merge.

6. Stop here and tell me the extension is ready to load and test manually 
   in Chrome — do not attempt to simulate or fake an end-to-end browser 
   test yourself. Person 1 and I will run the real test together.

Be explicit about any errors, warnings, or anything that seems off at each 
step — don't smooth over problems to present a clean summary.
