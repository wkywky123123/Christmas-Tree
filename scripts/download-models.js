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

// Ensure directories exist
if (!fs.existsSync(wasmDir)) fs.mkdirSync(wasmDir, { recursive: true });
if (!fs.existsSync(path.join(publicDir, 'img'))) fs.mkdirSync(path.join(publicDir, 'img'), { recursive: true });

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
  },
  {
    url: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/hdri/potsdamer_platz_1k.hdr',
    dest: path.join(modelsDir, 'potsdamer_platz_1k.hdr')
  }
];

async function download(url, dest) {
  if (fs.existsSync(dest)) {
    console.log(`[Cache] Found: ${path.basename(dest)}`);
    return;
  }
  console.log(`[Download] ${url}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
         download(response.headers.location, dest).then(resolve).catch(reject);
         return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function main() {
  console.log('--- LOCALIZING ASSETS ---');
  try {
    await Promise.all(files.map(f => download(f.url, f.dest)));
    console.log('--- ALL ASSETS LOCALIZED ---');
  } catch (err) {
    console.error('Error:', err);
    if (process.env.CI) process.exit(1);
  }
}
main();