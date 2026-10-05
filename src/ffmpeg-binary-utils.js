/**
 * Shared helpers for bundled ffmpeg/ffprobe file names and download URLs (no Electron).
 */

const path = require('path');

function resolveTargetPlatform() {
  const fromEnv = process.env.TARGET_PLATFORM;
  if (fromEnv === 'win32' || fromEnv === 'darwin' || fromEnv === 'linux') {
    return fromEnv;
  }
  const lifecycleEvent = process.env.npm_lifecycle_event || '';
  if (/win/i.test(lifecycleEvent)) {
    return 'win32';
  }
  if (/mac|darwin/i.test(lifecycleEvent) || /:x64|:arm64/.test(lifecycleEvent)) {
    return 'darwin';
  }
  return process.platform;
}

function bundledBinaryFileName(binaryName, platform = process.platform) {
  if (platform === 'win32') {
    return `${binaryName}.exe`;
  }
  return binaryName;
}

function getReleaseTag(binaryName) {
  try {
    if (binaryName === 'ffmpeg') {
      const pkg = require('ffmpeg-static/package.json');
      return pkg['ffmpeg-static']['binary-release-tag'];
    }
    try {
      const pkg = require('ffprobe-static/package.json');
      return pkg['ffprobe-static']?.['binary-release-tag'];
    } catch (e) {
      const pkg = require('ffmpeg-static/package.json');
      return pkg['ffmpeg-static']['binary-release-tag'];
    }
  } catch (e) {
    return 'b6.1.1';
  }
}

function getBinaryDownloadUrl(binaryName, arch, platform) {
  const releaseTag = getReleaseTag(binaryName);
  if (platform === 'win32') {
    if (binaryName === 'ffmpeg') {
      return `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffmpeg-win32-${arch}.exe.gz`;
    }
    if (binaryName === 'ffprobe') {
      return `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffprobe-win32-${arch}.exe.gz`;
    }
    return null;
  }
  if (platform === 'darwin') {
    if (binaryName === 'ffmpeg') {
      return `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffmpeg-darwin-${arch}.gz`;
    }
    if (binaryName === 'ffprobe') {
      return `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffprobe-darwin-${arch}.gz`;
    }
  }
  return null;
}

function shouldDownloadBinaries(targetPlatform, targetArch) {
  if (targetPlatform !== process.platform) {
    return true;
  }
  return targetArch !== process.arch;
}

function getPackagedResourcesBasePath(app) {
  if (process.resourcesPath) {
    return process.resourcesPath;
  }
  try {
    return app.getPath('resources');
  } catch (e) {
    const exePath = app.getPath('exe');
    if (process.platform === 'darwin') {
      return path.join(path.dirname(exePath), '..', 'Resources');
    }
    return path.join(path.dirname(exePath), 'resources');
  }
}

module.exports = {
  resolveTargetPlatform,
  bundledBinaryFileName,
  getBinaryDownloadUrl,
  shouldDownloadBinaries,
  getPackagedResourcesBasePath
};
