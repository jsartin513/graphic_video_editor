#!/usr/bin/env node
/**
 * Merge per-arch latest-mac.yml files from sequential electron-builder runs
 * into one release manifest for electron-updater.
 *
 * Usage: node scripts/merge-latest-mac-yml.js <arm64.yml> <x64.yml> <out.yml>
 */

const fs = require('fs');
const path = require('path');

function parseEntryBlock(lines, startIndex) {
  const entry = {};
  let i = startIndex;
  const first = lines[i].trim();
  const urlMatch = first.match(/^- url:\s*(.+)$/);
  if (!urlMatch) return { entry: null, next: startIndex };
  entry.url = urlMatch[1].trim();
  i += 1;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s+- url:/.test(line)) break;
    if (/^\S/.test(line) && !/^\s+/.test(line)) break;
    const m = line.match(/^\s+(\w+):\s*(.+)$/);
    if (m) entry[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    i += 1;
  }
  return { entry, next: i };
}

function parseLatestMacYml(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const doc = { version: null, files: [], releaseDate: null };
  let inFiles = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('version:')) {
      doc.version = trimmed.slice('version:'.length).trim();
      i += 1;
      continue;
    }
    if (trimmed === 'files:') {
      inFiles = true;
      i += 1;
      continue;
    }
    if (inFiles && /^\s+- url:/.test(line)) {
      const { entry, next } = parseEntryBlock(lines, i);
      if (entry) doc.files.push(entry);
      i = next;
      continue;
    }
    if (trimmed.startsWith('releaseDate:')) {
      doc.releaseDate = trimmed.slice('releaseDate:'.length).trim();
    }
    i += 1;
  }
  return doc;
}

function serializeLatestMacYml(doc) {
  const out = [];
  out.push(`version: ${doc.version}`);
  out.push('files:');
  for (const file of doc.files) {
    out.push(`  - url: ${file.url}`);
    if (file.sha512) out.push(`    sha512: ${file.sha512}`);
    if (file.size) out.push(`    size: ${file.size}`);
  }
  const primary = doc.files[0];
  if (primary) {
    out.push(`path: ${primary.url}`);
    if (primary.sha512) out.push(`sha512: ${primary.sha512}`);
  }
  if (doc.releaseDate) {
    out.push(`releaseDate: ${doc.releaseDate}`);
  }
  return `${out.join('\n')}\n`;
}

function main() {
  const [arm64Path, x64Path, outPath] = process.argv.slice(2);
  if (!arm64Path || !x64Path || !outPath) {
    console.error('Usage: node scripts/merge-latest-mac-yml.js <arm64.yml> <x64.yml> <out.yml>');
    process.exit(1);
  }
  for (const p of [arm64Path, x64Path]) {
    if (!fs.existsSync(p)) {
      console.error(`Missing file: ${p}`);
      process.exit(1);
    }
  }

  const arm64 = parseLatestMacYml(arm64Path);
  const x64 = parseLatestMacYml(x64Path);
  const merged = {
    version: arm64.version || x64.version,
    releaseDate: arm64.releaseDate || x64.releaseDate,
    files: [...arm64.files, ...x64.files]
  };

  if (!merged.version || merged.files.length === 0) {
    console.error('Could not merge latest-mac.yml — no files found.');
    process.exit(1);
  }

  const seen = new Set();
  merged.files = merged.files.filter((f) => {
    if (seen.has(f.url)) return false;
    seen.add(f.url);
    return true;
  });

  fs.writeFileSync(path.resolve(outPath), serializeLatestMacYml(merged));
  console.log(`Wrote ${outPath} (${merged.files.length} file entries, version ${merged.version})`);
}

main();
