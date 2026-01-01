// Script to copy ffmpeg binaries for electron-builder
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

// Check if bundling is enabled (default: true for backward compatibility)
const BUNDLE_FFMPEG = process.env.BUNDLE_FFMPEG !== 'false';

// Detect target architecture from environment or npm script name
// Environment variable takes precedence, then try to detect from npm script
function getTargetArch() {
  // Check for explicit target architecture
  if (process.env.TARGET_ARCH) {
    return process.env.TARGET_ARCH;
  }
  
  // Detect from npm script name (e.g., prebuild:x64, prebuild:arm64)
  const npmConfigArgv = process.env.npm_config_argv;
  if (npmConfigArgv) {
    try {
      const argv = JSON.parse(npmConfigArgv);
      const script = argv.original?.[0];
      if (script?.includes('x64')) return 'x64';
      if (script?.includes('arm64')) return 'arm64';
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Fall back to host architecture
  const hostArch = process.arch;
  if (hostArch === 'arm64') return 'arm64';
  if (hostArch === 'x64') return 'x64';
  
  // Default to host architecture
  return hostArch;
}

// Get architecture name for ffmpeg-static releases
function getFFmpegArchName(arch) {
  if (arch === 'arm64') return 'arm64';
  if (arch === 'x64' || arch === 'x86_64') return 'x64';
  return arch;
}

// Download and decompress gzipped file from URL
async function downloadFile(url, dest, isGzipped = null) {
  // Track if original URL was gzipped (redirects might lose .gz extension)
  if (isGzipped === null) {
    isGzipped = url.endsWith('.gz');
  }
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect, preserve gzip flag
        return downloadFile(response.headers.location, dest, isGzipped).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
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
            fs.writeFileSync(dest, decompressed);
            fs.chmodSync(dest, 0o755);
            resolve();
          } catch (err) {
            try { fs.unlinkSync(dest); } catch (e) {}
            reject(new Error(`Failed to decompress: ${err.message}`));
          }
        });
        response.on('error', (err) => {
          try { fs.unlinkSync(dest); } catch (e) {}
          reject(err);
        });
      } else {
        // Direct download
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', (err) => {
          fs.unlinkSync(dest).catch(() => {});
          reject(err);
        });
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Get binary URL for specific architecture
// ffmpeg-static releases: https://github.com/eugeneware/ffmpeg-static/releases
function getBinaryUrl(binaryName, arch) {
  const archName = getFFmpegArchName(arch);
  const platform = 'darwin'; // macOS
  
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
  
  const baseUrl = 'https://github.com/eugeneware/ffmpeg-static/releases/download';
  
  if (binaryName === 'ffmpeg') {
    // ffmpeg-static: b{version}/ffmpeg-darwin-{arch}.gz
    return `${baseUrl}/${releaseTag}/${binaryName}-${platform}-${archName}.gz`;
  } else if (binaryName === 'ffprobe') {
    // Try ffmpeg-static releases first (some versions bundle ffprobe)
    // Note: ffprobe might not be in ffmpeg-static releases, so we'll need to handle that
    return `${baseUrl}/${releaseTag}/${binaryName}-${platform}-${archName}.gz`;
  }
  
  return null;
}

// Copy or download binary for specific architecture
async function copyOrDownloadBinary(binaryName, targetArch, resourcesDir) {
  const hostArch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const dest = path.join(resourcesDir, binaryName);
  
  // Normalize architectures for comparison
  const normalizedTarget = targetArch === 'x86_64' ? 'x64' : targetArch;
  const normalizedHost = hostArch === 'x86_64' ? 'x64' : hostArch;
  
  // If target matches host, use npm package (faster, no download needed)
  if (normalizedTarget === normalizedHost || (!targetArch && hostArch)) {
    try {
      let sourcePath;
      if (binaryName === 'ffmpeg') {
        sourcePath = require('ffmpeg-static');
      } else if (binaryName === 'ffprobe') {
        const ffprobeStatic = require('ffprobe-static');
        sourcePath = ffprobeStatic.path || ffprobeStatic;
      }
      
      if (sourcePath && fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, dest);
        fs.chmodSync(dest, 0o755);
        console.log(`✓ Copied ${binaryName} (${hostArch}) to ${dest}`);
        return true;
      }
    } catch (e) {
      console.warn(`⚠ Could not use npm package for ${binaryName}, will download:`, e.message);
    }
  }
  
  // Cross-compilation: download the target architecture binary
  console.log(`📥 Downloading ${binaryName} for ${targetArch} architecture...`);
  const url = getBinaryUrl(binaryName, targetArch);
  
  if (!url) {
    throw new Error(`No download URL available for ${binaryName} on ${targetArch}`);
  }
  
  try {
    await downloadFile(url, dest);
    fs.chmodSync(dest, 0o755);
    console.log(`✓ Downloaded ${binaryName} (${targetArch}) to ${dest}`);
    
    // Verify the downloaded file is valid (non-zero size)
    const stats = fs.statSync(dest);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    return true;
  } catch (e) {
    // If download fails, provide helpful error message
    const errorMsg = e.message || String(e);
    if (errorMsg.includes('404')) {
      console.error(`✗ Download URL not found (404): ${url}`);
      console.error(`  This may mean the binary for ${targetArch} is not available in this version.`);
      throw new Error(`Binary for ${targetArch} architecture not available. Try building on a ${targetArch} machine, or use the lite build (BUNDLE_FFMPEG=false).`);
    } else {
      console.error(`✗ Download failed: ${errorMsg}`);
      throw new Error(`Failed to download ${binaryName} for ${targetArch}: ${errorMsg}`);
    }
  }
}

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

// Detect target architecture
const targetArch = getTargetArch();
const hostArch = process.arch === 'arm64' ? 'arm64' : 'x64';
console.log(`Host architecture: ${hostArch}`);
console.log(`Target architecture: ${targetArch}`);

// Create resources directory
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// Copy or download binaries
(async () => {
  let success = true;
  
  try {
    await copyOrDownloadBinary('ffmpeg', targetArch, resourcesDir);
  } catch (e) {
    console.error('✗ Error getting ffmpeg:', e.message);
    success = false;
  }
  
  try {
    await copyOrDownloadBinary('ffprobe', targetArch, resourcesDir);
  } catch (e) {
    console.error('✗ Error getting ffprobe:', e.message);
    success = false;
  }
  
  if (!success) {
    console.error('\n⚠ Some binaries could not be obtained.');
    console.error('   For development builds, ensure ffmpeg-static and ffprobe-static are installed: npm install');
    console.error('   For distribution builds, binaries will be downloaded automatically.');
    process.exit(1);
  }
  
  console.log('\n✓ All binaries copied successfully');
})();

