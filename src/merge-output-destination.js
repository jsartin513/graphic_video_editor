/**
 * Merge output path helpers (SD card → ~/Movies, recording-date folder names).
 */

const path = require('path');
const { sanitizeFilenameForOutput } = require('./filename-sanitize');
const { formatDate } = require('./preferences');

const DEFAULT_VOLUMES_ROOT = '/Volumes';

function normalizeAbsolutePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  return path.resolve(filePath).replace(/\\/g, '/');
}

function normalizeRoot(rootPath) {
  if (!rootPath || typeof rootPath !== 'string') return '';
  return normalizeAbsolutePath(rootPath).replace(/\/$/, '');
}

/**
 * @param {string} filePath
 * @param {string} [volumesRoot]
 * @returns {string|null}
 */
function extractVolumeNameFromPath(filePath, volumesRoot = DEFAULT_VOLUMES_ROOT) {
  const normalized = normalizeAbsolutePath(filePath);
  const root = normalizeRoot(volumesRoot);
  if (!root) return null;
  const prefix = `${root}/`;
  if (!normalized.startsWith(prefix)) return null;
  const rest = normalized.slice(prefix.length);
  const segment = rest.split('/')[0];
  return segment || null;
}

/**
 * True when the path lives on a removable mount (e.g. /Volumes/...) or under a known SD root.
 * @param {string} filePath
 * @param {Object} [options]
 * @param {string} [options.volumesRoot]
 * @param {string} [options.platform]
 * @param {string[]} [options.knownRemovableRoots]
 * @returns {boolean}
 */
function isPathOnRemovableVolume(filePath, options = {}) {
  const {
    volumesRoot = DEFAULT_VOLUMES_ROOT,
    platform = process.platform,
    knownRemovableRoots = []
  } = options;

  if (!filePath || typeof filePath !== 'string') return false;

  const normalized = normalizeAbsolutePath(filePath);

  if (platform === 'darwin') {
    const root = normalizeRoot(volumesRoot);
    if (root && (normalized === root || normalized.startsWith(`${root}/`))) {
      return true;
    }
  }

  for (const root of knownRemovableRoots) {
    if (typeof root !== 'string' || !root.trim()) continue;
    const rootNorm = normalizeRoot(root);
    if (!rootNorm) continue;
    if (normalized === rootNorm || normalized.startsWith(`${rootNorm}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {string[]} filePaths
 * @param {Object} [options]
 * @returns {boolean}
 */
function anySourceOnRemovableVolume(filePaths, options = {}) {
  if (!Array.isArray(filePaths)) return false;
  return filePaths.some((filePath) => isPathOnRemovableVolume(filePath, options));
}

/**
 * Default folder name from clip recording times (reusable for #171-style "recent day" defaults).
 * Uses the calendar date of the latest known creation time, or today when unknown.
 * @param {Array<number|null|undefined>} creationTimesMs
 * @param {string} [dateFormat]
 * @returns {string}
 */
function deriveRecordingDateFolderName(creationTimesMs, dateFormat = 'YYYY-MM-DD') {
  const valid = (Array.isArray(creationTimesMs) ? creationTimesMs : [])
    .filter((value) => value != null && Number.isFinite(value));
  const referenceDate = valid.length > 0
    ? new Date(Math.max(...valid))
    : new Date();
  return formatDate(referenceDate, dateFormat);
}

/**
 * @param {string} name
 * @returns {string}
 */
function sanitizeFolderName(name) {
  return sanitizeFilenameForOutput(name);
}

/**
 * Pick a child directory name under parentDir that does not exist yet.
 * @param {string} parentDir
 * @param {string} folderName
 * @param {(fullPath: string) => boolean} pathExists
 * @returns {{ dirPath: string, folderName: string }}
 */
function resolveUniqueDirectoryPath(parentDir, folderName, pathExists) {
  if (typeof pathExists !== 'function') {
    throw new Error('pathExists callback is required');
  }
  const base = sanitizeFolderName(folderName);
  if (!base) {
    throw new Error('Folder name is required');
  }

  let candidate = base;
  let counter = 2;
  while (pathExists(path.join(parentDir, candidate))) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return {
    dirPath: path.join(parentDir, candidate),
    folderName: candidate
  };
}

/**
 * @param {string} folderName
 * @param {string|null} volumeName
 * @returns {string}
 */
function buildDefaultMoviesFolderName(folderName, volumeName = null) {
  const sanitized = sanitizeFolderName(folderName);
  if (!volumeName) return sanitized;
  const vol = sanitizeFolderName(volumeName);
  if (!vol) return sanitized;
  return sanitizeFolderName(`${sanitized} ${vol}`);
}

/** @typedef {'user-picker' | 'movies-modal'} OutputDestinationSelectionSource */

/**
 * Only folders chosen via the output picker should be stored in lastOutputDestination.
 * Auto-created Movies folders from the SD-card prompt are session-only.
 * @param {OutputDestinationSelectionSource} source
 * @returns {boolean}
 */
function shouldPersistLastOutputDestination(source) {
  return source === 'user-picker';
}

module.exports = {
  DEFAULT_VOLUMES_ROOT,
  normalizeAbsolutePath,
  extractVolumeNameFromPath,
  isPathOnRemovableVolume,
  anySourceOnRemovableVolume,
  deriveRecordingDateFolderName,
  sanitizeFolderName,
  resolveUniqueDirectoryPath,
  buildDefaultMoviesFolderName,
  shouldPersistLastOutputDestination
};
