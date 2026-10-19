#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function main() {
  const svgPath = path.join(__dirname, '..', 'build', 'icons', 'icon.svg');
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');

  if (!fs.existsSync(svgPath)) {
    console.error('Missing build/icons/icon.svg — run npm run generate-icon first');
    process.exit(1);
  }

  const sharp = require('sharp');
  const toIco = require('to-ico');
  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(svgPath).resize(size, size).png().toBuffer())
  );
  const ico = await toIco(pngBuffers);
  fs.writeFileSync(icoPath, ico);
  console.log('✅ Created Windows icon:', icoPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
