/**
 * Default merge filename patterns and PROCESSED placeholder detection.
 */

const GENERIC_FILENAME_PATTERN = '{date} {sessionId}';

const PROCESSED_PLACEHOLDER_RE = /^PROCESSED\d{4}/i;

/**
 * Pattern to use when auto-naming merged outputs.
 * @param {Object|null|undefined} preferences
 * @returns {string}
 */
function chooseDefaultFilenamePattern(preferences) {
  const last = preferences?.lastUsedPattern;
  if (typeof last === 'string' && last.trim()) {
    return last.trim();
  }
  return GENERIC_FILENAME_PATTERN;
}

/**
 * @param {string} name - Filename with or without extension
 * @returns {boolean}
 */
function isProcessedPlaceholderFilename(name) {
  if (!name || typeof name !== 'string') return false;
  const base = name.replace(/\.(mp4|mov|mkv|avi|m4v)$/i, '').trim();
  return PROCESSED_PLACEHOLDER_RE.test(base);
}

/**
 * Suffix when the same session ID appears in multiple folders (matches video-grouping behavior).
 * @param {{ sessionId: string, directory?: string }} group
 * @param {Array<{ sessionId: string, directory?: string }>} allGroups
 * @returns {string} e.g. "_court1" or ""
 */
function directorySuffixForGroup(group, allGroups) {
  if (!group || !Array.isArray(allGroups)) return '';
  const duplicateCount = allGroups.filter((g) => g.sessionId === group.sessionId).length;
  if (duplicateCount <= 1) return '';

  let dirName = 'root';
  if (group.directory) {
    const parts = group.directory.split(/[/\\]/).filter(Boolean);
    dirName = parts.length > 0 ? parts[parts.length - 1] : 'root';
  }
  const sanitized = dirName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `_${sanitized}`;
}

module.exports = {
  GENERIC_FILENAME_PATTERN,
  PROCESSED_PLACEHOLDER_RE,
  chooseDefaultFilenamePattern,
  isProcessedPlaceholderFilename,
  directorySuffixForGroup
};
