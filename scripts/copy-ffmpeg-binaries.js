// Script to copy ffmpeg binaries for electron-builder
const fs = require('fs');
const path = require('path');

// Check if bundling is enabled (default: true for backward compatibility)
const BUNDLE_FFMPEG = process.env.BUNDLE_FFMPEG !== 'false';

const resourcesDir = path.join(__dirname, '..', 'resources');

if (!BUNDLE_FFMPEG) {
  console.log('BUNDLE_FFMPEG=false - Skipping ffmpeg bundling');
  console.log('App will use system-installed ffmpeg if available');
  
  // Clean up resources directory if it exists
  if (fs.existsSync(resourcesDir)) {
    try {
      fs.rmSync(resourcesDir, { recursive: true, force: true });
      console.log('✓ Removed existing resources directory');
    } catch (e) {
      console.warn('Could not remove resources directory:', e.message);
    }
  }
  process.exit(0);
}

console.log('BUNDLE_FFMPEG=true - Bundling ffmpeg binaries');

// Create resources directory
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

let success = true;

// Copy ffmpeg
try {
  const ffmpegPath = require('ffmpeg-static');
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static returned null path');
  }
  const ffmpegDest = path.join(resourcesDir, 'ffmpeg');
  fs.copyFileSync(ffmpegPath, ffmpegDest);
  fs.chmodSync(ffmpegDest, 0o755);
  console.log(`✓ Copied ffmpeg to ${ffmpegDest}`);
} catch (e) {
  console.error('✗ Error copying ffmpeg:', e.message);
  success = false;
}

// Copy ffprobe
try {
  const ffprobeStatic = require('ffprobe-static');
  const ffprobePath = ffprobeStatic.path || ffprobeStatic;
  if (!ffprobePath) {
    throw new Error('ffprobe-static returned null path');
  }
  const ffprobeDest = path.join(resourcesDir, 'ffprobe');
  fs.copyFileSync(ffprobePath, ffprobeDest);
  fs.chmodSync(ffprobeDest, 0o755);
  console.log(`✓ Copied ffprobe to ${ffprobeDest}`);
} catch (e) {
  console.error('✗ Error copying ffprobe:', e.message);
  success = false;
}

if (!success) {
  console.error('\n⚠ Some binaries could not be copied. Make sure ffmpeg-static and ffprobe-static are installed:');
  console.error('   npm install');
  process.exit(1);
}

console.log('\n✓ All binaries copied successfully');

