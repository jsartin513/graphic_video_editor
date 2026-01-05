// Electron Builder afterPack hook to copy ffmpeg binaries
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function(context) {
  // Context object structure: { projectDir, appOutDir, electronPlatformName, arch, ... }
  const projectDir = context.projectDir || process.cwd();
  const appOutDir = context.appOutDir;
  
  if (!appOutDir) {
    console.error('[afterPack] Error: appOutDir is undefined in context');
    return;
  }
  
  const resourcesSrc = path.join(projectDir, 'resources');
  // appOutDir is the directory containing the .app bundle (e.g., dist/mac)
  // Find the .app bundle in appOutDir
  const entries = fs.readdirSync(appOutDir);
  const appBundle = entries.find(e => e.endsWith('.app'));
  if (!appBundle) {
    console.error(`[afterPack] Error: No .app bundle found in ${appOutDir}`);
    return;
  }
  const resourcesDest = path.join(appOutDir, appBundle, 'Contents', 'Resources', 'resources');
  
  console.log(`[afterPack] Copying resources from ${resourcesSrc} to ${resourcesDest}`);
  
  // Check if source exists
  if (!fs.existsSync(resourcesSrc)) {
    console.warn(`[afterPack] Warning: resources directory not found at ${resourcesSrc}`);
    return;
  }
  
  // Create destination directory
  if (!fs.existsSync(resourcesDest)) {
    fs.mkdirSync(resourcesDest, { recursive: true });
    console.log(`[afterPack] Created directory: ${resourcesDest}`);
  }
  
  // Copy ffmpeg and ffprobe
  const binaries = ['ffmpeg', 'ffprobe'];
  for (const binary of binaries) {
    const src = path.join(resourcesSrc, binary);
    const dest = path.join(resourcesDest, binary);
    
    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, dest);
        // Make executable
        if (process.platform !== 'win32') {
          execSync(`chmod +x "${dest}"`, { stdio: 'ignore' });
        }
        const size = fs.statSync(src).size;
        console.log(`[afterPack] ✓ Copied ${binary} (${(size / 1024 / 1024).toFixed(1)} MB)`);
      } catch (error) {
        console.error(`[afterPack] Error copying ${binary}:`, error.message);
      }
    } else {
      console.warn(`[afterPack] Warning: ${binary} not found at ${src}`);
    }
  }
  
  console.log('[afterPack] Resources copy completed');
};

