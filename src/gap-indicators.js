/**
 * Missing-time indicator video library (stored under userData).
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const MAX_GAP_INDICATORS = 8;
const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.mkv']);

function getGapIndicatorsDirectory() {
  return path.join(app.getPath('userData'), 'gap-indicators');
}

/**
 * @param {string} storedFileName
 * @returns {string|null}
 */
function sanitizeStoredFileName(storedFileName) {
  if (typeof storedFileName !== 'string' || !storedFileName.trim()) {
    return null;
  }
  const trimmed = storedFileName.trim();
  const base = path.basename(trimmed);
  if (base !== trimmed) {
    return null;
  }
  if (!ALLOWED_EXTENSIONS.has(path.extname(base).toLowerCase())) {
    return null;
  }
  return base;
}

/**
 * @param {{ storedFileName: string }} indicator
 * @returns {string}
 */
function resolveGapIndicatorPath(indicator) {
  const fileName = sanitizeStoredFileName(indicator?.storedFileName);
  if (!fileName) {
    throw new Error('Invalid indicator file reference.');
  }
  const root = path.resolve(getGapIndicatorsDirectory());
  const resolved = path.resolve(path.join(root, fileName));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid indicator file reference.');
  }
  return resolved;
}

/**
 * @param {object} preferences
 * @returns {Array<{ id: string, name: string, storedFileName: string }>}
 */
function getGapIndicatorsFromPreferences(preferences) {
  const raw = preferences?.gapIndicators;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.id === 'string' && typeof item.storedFileName === 'string')
    .map((item) => ({
      id: item.id,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Indicator',
      storedFileName: item.storedFileName
    }))
    .slice(0, MAX_GAP_INDICATORS);
}

/**
 * @param {object} preferences
 * @param {Array<{ id: string, name: string, storedFileName: string }>} indicators
 */
function withGapIndicators(preferences, indicators) {
  return {
    ...preferences,
    gapIndicators: indicators.slice(0, MAX_GAP_INDICATORS)
  };
}

/**
 * Copy source video into library and return updated preferences.
 * @param {object} preferences
 * @param {string} sourcePath
 * @param {string} [displayName]
 */
async function addGapIndicator(preferences, sourcePath, displayName) {
  if (!sourcePath || typeof sourcePath !== 'string') {
    throw new Error('Invalid indicator video path.');
  }
  const ext = path.extname(sourcePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('Indicator must be MP4, MOV, M4V, or MKV.');
  }

  const existing = getGapIndicatorsFromPreferences(preferences);
  if (existing.length >= MAX_GAP_INDICATORS) {
    throw new Error(`You can save at most ${MAX_GAP_INDICATORS} indicator videos.`);
  }

  const id = crypto.randomUUID();
  const storedFileName = `${id}${ext}`;
  const destDir = getGapIndicatorsDirectory();
  await fs.mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, storedFileName);
  await fs.copyFile(sourcePath, destPath);

  const baseName = path.basename(sourcePath, ext);
  const name = (typeof displayName === 'string' && displayName.trim())
    ? displayName.trim().slice(0, 120)
    : baseName.slice(0, 120) || 'Indicator';

  const entry = { id, name, storedFileName };
  return withGapIndicators(preferences, [entry, ...existing]);
}

/**
 * @param {object} preferences
 * @param {string} id
 */
async function removeGapIndicator(preferences, id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid indicator id.');
  }
  const existing = getGapIndicatorsFromPreferences(preferences);
  const target = existing.find((item) => item.id === id);
  if (!target) {
    return preferences;
  }

  try {
    const destPath = resolveGapIndicatorPath(target);
    await fs.unlink(destPath);
  } catch {
    // Invalid reference or file already missing
  }

  return withGapIndicators(preferences, existing.filter((item) => item.id !== id));
}

/**
 * @param {object} preferences
 * @returns {Promise<Array<{ id: string, name: string, path: string }>>}
 */
async function listGapIndicatorsWithPaths(preferences) {
  const items = getGapIndicatorsFromPreferences(preferences);
  const result = [];
  for (const item of items) {
    let fullPath;
    try {
      fullPath = resolveGapIndicatorPath(item);
    } catch {
      continue;
    }
    try {
      await fs.access(fullPath);
      result.push({ id: item.id, name: item.name, path: fullPath });
    } catch {
      // Skip missing files
    }
  }
  return result;
}

module.exports = {
  MAX_GAP_INDICATORS,
  ALLOWED_EXTENSIONS,
  getGapIndicatorsDirectory,
  getGapIndicatorsFromPreferences,
  withGapIndicators,
  addGapIndicator,
  removeGapIndicator,
  sanitizeStoredFileName,
  resolveGapIndicatorPath,
  listGapIndicatorsWithPaths
};
