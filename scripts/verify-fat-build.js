#!/usr/bin/env node
// Script to verify that FAT builds include ffmpeg binaries
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');

// Find all .app bundles in dist directory
function findAppBundles() {
  const appBundles = [];
  
  function searchDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.endsWith('.app')) {
            appBundles.push(fullPath);
          } else {
            searchDir(fullPath);
          }
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }
  
  if (fs.existsSync(DIST_DIR)) {
    searchDir(DIST_DIR);
  }
  
  return appBundles;
}

// Check if binaries exist in app bundle
function checkAppBundle(appPath) {
  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  const binariesPath = path.join(resourcesPath, 'resources');
  const ffmpegPath = path.join(binariesPath, 'ffmpeg');
  const ffprobePath = path.join(binariesPath, 'ffprobe');
  
  const result = {
    appPath,
    appName: path.basename(appPath),
    resourcesExists: fs.existsSync(resourcesPath),
    binariesDirExists: fs.existsSync(binariesPath),
    ffmpegExists: fs.existsSync(ffmpegPath),
    ffprobeExists: fs.existsSync(ffprobePath),
    ffmpegSize: null,
    ffprobeSize: null,
    ffmpegArch: null,
    ffprobeArch: null,
    errors: []
  };
  
  if (result.ffmpegExists) {
    try {
      const stats = fs.statSync(ffmpegPath);
      result.ffmpegSize = stats.size;
      
      // Try to detect architecture using file command (if available)
      try {
        const { execSync } = require('child_process');
        const fileOutput = execSync(`file "${ffmpegPath}"`, { encoding: 'utf8' });
        if (fileOutput.includes('x86_64')) {
          result.ffmpegArch = 'x64';
        } else if (fileOutput.includes('arm64')) {
          result.ffmpegArch = 'arm64';
        }
      } catch (e) {
        // file command not available or failed
      }
    } catch (e) {
      result.errors.push(`Error checking ffmpeg: ${e.message}`);
    }
  }
  
  if (result.ffprobeExists) {
    try {
      const stats = fs.statSync(ffprobePath);
      result.ffprobeSize = stats.size;
      
      // Try to detect architecture
      try {
        const { execSync } = require('child_process');
        const fileOutput = execSync(`file "${ffprobePath}"`, { encoding: 'utf8' });
        if (fileOutput.includes('x86_64')) {
          result.ffprobeArch = 'x64';
        } else if (fileOutput.includes('arm64')) {
          result.ffprobeArch = 'arm64';
        }
      } catch (e) {
        // file command not available or failed
      }
    } catch (e) {
      result.errors.push(`Error checking ffprobe: ${e.message}`);
    }
  }
  
  // Check if binaries are executable
  if (result.ffmpegExists) {
    try {
      fs.accessSync(ffmpegPath, fs.constants.X_OK);
      result.ffmpegExecutable = true;
    } catch (e) {
      result.ffmpegExecutable = false;
      result.errors.push('ffmpeg is not executable');
    }
  }
  
  if (result.ffprobeExists) {
    try {
      fs.accessSync(ffprobePath, fs.constants.X_OK);
      result.ffprobeExecutable = true;
    } catch (e) {
      result.ffprobeExecutable = false;
      result.errors.push('ffprobe is not executable');
    }
  }
  
  return result;
}

// Format file size
function formatSize(bytes) {
  if (!bytes) return 'N/A';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// Main function
function main() {
  console.log('🔍 Checking FAT builds for bundled ffmpeg binaries...\n');
  
  const appBundles = findAppBundles();
  
  if (appBundles.length === 0) {
    console.log('❌ No .app bundles found in dist/ directory');
    console.log('   Run a build first: npm run build:fat:x64 or npm run build:fat:arm64');
    process.exit(1);
  }
  
  console.log(`Found ${appBundles.length} app bundle(s):\n`);
  
  let allGood = true;
  
  for (const appPath of appBundles) {
    const result = checkAppBundle(appPath);
    const appName = result.appName;
    
    console.log(`📦 ${appName}`);
    console.log(`   Path: ${appPath}`);
    
    if (result.ffmpegExists && result.ffprobeExists) {
      console.log(`   ✅ ffmpeg: ${formatSize(result.ffmpegSize)}${result.ffmpegArch ? ` (${result.ffmpegArch})` : ''}`);
      console.log(`   ✅ ffprobe: ${formatSize(result.ffprobeSize)}${result.ffprobeArch ? ` (${result.ffprobeArch})` : ''}`);
      
      if (result.ffmpegExecutable && result.ffprobeExecutable) {
        console.log(`   ✅ Both binaries are executable`);
      } else {
        console.log(`   ⚠️  Executable permission issues`);
        allGood = false;
      }
      
      // Check for architecture mismatch
      if (result.ffmpegArch && result.ffprobeArch && result.ffmpegArch !== result.ffprobeArch) {
        console.log(`   ⚠️  WARNING: Architecture mismatch! ffmpeg is ${result.ffmpegArch}, ffprobe is ${result.ffprobeArch}`);
        allGood = false;
      }
      
      // Check file sizes (should be reasonable - ffmpeg/ffprobe are usually 50-100MB)
      const minSize = 10 * 1024 * 1024; // 10MB minimum
      if (result.ffmpegSize && result.ffmpegSize < minSize) {
        console.log(`   ⚠️  WARNING: ffmpeg seems too small (${formatSize(result.ffmpegSize)})`);
        allGood = false;
      }
      if (result.ffprobeSize && result.ffprobeSize < minSize) {
        console.log(`   ⚠️  WARNING: ffprobe seems too small (${formatSize(result.ffprobeSize)})`);
        allGood = false;
      }
    } else {
      console.log(`   ❌ Missing binaries!`);
      if (!result.ffmpegExists) console.log(`      - ffmpeg not found`);
      if (!result.ffprobeExists) console.log(`      - ffprobe not found`);
      if (!result.binariesDirExists) console.log(`      - resources directory not found`);
      allGood = false;
    }
    
    if (result.errors.length > 0) {
      console.log(`   ⚠️  Errors:`);
      result.errors.forEach(err => console.log(`      - ${err}`));
      allGood = false;
    }
    
    console.log('');
  }
  
  if (allGood) {
    console.log('✅ All app bundles include ffmpeg binaries correctly!');
    process.exit(0);
  } else {
    console.log('❌ Some issues found with bundled binaries');
    process.exit(1);
  }
}

main();

