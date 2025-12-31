// Electron Builder configuration with conditional ffmpeg bundling
const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, 'resources');
const resourcesExist = fs.existsSync(resourcesDir) && 
  fs.existsSync(path.join(resourcesDir, 'ffmpeg')) &&
  fs.existsSync(path.join(resourcesDir, 'ffprobe'));

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

