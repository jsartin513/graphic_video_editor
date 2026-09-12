#!/usr/bin/env node
/**
 * Copy dist artifacts into a release folder using exact basenames from latest-mac.yml.
 * GitHub renames uploads with spaces (Video Merger → Video.Merger), which breaks
 * electron-updater URLs that use Video-Merger-* from electron-builder metadata.
 *
 * Usage: node scripts/stage-release-assets.js <version> <merged-yml> <out-dir>
 */

const fs = require('fs');
const path = require('path');

function parseLatestMacYml(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const urls = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*- url:\s*(.+)$/);
    if (m) urls.push(m[1].trim());
  }
  const pathMatch = text.match(/^path:\s*(.+)$/m);
  if (pathMatch) urls.push(pathMatch[1].trim());
  return [...new Set(urls)];
}

function archFromName(name) {
  if (name.includes('arm64')) return 'arm64';
  if (name.includes('x64')) return 'x64';
  return null;
}

function extFromName(name) {
  const m = name.match(/\.(dmg|zip)(?:\.blockmap)?$/);
  return m ? m[1] : null;
}

function findSourceFile(distDir, version, targetUrl) {
  const targetBase = path.basename(targetUrl);
  const direct = path.join(distDir, targetBase);
  if (fs.existsSync(direct)) return direct;

  const arch = archFromName(targetBase);
  const ext = extFromName(targetBase);
  if (!arch || !ext) return null;

  const candidates = fs.readdirSync(distDir).filter((name) => {
    if (!name.includes(version)) return false;
    if (!name.includes(arch)) return false;
    if (ext === 'zip' && name.endsWith('.zip.blockmap')) return targetBase.endsWith('.blockmap');
    if (targetBase.endsWith('.blockmap')) return name.endsWith('.zip.blockmap');
    return name.endsWith(`.${ext}`);
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return path.join(distDir, candidates[0]);
}

function main() {
  const [version, ymlPath, outDir] = process.argv.slice(2);
  if (!version || !ymlPath || !outDir) {
    console.error('Usage: node scripts/stage-release-assets.js <version> <merged-yml> <out-dir>');
    process.exit(1);
  }

  const distDir = path.dirname(path.resolve(ymlPath));
  const resolvedYml = path.resolve(ymlPath);
  if (!fs.existsSync(resolvedYml)) {
    console.error(`Missing ${resolvedYml}`);
    process.exit(1);
  }

  const urls = parseLatestMacYml(resolvedYml);
  fs.mkdirSync(path.resolve(outDir), { recursive: true });

  const staged = new Set();
  for (const url of urls) {
    const destName = path.basename(url);
    if (staged.has(destName)) continue;
    const src = findSourceFile(distDir, version, url);
    if (!src) {
      console.error(`Could not find dist file for ${destName}`);
      process.exit(1);
    }
    const dest = path.join(path.resolve(outDir), destName);
    fs.copyFileSync(src, dest);
    staged.add(destName);
    console.log(`  ${path.basename(src)} → ${destName}`);

    if (destName.endsWith('.zip')) {
      const blockmapDest = `${destName}.blockmap`;
      if (!staged.has(blockmapDest)) {
        const blockmapSrc = findSourceFile(distDir, version, blockmapDest);
        if (blockmapSrc) {
          fs.copyFileSync(blockmapSrc, path.join(path.resolve(outDir), blockmapDest));
          staged.add(blockmapDest);
          console.log(`  ${path.basename(blockmapSrc)} → ${blockmapDest}`);
        }
      }
    }
  }

  fs.copyFileSync(resolvedYml, path.join(path.resolve(outDir), 'latest-mac.yml'));
  console.log(`Staged ${staged.size} artifacts + latest-mac.yml in ${outDir}`);
}

main();
