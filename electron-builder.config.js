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

// Try multiple possible icon paths
const iconPaths = [
  path.join(__dirname, 'build', 'icon.icns'),  // Standard location
  path.join(__dirname, 'build', 'icons', 'icon.icns'),  // Our custom location
];

let iconPath = null;
for (const testPath of iconPaths) {
  if (fs.existsSync(testPath)) {
    iconPath = testPath;
    break;
  }
}

if (!iconPath) {
  console.warn('⚠️  Warning: Custom icon not found, using default Electron icon');
}

const baseConfig = {
  appId: "com.videomerger.app",
  productName: "Video Merger",
  publish: null,
  mac: {
    category: "public.app-category.video",
    ...(iconPath && { icon: iconPath }), // Only set icon property if iconPath exists
    target: [
      "dmg",
      "zip"
    ],
    // Ensure app name is shown correctly in Finder/Dock
    name: "Video Merger"
  },
  files: [
    "main.js",
    "preload.js",
    "renderer/**/*",
    "package.json"
  ],
  directories: {
    buildResources: "build",
    output: "dist"
  }
};

// Conditionally include ffmpeg binaries if they exist
const extraResourcesList = [];

if (resourcesExist) {
  extraResourcesList.push({
    from: "resources",
    to: "resources"
  });
  console.log('✓ Electron Builder: Including bundled ffmpeg binaries');
} else {
  console.log('✓ Electron Builder: Excluding bundled ffmpeg binaries (using system ffmpeg)');
}

// Include test videos if the directory exists
const testVideosDir = path.join(__dirname, 'test-videos');
if (fs.existsSync(testVideosDir)) {
  extraResourcesList.push({
    from: "test-videos",
    to: "test-videos",
    filter: ["**/*.mp4"]
  });
  console.log('✓ Electron Builder: Including test video files');
}

baseConfig.extraResources = extraResourcesList;

// Workaround: Manually copy resources using afterPack hook
// This ensures binaries are copied even if extraResources fails
if (resourcesExist) {
  baseConfig.afterPack = 'scripts/after-pack.js';
}

module.exports = baseConfig;

