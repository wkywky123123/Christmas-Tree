import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const modelsDir = path.join(publicDir, 'models');
const wasmDir = path.join(modelsDir, 'wasm');

const files = [
  {
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    dest: path.join(modelsDir, 'hand_landmarker.task')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.wasm',
    dest: path.join(wasmDir, 'vision_wasm_internal.wasm')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.js',
    dest: path.join(wasmDir, 'vision_wasm_internal.js')
  }
];

// Ensure directories exist
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
}

async function download(url, dest) {
  if (fs.existsSync(dest)) {
    console.log(`[Cache] File already exists: ${dest}`);
    return;
  }
  
  console.log(`[Download] ${url} -> ${dest}`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
         // Simple redirect handling if needed, though direct links usually work
         download(response.headers.location, dest).then(resolve).catch(reject);
         return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function main() {
  console.log('--- Starting Model Download ---');
  try {
    await Promise.all(files.map(f => download(f.url, f.dest)));
    console.log('--- All models downloaded successfully ---');
  } catch (err) {
    console.error('Error downloading models:', err);
    // Important: Don't break the build locally if developer has network issues, 
    // but on Vercel this usually succeeds.
    if (process.env.CI) {
      process.exit(1); 
    }
  }
}

main();
