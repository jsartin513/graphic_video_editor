#!/usr/bin/env node
// Verify that FAT builds include ffmpeg binaries (macOS .app and Windows unpacked dirs)
const fs = require('fs');
const path = require('path');
const { bundledBinaryFileName } = require('../src/ffmpeg-binary-utils');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const MIN_BINARY_SIZE_BYTES = 10 * 1024 * 1024;

function findAppBundles() {
  const appBundles = [];

  function searchDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.endsWith('.app')) {
            appBundles.push({ type: 'darwin', path: fullPath });
          } else if (entry.name === 'win-unpacked') {
            appBundles.push({ type: 'win32', path: fullPath });
          } else {
            searchDir(fullPath);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (fs.existsSync(DIST_DIR)) {
    searchDir(DIST_DIR);
  }

  return appBundles;
}

function checkBundle(bundle) {
  const platform = bundle.type;
  const ffmpegName = bundledBinaryFileName('ffmpeg', platform);
  const ffprobeName = bundledBinaryFileName('ffprobe', platform);

  let binariesPath;
  if (platform === 'darwin') {
    binariesPath = path.join(bundle.path, 'Contents', 'Resources', 'resources');
  } else {
    binariesPath = path.join(bundle.path, 'resources', 'resources');
  }

  const ffmpegPath = path.join(binariesPath, ffmpegName);
  const ffprobePath = path.join(binariesPath, ffprobeName);

  const result = {
    bundlePath: bundle.path,
    bundleName: path.basename(bundle.path),
    platform,
    binariesDirExists: fs.existsSync(binariesPath),
    ffmpegExists: fs.existsSync(ffmpegPath),
    ffprobeExists: fs.existsSync(ffprobePath),
    ffmpegSize: null,
    ffprobeSize: null,
    errors: []
  };

  for (const [label, filePath] of [['ffmpeg', ffmpegPath], ['ffprobe', ffprobePath]]) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    try {
      const stats = fs.statSync(filePath);
      if (label === 'ffmpeg') {
        result.ffmpegSize = stats.size;
      } else {
        result.ffprobeSize = stats.size;
      }
      if (stats.size < MIN_BINARY_SIZE_BYTES) {
        result.errors.push(`${label} seems too small (${stats.size} bytes)`);
      }
      if (platform !== 'win32') {
        try {
          fs.accessSync(filePath, fs.constants.X_OK);
        } catch (e) {
          result.errors.push(`${label} is not executable`);
        }
      }
    } catch (e) {
      result.errors.push(`Error checking ${label}: ${e.message}`);
    }
  }

  return result;
}

function formatSize(bytes) {
  if (!bytes) return 'N/A';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function main() {
  console.log('🔍 Checking FAT builds for bundled ffmpeg binaries...\n');

  const bundles = findAppBundles();
  if (bundles.length === 0) {
    console.log('❌ No app bundles found in dist/ (looked for .app and win-unpacked)');
    process.exit(1);
  }

  let allGood = true;

  for (const bundle of bundles) {
    const result = checkBundle(bundle);
    console.log(`📦 ${result.bundleName} (${result.platform})`);
    console.log(`   Path: ${result.bundlePath}`);

    if (result.ffmpegExists && result.ffprobeExists) {
      console.log(`   ✅ ffmpeg: ${formatSize(result.ffmpegSize)}`);
      console.log(`   ✅ ffprobe: ${formatSize(result.ffprobeSize)}`);
    } else {
      console.log('   ❌ Missing binaries');
      if (!result.ffmpegExists) console.log('      - ffmpeg not found');
      if (!result.ffprobeExists) console.log('      - ffprobe not found');
      allGood = false;
    }

    if (result.errors.length > 0) {
      result.errors.forEach((err) => console.log(`   ⚠️  ${err}`));
      allGood = false;
    }
    console.log('');
  }

  process.exit(allGood ? 0 : 1);
}

main();
