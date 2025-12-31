// Electron Builder configuration with conditional ffmpeg bundling
const fs = require('fs');
const path = require('path');

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
    // On Unix-like systems, check if file has executable permissions
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch (e) {
      return false;
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

const baseConfig = {
  appId: "com.videoeditor.app",
  productName: "Video Merger",
  publish: null,
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
    "package.json"
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

