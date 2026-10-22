/**
 * Video Grouping Module
 * Groups action-camera clips by session within each directory.
 */

const path = require('path');
const {
  parseCameraFilename,
  extractGoProSessionId
} = require('./camera-filenames');
const { buildDjiGroups } = require('./dji-grouping');

/**
 * Extract session ID from a supported camera filename (GoPro-compatible API).
 * @param {string} filename
 * @returns {string|null}
 */
function extractSessionId(filename) {
  const gopro = extractGoProSessionId(filename);
  if (gopro) return gopro;

  const parsed = parseCameraFilename(filename);
  if (!parsed || parsed.sessionId == null) return null;
  return parsed.sessionId;
}

/**
 * Derive a filename pattern from a camera clip for output suggestions.
 * @param {string} filename
 * @returns {string|null}
 */
function derivePatternFromFilename(filename) {
  const goproSession = extractGoProSessionId(filename);
  if (goproSession) {
    const base = filename.replace(/\.MP4$/i, '');
    const prefix = base.slice(0, -goproSession.length);
    return `${prefix}{sessionId}`;
  }

  const parsed = parseCameraFilename(filename);
  if (!parsed || !parsed.patternPrefix) return null;
  return parsed.patternPrefix;
}

/**
 * @param {string} directory
 * @param {Array<{ filePath: string, sonyIndex: number }>} entries
 */
function buildSonyGroups(directory, entries) {
  const sorted = [...entries].sort((a, b) => a.sonyIndex - b.sonyIndex);
  const groups = [];
  if (sorted.length === 0) return groups;

  let chain = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].sonyIndex === sorted[i - 1].sonyIndex + 1) {
      chain.push(sorted[i]);
    } else {
      const startId = String(chain[0].sonyIndex).padStart(4, '0');
      const endId = String(chain[chain.length - 1].sonyIndex).padStart(4, '0');
      const sessionId = chain.length > 1 ? `${startId}-${endId}` : startId;
      groups.push({
        sessionId,
        directory,
        files: chain.map((e) => e.filePath).sort(),
        cameraVendor: 'sony'
      });
      chain = [sorted[i]];
    }
  }

  const startId = String(chain[0].sonyIndex).padStart(4, '0');
  const endId = String(chain[chain.length - 1].sonyIndex).padStart(4, '0');
  const sessionId = chain.length > 1 ? `${startId}-${endId}` : startId;
  groups.push({
    sessionId,
    directory,
    files: chain.map((e) => e.filePath).sort(),
    cameraVendor: 'sony'
  });

  return groups;
}

/**
 * Analyze and group video files by session ID and directory.
 * @param {string[]} filePaths
 * @returns {Promise<Array>}
 */
async function analyzeAndGroupVideos(filePaths) {
  const groups = new Map();
  const djiByDirectory = new Map();
  const sonyByDirectory = new Map();

  if (!Array.isArray(filePaths)) return [];

  for (const filePath of filePaths) {
    const filename = path.basename(filePath);
    const parsed = parseCameraFilename(filename);
    if (!parsed) continue;

    const directory = path.dirname(filePath);

    if (parsed.needsDjiChain && parsed.djiIndex != null) {
      if (!djiByDirectory.has(directory)) djiByDirectory.set(directory, []);
      djiByDirectory.get(directory).push({
        filePath,
        djiIndex: parsed.djiIndex
      });
      continue;
    }

    if (parsed.vendor === 'sony' && parsed.sonyIndex != null && parsed.sessionId == null) {
      if (!sonyByDirectory.has(directory)) sonyByDirectory.set(directory, []);
      sonyByDirectory.get(directory).push({
        filePath,
        sonyIndex: parsed.sonyIndex
      });
      continue;
    }

    if (!parsed.sessionId) continue;

    const groupKey = `${directory}:${parsed.vendor}:${parsed.sessionId}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sessionId: parsed.sessionId,
        directory,
        files: [],
        cameraVendor: parsed.vendor
      });
    }

    groups.get(groupKey).files.push({ filePath, sortKey: parsed.sortKey });
  }

  const result = [];

  for (const [, groupData] of groups.entries()) {
    const sortedFiles = groupData.files
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((f) => f.filePath);

    result.push({
      sessionId: groupData.sessionId,
      directory: groupData.directory,
      files: sortedFiles,
      cameraVendor: groupData.cameraVendor,
      outputFilename: null
    });
  }

  for (const [directory, entries] of djiByDirectory.entries()) {
    result.push(...(await buildDjiGroups(directory, entries)));
  }

  for (const [directory, entries] of sonyByDirectory.entries()) {
    result.push(...buildSonyGroups(directory, entries));
  }

  assignOutputFilenames(result);

  result.sort((a, b) => {
    const dirCompare = a.directory.localeCompare(b.directory);
    if (dirCompare !== 0) return dirCompare;
    return a.sessionId.localeCompare(b.sessionId);
  });

  return result;
}

/**
 * @param {Array<{ sessionId: string, directory: string, files: string[], outputFilename?: string|null }>} result
 */
function assignOutputFilenames(result) {
  for (const groupData of result) {
    const hasDuplicateSessionId = result.filter(
      (g) => g.sessionId === groupData.sessionId
    ).length > 1;

    let outputFilename = `PROCESSED${groupData.sessionId}.MP4`;
    if (hasDuplicateSessionId) {
      const dirName = path.basename(groupData.directory) || 'root';
      const sanitizedDirName = dirName.replace(/[^a-zA-Z0-9_-]/g, '_');
      outputFilename = `PROCESSED${groupData.sessionId}_${sanitizedDirName}.MP4`;
    }
    groupData.outputFilename = outputFilename;
  }
}

module.exports = {
  extractSessionId,
  derivePatternFromFilename,
  analyzeAndGroupVideos
};
