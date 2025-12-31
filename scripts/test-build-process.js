#!/usr/bin/env node
// Test script for the build process

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const resourcesDir = path.join(__dirname, '..', 'resources');

let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      env: { ...process.env, ...env },
      shell: true,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function main() {
  console.log('🧪 Testing Build Process\n');
  console.log('='.repeat(50));
  
  // Test 1: Check dependencies are installed
  console.log('\n📦 Test 1: Checking dependencies...');
  await test('ffmpeg-static package exists', () => {
    try {
      require('ffmpeg-static');
    } catch (e) {
      throw new Error('ffmpeg-static not installed. Run: npm install');
    }
  });
  
  await test('ffprobe-static package exists', () => {
    try {
      require('ffprobe-static');
    } catch (e) {
      throw new Error('ffprobe-static not installed. Run: npm install');
    }
  });
  
  // Test 2: Test lite build (no bundling)
  console.log('\n📦 Test 2: Testing Lite Build (BUNDLE_FFMPEG=false)...');
  
  // Clean up first
  if (fs.existsSync(resourcesDir)) {
    fs.rmSync(resourcesDir, { recursive: true, force: true });
  }
  
  await test('Copy script runs with BUNDLE_FFMPEG=false', async () => {
    await runCommand('node', ['scripts/copy-ffmpeg-binaries.js'], {
      BUNDLE_FFMPEG: 'false'
    });
  });
  
  await test('Resources directory is removed for lite build', () => {
    if (fs.existsSync(resourcesDir)) {
      throw new Error('Resources directory should not exist for lite build');
    }
  });
  
  // Test 3: Test fat build (with bundling)
  console.log('\n📦 Test 3: Testing Fat Build (BUNDLE_FFMPEG=true)...');
  
  await test('Copy script runs with BUNDLE_FFMPEG=true', async () => {
    await runCommand('node', ['scripts/copy-ffmpeg-binaries.js'], {
      BUNDLE_FFMPEG: 'true'
    });
  });
  
  await test('Resources directory exists for fat build', () => {
    if (!fs.existsSync(resourcesDir)) {
      throw new Error('Resources directory should exist for fat build');
    }
  });
  
  await test('ffmpeg binary exists in resources', () => {
    const ffmpegPath = path.join(resourcesDir, 'ffmpeg');
    if (!fs.existsSync(ffmpegPath)) {
      throw new Error('ffmpeg binary not found in resources directory');
    }
    const stats = fs.statSync(ffmpegPath);
    if (!stats.isFile()) {
      throw new Error('ffmpeg is not a file');
    }
  });
  
  await test('ffprobe binary exists in resources', () => {
    const ffprobePath = path.join(resourcesDir, 'ffprobe');
    if (!fs.existsSync(ffprobePath)) {
      throw new Error('ffprobe binary not found in resources directory');
    }
    const stats = fs.statSync(ffprobePath);
    if (!stats.isFile()) {
      throw new Error('ffprobe is not a file');
    }
  });
  
  // Test 4: Test electron-builder config
  console.log('\n📦 Test 4: Testing Electron Builder Config...');
  
  await test('electron-builder.config.js loads correctly', () => {
    const config = require('../electron-builder.config.js');
    if (!config.appId) {
      throw new Error('Config missing appId');
    }
    if (!config.productName) {
      throw new Error('Config missing productName');
    }
  });
  
  await test('electron-builder.config.js includes extraResources when resources exist', () => {
    const config = require('../electron-builder.config.js');
    if (!config.extraResources || config.extraResources.length === 0) {
      throw new Error('extraResources should be included when resources directory exists');
    }
  });
  
  // Test 5: Test package.json scripts
  console.log('\n📦 Test 5: Testing Package.json Scripts...');
  
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  await test('build:fat script exists', () => {
    if (!packageJson.scripts['build:fat']) {
      throw new Error('build:fat script not found');
    }
  });
  
  await test('build:lite script exists', () => {
    if (!packageJson.scripts['build:lite']) {
      throw new Error('build:lite script not found');
    }
  });
  
  await test('build:fat:arm64 script exists', () => {
    if (!packageJson.scripts['build:fat:arm64']) {
      throw new Error('build:fat:arm64 script not found');
    }
  });
  
  await test('build:lite:arm64 script exists', () => {
    if (!packageJson.scripts['build:lite:arm64']) {
      throw new Error('build:lite:arm64 script not found');
    }
  });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

