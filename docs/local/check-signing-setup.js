#!/usr/bin/env node

/**
 * Script to verify code signing setup
 * Checks for Developer ID certificate and configuration
 */

const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Checking code signing setup...\n');

function listIdentities() {
  try {
    return execSync('security find-identity -v -p codesigning', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
  } catch (error) {
    return error.stdout || '';
  }
}

console.log('1. Checking for Developer ID certificates in keychain...');
const identities = listIdentities();
const developerIdLines = identities
  .split('\n')
  .filter(line => line.includes('Developer ID Application'));
const appleDevLines = identities
  .split('\n')
  .filter(line => line.includes('Apple Development'));

if (developerIdLines.length) {
  console.log('✅ Found Developer ID certificates:\n');
  developerIdLines.forEach(line => {
    const match = line.match(/\(([A-Z0-9]{10})\)/);
    if (match) {
      console.log(`   ${line}`);
      console.log(`   Team ID: ${match[1]}\n`);
    } else {
      console.log(`   ${line}\n`);
    }
  });

  const teamIdMatch = developerIdLines.join('\n').match(/\(([A-Z0-9]{10})\)/);
  if (teamIdMatch) {
    console.log(`💡 Your Team ID is: ${teamIdMatch[1]}`);
    console.log(`   Set it with:`);
    console.log(`     export APPLE_TEAM_ID="${teamIdMatch[1]}"`);
    console.log(`     export CSC_NAME="Your Name (${teamIdMatch[1]})"`);
    console.log('     (Use the name only — not the "Developer ID Application:" prefix)\n');
  }
} else {
  console.log('❌ No Developer ID Application certificates found.\n');
  if (appleDevLines.length) {
    console.log('   Found "Apple Development" identities instead. Those cannot be notarized.');
    appleDevLines.forEach(line => console.log(`   ${line}`));
    console.log('\n   Create a Developer ID Application certificate:');
    console.log('   docs/local/GET_CERTIFICATE_STEPS.md\n');
  } else {
    console.log('   Please create one at:');
    console.log('   https://developer.apple.com/account/resources/certificates/list\n');
  }
}

console.log('2. Checking environment variables...');
const envVars = {
  CSC_NAME: process.env.CSC_NAME,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  APPLE_ID: process.env.APPLE_ID,
  APPLE_APP_SPECIFIC_PASSWORD: process.env.APPLE_APP_SPECIFIC_PASSWORD ? '***set***' : undefined,
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
  console.log('\n💡 Friend builds need CSC_NAME plus Apple notarization env vars.');
  console.log('   Unsigned CI builds should leave these unset.\n');
} else {
  console.log('\n✅ All environment variables are set!\n');
}

console.log('3. Checking electron-builder configuration...');
try {
  const config = require(path.join(__dirname, '..', '..', 'electron-builder.config.js'));
  if (config.mac && config.mac.hardenedRuntime) {
    console.log('✅ Hardened runtime is enabled');
  } else {
    console.log('⚠️  Hardened runtime is not enabled (required for notarization)');
  }

  if (config.mac && config.mac.entitlements) {
    console.log(`✅ Entitlements: ${config.mac.entitlements}`);
  } else {
    console.log('⚠️  No entitlements file configured');
  }

  if (config.mac && config.mac.notarize) {
    console.log('✅ Notarize config is present (APPLE_TEAM_ID is set)');
  } else {
    console.log('ℹ️  Notarize is off until APPLE_TEAM_ID is set');
  }

  if (config.mac && config.mac.identity) {
    console.log(`✅ Signing identity: ${config.mac.identity}`);
  } else {
    console.log('ℹ️  identity is null (unsigned) until CSC_NAME is set');
  }
} catch (error) {
  console.log('❌ Error reading electron-builder.config.js:', error.message);
}

console.log('\n📚 Next steps:');
console.log('   1. Create a Developer ID Application cert if you only have Apple Development');
console.log('      See docs/local/GET_CERTIFICATE_STEPS.md');
console.log('   2. Set environment variables:');
console.log('      export CSC_NAME="JESSICA L SARTIN (LKF2468HZ2)"');
console.log('      export APPLE_ID="your-email@example.com"');
console.log('      export APPLE_TEAM_ID="YOUR_TEAM_ID"');
console.log('      export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"');
console.log('   3. Build: npm run build:fat:arm64 && npm run build:fat:x64');
console.log('   4. Verify: npm run verify-signed-build');
console.log('\n   Full guide: docs/local/CODE_SIGNING_SETUP.md\n');
