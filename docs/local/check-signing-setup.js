#!/usr/bin/env node

/**
 * Script to verify code signing setup
 * Checks for Developer ID certificate and configuration
 */

const { execSync } = require('child_process');

console.log('🔍 Checking code signing setup...\n');

// Check for Developer ID certificates
console.log('1. Checking for Developer ID certificates in keychain...');
try {
  const output = execSync(
    'security find-identity -v -p codesigning | grep "Developer ID Application"',
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  if (output.trim()) {
    console.log('✅ Found Developer ID certificates:\n');
    const lines = output.trim().split('\n');
    lines.forEach(line => {
      const match = line.match(/\(([A-Z0-9]{10})\)/);
      if (match) {
        console.log(`   ${line}`);
        console.log(`   Team ID: ${match[1]}\n`);
      } else {
        console.log(`   ${line}\n`);
      }
    });

    // Extract Team ID from first certificate
    const teamIdMatch = output.match(/\(([A-Z0-9]{10})\)/);
    if (teamIdMatch) {
      console.log(`💡 Your Team ID is: ${teamIdMatch[1]}`);
      console.log(`   Set it with: export APPLE_TEAM_ID="${teamIdMatch[1]}"\n`);
    }
  } else {
    console.log('❌ No Developer ID certificates found.\n');
    console.log('   Please create one at:');
    console.log('   https://developer.apple.com/account/resources/certificates/list\n');
  }
} catch (error) {
  console.log('❌ Error checking certificates (this is normal if none exist)');
  console.log('   Make sure you have an Apple Developer account.\n');
}

// Check environment variables
console.log('2. Checking environment variables...');
const envVars = {
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  APPLE_ID: process.env.APPLE_ID,
  APPLE_APP_SPECIFIC_PASSWORD: process.env.APPLE_APP_SPECIFIC_PASSWORD ? '***set***' : undefined,
  CSC_NAME: process.env.CSC_NAME,
};

let envStatus = '✅';
for (const [key, value] of Object.entries(envVars)) {
  if (value) {
    console.log(`   ✅ ${key}: ${value}`);
  } else {
    console.log(`   ⚠️  ${key}: not set`);
    envStatus = '⚠️';
  }
}

if (envStatus === '⚠️') {
  console.log('\n💡 Tip: Environment variables are optional if your certificate is in the keychain.');
  console.log('   electron-builder will automatically find "Developer ID Application" certificates.\n');
} else {
  console.log('\n✅ All environment variables are set!\n');
}

// Check for electron-builder config
console.log('3. Checking electron-builder configuration...');
try {
  const config = require('../electron-builder.config.js');
  if (config.mac && config.mac.hardenedRuntime) {
    console.log('✅ Hardened runtime is enabled');
  } else {
    console.log('⚠️  Hardened runtime is not enabled (required for notarization)');
  }
  
  if (config.mac && config.mac.gatekeeperAssess) {
    console.log('✅ Gatekeeper assessment is enabled');
  }
} catch (error) {
  console.log('❌ Error reading electron-builder.config.js:', error.message);
}

console.log('\n📚 Next steps:');
console.log('   1. If you found a certificate above, note your Team ID');
console.log('   2. (Optional) Set environment variables for notarization:');
console.log('      export APPLE_ID="your-email@example.com"');
console.log('      export APPLE_TEAM_ID="YOUR_TEAM_ID"');
console.log('      export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"');
console.log('   3. Build your app: npm run build:fat');
console.log('   4. Check if it\'s signed: codesign -dv --verbose=4 "dist/mac/Video Merger.app"');
console.log('\n   Full guide: See CODE_SIGNING_SETUP.md\n');

