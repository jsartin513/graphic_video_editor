/**
 * E2E-only helpers (activated when VIDEO_MERGER_E2E=1). Not used in production builds.
 */

const path = require('path');

function isE2eEnabled() {
  return process.env.VIDEO_MERGER_E2E === '1';
}

function getE2eMoviesDirectory() {
  if (!isE2eEnabled()) return null;
  const dir = process.env.VIDEO_MERGER_E2E_MOVIES_DIR;
  return typeof dir === 'string' && dir.trim() ? path.resolve(dir.trim()) : null;
}

function getE2eRemovablePathPrefix() {
  if (!isE2eEnabled()) return null;
  const prefix = process.env.VIDEO_MERGER_E2E_REMOVABLE_PREFIX;
  return typeof prefix === 'string' && prefix.trim() ? path.resolve(prefix.trim()) : null;
}

function getE2eVolumeLabel() {
  if (!isE2eEnabled()) return null;
  const label = process.env.VIDEO_MERGER_E2E_VOLUME_LABEL;
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}

function getE2eOutputPickerDirectory() {
  if (!isE2eEnabled()) return null;
  const dir = process.env.VIDEO_MERGER_E2E_OUTPUT_PICKER_DIR;
  return typeof dir === 'string' && dir.trim() ? path.resolve(dir.trim()) : null;
}

function isE2eRemovableSourcePath(filePath) {
  const prefix = getE2eRemovablePathPrefix();
  if (!prefix || !filePath || typeof filePath !== 'string') return false;
  const normalized = path.resolve(filePath);
  return normalized === prefix || normalized.startsWith(`${prefix}${path.sep}`);
}

function anyE2eRemovableSource(filePaths) {
  if (!isE2eEnabled() || !Array.isArray(filePaths)) return false;
  return filePaths.some((filePath) => isE2eRemovableSourcePath(filePath));
}

module.exports = {
  isE2eEnabled,
  getE2eMoviesDirectory,
  getE2eRemovablePathPrefix,
  getE2eVolumeLabel,
  getE2eOutputPickerDirectory,
  isE2eRemovableSourcePath,
  anyE2eRemovableSource
};
