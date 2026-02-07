const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const destDir = path.join(__dirname, '..', 'public', 'ffmpeg');

const files = [
  'ffmpeg-core.js',
  'ffmpeg-core.wasm',
];

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const copyFile = (fileName) => {
  const source = path.join(sourceDir, fileName);
  const dest = path.join(destDir, fileName);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing ${fileName} in ${sourceDir}. Did you install @ffmpeg/core?`);
  }
  fs.copyFileSync(source, dest);
};

try {
  ensureDir(destDir);
  files.forEach(copyFile);
  console.log('[ffmpeg] core files copied to public/ffmpeg');
} catch (error) {
  console.error('[ffmpeg] failed to copy core files:', error.message);
  process.exit(1);
}
