// Electron Builder configuration with conditional ffmpeg bundling
const fs = require('fs');
const path = require('path');

// Minimum expected size for ffmpeg/ffprobe binaries (50MB)
const MIN_BINARY_SIZE_BYTES = 50 * 1024 * 1024;

// Validate that a binary exists and is executable
function isValidExecutable(filePath) {
  try {
    // Check if file exists and is not empty
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size === 0) {
      return false;
    }
    // On Windows, we can't reliably check executable permissions
    // so we just verify the file exists and is not empty
    if (process.platform === 'win32') {
      return true;
    }
    // When building macOS apps on non-macOS platforms (e.g., Linux in CI),
    // we can't execute the binaries but we can still check if they're valid Mach-O files
    // For now, just check size - a valid ffmpeg/ffprobe should be at least 50MB
    if (stats.size < MIN_BINARY_SIZE_BYTES) {
      console.warn(`Warning: Binary ${filePath} seems too small (${stats.size} bytes)`);
      return false;
    }
    // On Unix-like systems building for same platform, check if file has executable permissions
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch (e) {
      // If we can't check executable permission (e.g., cross-platform build),
      // just verify the file exists and has reasonable size
      return stats.size >= MIN_BINARY_SIZE_BYTES;
    }
  } catch (e) {
    return false;
  }
}

const resourcesDir = path.join(__dirname, 'resources');
const ffmpegPath = path.join(resourcesDir, 'ffmpeg');
const ffprobePath = path.join(resourcesDir, 'ffprobe');
const resourcesExist = fs.existsSync(resourcesDir) && 
  isValidExecutable(ffmpegPath) &&
  isValidExecutable(ffprobePath);

// Configure publish for auto-updates
// Note: We use --publish never in builds and let GitHub Actions handle releases
// The publish config is needed so electron-builder generates latest-mac.yml for auto-updates
const publishConfig = process.env.PUBLISH_TO_GITHUB === 'true' ? {
  provider: "github",
  owner: "jsartin513",
  repo: "graphic_video_editor"
} : null;

const baseConfig = {
  appId: "com.videomerger.app",
  productName: "Video Merger",
  publish: publishConfig,
  mac: {
    category: "public.app-category.video",
    target: [
      "dmg",
      "zip"
    ]
  },
  files: [
    "main.js",
    "preload.js",
    "renderer/**/*",
    "src/**/*",
    "package.json",
    "node_modules/electron-updater/**/*"
  ],
  directories: {
    buildResources: "build",
    output: "dist"
  }
};

// Conditionally include ffmpeg binaries if they exist
if (resourcesExist) {
  baseConfig.extraResources = [
    {
      from: "resources",
      to: "resources",
      filter: ["**/*"]
    }
  ];
  console.log('✓ Electron Builder: Including bundled ffmpeg binaries');
} else {
  baseConfig.extraResources = [];
  console.log('✓ Electron Builder: Excluding bundled ffmpeg binaries (using system ffmpeg)');
}

module.exports = baseConfig;

