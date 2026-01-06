// Script to copy ffmpeg binaries for electron-builder
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

// Check if bundling is enabled (default: true for backward compatibility)
const BUNDLE_FFMPEG = process.env.BUNDLE_FFMPEG !== 'false';

// Determine target architecture from npm lifecycle event or environment variable
// npm_lifecycle_event will be 'prebuild:x64', 'prebuild:arm64', or 'prebuild'
const lifecycleEvent = process.env.npm_lifecycle_event || '';
const targetArch = process.env.TARGET_ARCH || 
  (lifecycleEvent.includes(':x64') ? 'x64' : 
   lifecycleEvent.includes(':arm64') ? 'arm64' : 
   process.arch);

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

console.log(`BUNDLE_FFMPEG=true - Bundling ffmpeg binaries for ${targetArch}`);
console.log(`Host platform: ${process.platform} ${process.arch}, Target: ${targetArch}`);

// Create resources directory
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// Helper function to download and decompress gzipped file from URL
function downloadFile(url, destPath, isGzipped = null) {
  // Track if original URL was gzipped (redirects might lose .gz extension)
  if (isGzipped === null) {
    isGzipped = url.endsWith('.gz');
  }
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect, preserve gzip flag
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect response missing location header'));
          return;
        }
        return downloadFile(redirectUrl, destPath, isGzipped).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      // Use tracked gzip flag (original URL had .gz)
      // The file content itself is gzipped, we need to decompress it
      if (isGzipped) {
        // Collect all data first, then decompress synchronously
        // (This is more reliable than streaming decompression for gzipped files)
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const gzippedData = Buffer.concat(chunks);
            const decompressed = zlib.gunzipSync(gzippedData);
            fs.writeFileSync(destPath, decompressed);
            fs.chmodSync(destPath, 0o755);
            resolve();
          } catch (err) {
            try { fs.unlinkSync(destPath); } catch (e) {}
            reject(new Error(`Failed to decompress: ${err.message}`));
          }
        });
        response.on('error', (err) => {
          try { fs.unlinkSync(destPath); } catch (e) {}
          reject(err);
        });
      } else {
        // Direct download (not gzipped)
        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          fs.chmodSync(destPath, 0o755);
          resolve();
        });
        file.on('error', (err) => {
          try { fs.unlinkSync(destPath); } catch (e) {}
          reject(err);
        });
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Get the appropriate binary URL based on target architecture
function getBinaryUrl(binaryName, arch) {
  // Get release tag from package.json (e.g., "b6.1.1")
  let releaseTag;
  try {
    if (binaryName === 'ffmpeg') {
      const pkg = require('ffmpeg-static/package.json');
      releaseTag = pkg['ffmpeg-static']['binary-release-tag'];
    } else if (binaryName === 'ffprobe') {
      // Try to get from ffprobe-static package
      try {
        const pkg = require('ffprobe-static/package.json');
        releaseTag = pkg['ffprobe-static']?.['binary-release-tag'] || 'b6.1.1';
      } catch (e) {
        // Fallback to ffmpeg-static release tag
        const pkg = require('ffmpeg-static/package.json');
        releaseTag = pkg['ffmpeg-static']['binary-release-tag'];
      }
    }
  } catch (e) {
    // Fallback to known working release
    releaseTag = 'b6.1.1';
  }
  
  if (binaryName === 'ffmpeg') {
    // URL format: https://github.com/eugeneware/ffmpeg-static/releases/download/{release}/ffmpeg-{platform}-{arch}.gz
    return `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffmpeg-darwin-${arch}.gz`;
  } else if (binaryName === 'ffprobe') {
    // Use ffmpeg-static releases for ffprobe as well (ffprobe-static has incorrect arm64 binary in v3.1.0)
    return `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffprobe-darwin-${arch}.gz`;
  }
  return null;
}

let success = true;

// Check if we're cross-compiling or on a non-macOS platform
// Cross-compiling: building for different arch than host on macOS
// Non-macOS: building macOS binaries on Linux (e.g., in CI)
const isCrossCompiling = (process.platform === 'darwin' && targetArch !== process.arch) || process.platform !== 'darwin';

async function copyBinaries() {
  // Copy or download ffmpeg
  try {
    const ffmpegDest = path.join(resourcesDir, 'ffmpeg');
    
    if (isCrossCompiling) {
      const reason = process.platform !== 'darwin' 
        ? `non-macOS platform (${process.platform})`
        : `cross-architecture build (host: ${process.arch}, target: ${targetArch})`;
      console.log(`Downloading ${targetArch} ffmpeg binary (${reason})`);
      const ffmpegUrl = getBinaryUrl('ffmpeg', targetArch);
      if (!ffmpegUrl) {
        throw new Error(`No ffmpeg binary URL for architecture: ${targetArch}`);
      }
      await downloadFile(ffmpegUrl, ffmpegDest);
      console.log(`✓ Downloaded ffmpeg for ${targetArch} to ${ffmpegDest}`);
    } else {
      // Use the locally installed binary
      const ffmpegPath = require('ffmpeg-static');
      if (!ffmpegPath) {
        throw new Error('ffmpeg-static returned null path');
      }
      fs.copyFileSync(ffmpegPath, ffmpegDest);
      fs.chmodSync(ffmpegDest, 0o755);
      console.log(`✓ Copied ffmpeg to ${ffmpegDest}`);
    }
  } catch (e) {
    console.error('✗ Error getting ffmpeg:', e.message);
    success = false;
  }

  // Copy or download ffprobe
  try {
    const ffprobeDest = path.join(resourcesDir, 'ffprobe');
    
    if (isCrossCompiling) {
      // When cross-compiling, download the correct binary for target architecture
      // Note: ffprobe-static v3.1.0 has incorrect arm64 binary, so we download from ffmpeg-static releases
      const reason = process.platform !== 'darwin' 
        ? `non-macOS platform (${process.platform})`
        : `cross-architecture build (host: ${process.arch}, target: ${targetArch})`;
      console.log(`Downloading ${targetArch} ffprobe binary (${reason})`);
      const ffprobeUrl = getBinaryUrl('ffprobe', targetArch);
      if (!ffprobeUrl) {
        throw new Error(`No ffprobe binary URL for architecture: ${targetArch}`);
      }
      await downloadFile(ffprobeUrl, ffprobeDest);
      console.log(`✓ Downloaded ffprobe for ${targetArch} to ${ffprobeDest}`);
    } else {
      // Use the locally installed binary
      const ffprobeStatic = require('ffprobe-static');
      const ffprobePath = ffprobeStatic.path || ffprobeStatic;
      if (!ffprobePath) {
        throw new Error('ffprobe-static returned null path');
      }
      fs.copyFileSync(ffprobePath, ffprobeDest);
      fs.chmodSync(ffprobeDest, 0o755);
      console.log(`✓ Copied ffprobe to ${ffprobeDest}`);
    }
  } catch (e) {
    console.error('✗ Error getting ffprobe:', e.message);
    success = false;
  }

  if (!success) {
    console.error('\n⚠ Some binaries could not be obtained.');
    console.error('   For development builds, ensure ffmpeg-static and ffprobe-static are installed: npm install');
    console.error('   For distribution builds, binaries will be downloaded automatically from GitHub releases.');
    process.exit(1);
  }

  console.log('\n✓ All binaries copied successfully');
}

// Run the main function
copyBinaries().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
