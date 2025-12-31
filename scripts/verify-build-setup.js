#!/usr/bin/env node
// Simple verification script for build setup

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Build Setup...\n');

let allGood = true;

// Check 1: Package.json scripts
console.log('1. Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const requiredScripts = ['build:fat', 'build:lite', 'build:fat:arm64', 'build:lite:arm64'];
requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(`   ✅ ${script} exists`);
  } else {
    console.log(`   ❌ ${script} missing`);
    allGood = false;
  }
});

// Check 2: electron-builder.config.js exists
console.log('\n2. Checking electron-builder.config.js...');
const configPath = path.join(__dirname, '..', 'electron-builder.config.js');
if (fs.existsSync(configPath)) {
  console.log('   ✅ electron-builder.config.js exists');
  try {
    const config = require(configPath);
    if (config.appId && config.productName) {
      console.log('   ✅ Config loads correctly');
    } else {
      console.log('   ❌ Config missing required fields');
      allGood = false;
    }
  } catch (e) {
    console.log(`   ❌ Config error: ${e.message}`);
    allGood = false;
  }
} else {
  console.log('   ❌ electron-builder.config.js not found');
  allGood = false;
}

// Check 3: Copy script exists
console.log('\n3. Checking copy script...');
const copyScriptPath = path.join(__dirname, 'copy-ffmpeg-binaries.js');
if (fs.existsSync(copyScriptPath)) {
  console.log('   ✅ copy-ffmpeg-binaries.js exists');
  const scriptContent = fs.readFileSync(copyScriptPath, 'utf8');
  if (scriptContent.includes('BUNDLE_FFMPEG')) {
    console.log('   ✅ Script handles BUNDLE_FFMPEG variable');
  } else {
    console.log('   ❌ Script missing BUNDLE_FFMPEG handling');
    allGood = false;
  }
} else {
  console.log('   ❌ copy-ffmpeg-binaries.js not found');
  allGood = false;
}

// Check 4: Dependencies
console.log('\n4. Checking dependencies...');
if (packageJson.dependencies && packageJson.dependencies['ffmpeg-static']) {
  console.log('   ✅ ffmpeg-static in dependencies');
} else {
  console.log('   ❌ ffmpeg-static not in dependencies');
  allGood = false;
}

if (packageJson.dependencies && packageJson.dependencies['ffprobe-static']) {
  console.log('   ✅ ffprobe-static in dependencies');
} else {
  console.log('   ❌ ffprobe-static not in dependencies');
  allGood = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ All checks passed! Build setup looks correct.');
  console.log('\nNext steps:');
  console.log('  - Run: npm install (if not done already)');
  console.log('  - Test: BUNDLE_FFMPEG=true node scripts/copy-ffmpeg-binaries.js');
  console.log('  - Test: BUNDLE_FFMPEG=false node scripts/copy-ffmpeg-binaries.js');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the errors above.');
  process.exit(1);
}

