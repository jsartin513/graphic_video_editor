// Electron Builder afterPack hook to copy ffmpeg binaries
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { bundledBinaryFileName } = require('../src/ffmpeg-binary-utils');

function copyBinaryPair(resourcesSrc, resourcesDest, platform) {
  const ffmpegName = bundledBinaryFileName('ffmpeg', platform);
  const ffprobeName = bundledBinaryFileName('ffprobe', platform);

  const ffmpegSrc = path.join(resourcesSrc, ffmpegName);
  const ffprobeSrc = path.join(resourcesSrc, ffprobeName);

  if (!fs.existsSync(ffmpegSrc)) {
    throw new Error(`FFmpeg binary not found at ${ffmpegSrc}`);
  }
  if (!fs.existsSync(ffprobeSrc)) {
    throw new Error(`FFprobe binary not found at ${ffprobeSrc}`);
  }

  if (!fs.existsSync(resourcesDest)) {
    fs.mkdirSync(resourcesDest, { recursive: true });
  }

  for (const name of [ffmpegName, ffprobeName]) {
    const src = path.join(resourcesSrc, name);
    const dest = path.join(resourcesDest, name);
    fs.copyFileSync(src, dest);
    if (platform !== 'win32') {
      execSync(`chmod +x "${dest}"`, { stdio: 'ignore' });
    }
    const size = fs.statSync(src).size;
    console.log(`[afterPack] ✓ Copied ${name} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  }
}

exports.default = async function afterPack(context) {
  const projectDir = context.projectDir || process.cwd();
  const appOutDir = context.appOutDir;
  const platform = context.electronPlatformName || process.platform;

  if (!appOutDir) {
    console.error('[afterPack] Error: appOutDir is undefined in context');
    return;
  }

  const resourcesSrc = path.join(projectDir, 'resources');
  if (!fs.existsSync(resourcesSrc)) {
    throw new Error(`Resources directory not found at ${resourcesSrc}. Make sure prebuild script ran successfully.`);
  }

  let resourcesDest;

  if (platform === 'darwin') {
    const entries = fs.readdirSync(appOutDir);
    const appBundle = entries.find((e) => e.endsWith('.app'));
    if (!appBundle) {
      console.error(`[afterPack] Error: No .app bundle found in ${appOutDir}`);
      return;
    }
    resourcesDest = path.join(appOutDir, appBundle, 'Contents', 'Resources', 'resources');
  } else if (platform === 'win32') {
    resourcesDest = path.join(appOutDir, 'resources', 'resources');
  } else {
    console.log(`[afterPack] Skipping manual copy for platform ${platform} (extraResources only)`);
    return;
  }

  console.log(`[afterPack] Copying resources from ${resourcesSrc} to ${resourcesDest}`);
  copyBinaryPair(resourcesSrc, resourcesDest, platform);
  console.log('[afterPack] Resources copy completed');

  if (process.env.INCLUDE_TEST_VIDEOS === 'true' && platform === 'darwin') {
    const entries = fs.readdirSync(appOutDir);
    const appBundle = entries.find((e) => e.endsWith('.app'));
    const testVideosSrc = path.join(projectDir, 'test-videos');
    const testVideosDest = path.join(appOutDir, appBundle, 'Contents', 'Resources', 'test-videos');

    if (fs.existsSync(testVideosSrc)) {
      if (!fs.existsSync(testVideosDest)) {
        fs.mkdirSync(testVideosDest, { recursive: true });
      }
      const testFiles = fs.readdirSync(testVideosSrc).filter((f) => /\.(mp4|MP4)$/i.test(f));
      for (const file of testFiles) {
        fs.copyFileSync(path.join(testVideosSrc, file), path.join(testVideosDest, file));
      }
    }
  }
};
