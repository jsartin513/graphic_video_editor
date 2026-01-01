#!/usr/bin/env node
/**
 * Generate a camera icon for Video Merger
 * Creates an SVG icon and optionally converts it to PNG/ICNS formats
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'build', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple camera icon SVG with transparent background
const cameraIconSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cameraGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#007aff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0051d5;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Transparent background - no background circle -->
  
  <!-- Camera body (rounded rectangle) - darker gray/blue -->
  <rect x="140" y="180" width="232" height="152" rx="20" fill="#4a90e2" opacity="0.95"/>
  
  <!-- Camera lens (outer circle) -->
  <circle cx="256" cy="240" r="52" fill="#2c2c2e"/>
  
  <!-- Camera lens (middle circle) -->
  <circle cx="256" cy="240" r="42" fill="#1d1d1f"/>
  
  <!-- Camera lens (inner highlight) -->
  <circle cx="256" cy="232" r="28" fill="#4a4a4c" opacity="0.6"/>
  <circle cx="256" cy="232" r="24" fill="#1d1d1f"/>
  <circle cx="260" cy="228" r="8" fill="#ffffff" opacity="0.3"/>
  
  <!-- Viewfinder (top rectangle) -->
  <rect x="210" y="160" width="92" height="32" rx="6" fill="#2c2c2e"/>
  <rect x="216" y="166" width="80" height="20" rx="4" fill="#1d1d1f"/>
  
  <!-- Flash (small circle) - lighter highlight -->
  <circle cx="350" cy="210" r="12" fill="#ffffff" opacity="0.9"/>
  
  <!-- Merge indicator (two arrows converging) -->
  <g transform="translate(256, 320)">
    <!-- Left arrow -->
    <path d="M -30 -10 L -50 -10 L -40 0 L -50 10 L -30 10 L -20 0 Z" fill="#007aff"/>
    <!-- Right arrow -->
    <path d="M 30 -10 L 50 -10 L 40 0 L 50 10 L 30 10 L 20 0 Z" fill="#007aff"/>
    <!-- Center merge symbol -->
    <circle cx="0" cy="0" r="8" fill="#007aff"/>
  </g>
</svg>`;

// Save SVG
const svgPath = path.join(iconsDir, 'icon.svg');
fs.writeFileSync(svgPath, cameraIconSVG);
console.log('✅ Created SVG icon:', svgPath);

// Check if we can convert to PNG (requires rsvg-convert or similar)
// On macOS, we can use sips or qlmanage, but for SVG we might need additional tools
try {
  // Try using rsvg-convert first (best for preserving transparency)
  const png512Path = path.join(iconsDir, 'icon-512.png');
  try {
    execSync(`rsvg-convert -w 512 -h 512 --format png "${svgPath}" -o "${png512Path}"`, { stdio: 'ignore' });
    console.log('✅ Created PNG 512x512 (with transparency):', png512Path);
  } catch (rsvgError) {
    // Fallback to qlmanage (may not preserve transparency perfectly)
    console.log('⚠️  rsvg-convert not found, trying qlmanage...');
    console.log('   Error details:', rsvgError.message || 'rsvg-convert command failed');
    execSync(`qlmanage -t -s 512 -o "${iconsDir}" "${svgPath}"`, { stdio: 'ignore' });
    
    // qlmanage creates a file with a .png extension but keeps original name
    const qlOutput = path.join(iconsDir, 'icon.svg.png');
    if (fs.existsSync(qlOutput)) {
      fs.renameSync(qlOutput, png512Path);
      // Remove white background if qlmanage added one
      try {
        // Use sips to ensure transparency is preserved
        execSync(`sips -s format png --deleteColorManagementProperties "${png512Path}"`, { stdio: 'ignore' });
      } catch (sipsError) {
        // Ignore if sips command fails
        console.log('   Warning: Could not optimize PNG with sips:', sipsError.message || 'sips command failed');
      }
      console.log('✅ Created PNG 512x512:', png512Path);
      console.log('   Note: If background is not transparent, install rsvg-convert: brew install librsvg');
    }
  }
} catch (error) {
  console.log('⚠️  Could not auto-convert SVG to PNG. Error:', error.message || 'Unknown error');
  console.log('   You may need to:');
  console.log('   1. Install rsvg-convert: brew install librsvg');
  console.log('   2. Or manually convert using online tools');
  console.log('   3. Or use the SVG directly (electron-builder can handle SVG)');
}

console.log('\n📝 Next steps:');
console.log('   1. Review the SVG icon at:', svgPath);
console.log('   2. If needed, create PNG files at sizes: 512, 256, 128, 64, 32, 16');
console.log('   3. Create .icns file using the helper script: ./scripts/create-icns.sh');

