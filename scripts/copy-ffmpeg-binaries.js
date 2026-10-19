// Script to copy ffmpeg binaries for electron-builder
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { execSync } = require('child_process');
const {
  resolveTargetPlatform,
  bundledBinaryFileName,
  getBinaryDownloadUrl,
  shouldDownloadBinaries
} = require('../src/ffmpeg-binary-utils');

const MIN_BINARY_SIZE_BYTES = 10 * 1024 * 1024;

const BUNDLE_FFMPEG = process.env.BUNDLE_FFMPEG !== 'false';

const lifecycleEvent = process.env.npm_lifecycle_event || '';
const targetArch = process.env.TARGET_ARCH ||
  (lifecycleEvent.includes(':x64') ? 'x64' :
    lifecycleEvent.includes(':arm64') ? 'arm64' :
      process.arch);

const targetPlatform = resolveTargetPlatform();
const resourcesDir = path.join(__dirname, '..', 'resources');

if (!BUNDLE_FFMPEG) {
  console.log('BUNDLE_FFMPEG=false - Skipping ffmpeg bundling');
  console.log('App will use system-installed ffmpeg if available');

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

console.log(`BUNDLE_FFMPEG=true - Bundling ffmpeg binaries for ${targetPlatform} ${targetArch}`);
console.log(`Host platform: ${process.platform} ${process.arch}`);

if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

function binaryLooksValidForArch(destPath, arch, platform) {
  try {
    const stats = fs.statSync(destPath);
    if (!stats.isFile() || stats.size < MIN_BINARY_SIZE_BYTES) {
      return false;
    }
    if (platform === 'darwin' && process.platform === 'darwin') {
      const out = execSync(`file "${destPath}"`, { encoding: 'utf8' });
      if (arch === 'arm64' && !out.includes('arm64')) {
        return false;
      }
      if (arch === 'x64' && !out.includes('x86_64')) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function chmodIfUnix(filePath) {
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o755);
  }
}

function downloadFile(url, destPath, isGzipped = null) {
  if (isGzipped === null) {
    isGzipped = url.endsWith('.gz');
  }

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
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

      if (isGzipped) {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const gzippedData = Buffer.concat(chunks);
            const decompressed = zlib.gunzipSync(gzippedData);
            fs.writeFileSync(destPath, decompressed);
            chmodIfUnix(destPath);
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
        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          chmodIfUnix(destPath);
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

let success = true;
const useDownload = shouldDownloadBinaries(targetPlatform, targetArch);

async function copyBinaries() {
  const ffmpegFile = bundledBinaryFileName('ffmpeg', targetPlatform);
  const ffprobeFile = bundledBinaryFileName('ffprobe', targetPlatform);

  try {
    const ffmpegDest = path.join(resourcesDir, ffmpegFile);

    if (useDownload) {
      console.log(`Downloading ${targetArch} ffmpeg for ${targetPlatform} (host: ${process.platform})`);
      const ffmpegUrl = getBinaryDownloadUrl('ffmpeg', targetArch, targetPlatform);
      if (!ffmpegUrl) {
        throw new Error(`No ffmpeg binary URL for ${targetPlatform} ${targetArch}`);
      }
      await downloadFile(ffmpegUrl, ffmpegDest);
      console.log(`✓ Downloaded ffmpeg to ${ffmpegDest}`);
    } else {
      const ffmpegPath = require('ffmpeg-static');
      if (!ffmpegPath) {
        throw new Error('ffmpeg-static returned null path');
      }
      fs.copyFileSync(ffmpegPath, ffmpegDest);
      chmodIfUnix(ffmpegDest);
      console.log(`✓ Copied ffmpeg to ${ffmpegDest}`);
    }
  } catch (e) {
    console.error('✗ Error getting ffmpeg:', e.message);
    success = false;
  }

  try {
    const ffprobeDest = path.join(resourcesDir, ffprobeFile);

    if (!useDownload && binaryLooksValidForArch(ffprobeDest, targetArch, targetPlatform)) {
      console.log(`✓ Using existing ffprobe at ${ffprobeDest}`);
    } else if (!useDownload) {
      try {
        const ffprobeStatic = require('ffprobe-static');
        const ffprobePath = ffprobeStatic.path || ffprobeStatic;
        if (ffprobePath && fs.existsSync(ffprobePath)) {
          fs.copyFileSync(ffprobePath, ffprobeDest);
          chmodIfUnix(ffprobeDest);
          console.log(`✓ Copied ffprobe to ${ffprobeDest}`);
        } else {
          throw new Error('ffprobe-static path missing');
        }
      } catch (copyErr) {
        console.log(`Downloading ${targetArch} ffprobe for ${targetPlatform}`);
        const ffprobeUrl = getBinaryDownloadUrl('ffprobe', targetArch, targetPlatform);
        if (!ffprobeUrl) {
          throw new Error(`No ffprobe binary URL for ${targetPlatform} ${targetArch}`);
        }
        await downloadFile(ffprobeUrl, ffprobeDest);
        console.log(`✓ Downloaded ffprobe to ${ffprobeDest}`);
      }
    } else {
      console.log(`Downloading ${targetArch} ffprobe for ${targetPlatform}`);
      const ffprobeUrl = getBinaryDownloadUrl('ffprobe', targetArch, targetPlatform);
      if (!ffprobeUrl) {
        throw new Error(`No ffprobe binary URL for ${targetPlatform} ${targetArch}`);
      }
      await downloadFile(ffprobeUrl, ffprobeDest);
      console.log(`✓ Downloaded ffprobe to ${ffprobeDest}`);
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

copyBinaries().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
