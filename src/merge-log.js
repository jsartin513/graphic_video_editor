/**
 * Append-only merge audit log (merge_log.jsonl) next to merged outputs.
 */

const path = require('path');
const fs = require('fs').promises;

const MERGE_LOG_FILENAME = 'merge_log.jsonl';
const MAX_STRING_LENGTH = 2048;
const MAX_FILES = 200;
const MAX_LINE_BYTES = 32 * 1024;

/**
 * Build a merge log entry with timestamp and type.
 * @param {Object} payload
 * @returns {Object}
 */
function createMergeLogEntry(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid merge log entry: expected an object.');
  }

  const entry = {
    type: 'merge',
    timestamp: new Date().toISOString()
  };

  if (typeof payload.sessionId === 'string' && payload.sessionId.trim()) {
    entry.sessionId = payload.sessionId.trim().slice(0, MAX_STRING_LENGTH);
  }

  if (Array.isArray(payload.inputFiles)) {
    entry.inputFiles = payload.inputFiles
      .filter((f) => typeof f === 'string')
      .slice(0, MAX_FILES)
      .map((f) => f.slice(0, MAX_STRING_LENGTH));
  } else {
    entry.inputFiles = [];
  }

  if (typeof payload.outputPath === 'string' && payload.outputPath.trim()) {
    entry.outputPath = payload.outputPath.trim().slice(0, MAX_STRING_LENGTH);
  } else {
    throw new Error('Invalid merge log entry: outputPath is required.');
  }

  if (typeof payload.outputFilename === 'string' && payload.outputFilename.trim()) {
    entry.outputFilename = payload.outputFilename.trim().slice(0, MAX_STRING_LENGTH);
  }

  if (typeof payload.outputDir === 'string' && payload.outputDir.trim()) {
    entry.outputDir = payload.outputDir.trim().slice(0, MAX_STRING_LENGTH);
  }

  if (payload.settings && typeof payload.settings === 'object') {
    const { quality, format, normalizeAudio } = payload.settings;
    entry.settings = {};
    if (typeof quality === 'string') entry.settings.quality = quality.slice(0, 64);
    if (typeof format === 'string') entry.settings.format = format.slice(0, 16);
    if (typeof normalizeAudio === 'boolean') entry.settings.normalizeAudio = normalizeAudio;
  }

  if (payload.naming && typeof payload.naming === 'object') {
    const n = payload.naming;
    entry.naming = {};
    for (const key of ['templateName', 'templatePattern', 'weekCount', 'eventName', 'leagueName', 'weekName', 'dateFormat', 'appliedAt']) {
      if (typeof n[key] === 'string' && n[key].trim()) {
        entry.naming[key] = n[key].trim().slice(0, MAX_STRING_LENGTH);
      }
    }
    if (Object.keys(entry.naming).length === 0) {
      delete entry.naming;
    }
  }

  const line = JSON.stringify(entry);
  if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) {
    throw new Error('Merge log entry too large to write.');
  }

  return entry;
}

/**
 * Build audit entry from merge handler data; optional context supplies sessionId and naming only.
 * @param {Object} params
 * @returns {Object}
 */
function buildMergeLogEntryForCompletedMerge({
  filePaths,
  outputPath,
  qualityOption,
  format,
  normalizeAudio,
  mergeLogContext
}) {
  const ctx = mergeLogContext && typeof mergeLogContext === 'object' ? mergeLogContext : {};
  return createMergeLogEntry({
    sessionId: ctx.sessionId,
    inputFiles: filePaths,
    outputPath,
    outputFilename: path.basename(outputPath),
    outputDir: path.dirname(outputPath),
    settings: {
      quality: typeof qualityOption === 'string' ? qualityOption : 'copy',
      format: typeof format === 'string' ? format : 'mp4',
      normalizeAudio: !!normalizeAudio
    },
    naming: ctx.naming
  });
}

/**
 * Append one JSON line to merge_log.jsonl in outputDir.
 * @param {string} outputDir
 * @param {Object} entry - Sanitized entry object
 * @returns {Promise<{ logPath: string }>}
 */
async function appendMergeLogEntry(outputDir, entry) {
  if (!outputDir || typeof outputDir !== 'string' || !path.isAbsolute(outputDir)) {
    throw new Error('Invalid output directory for merge log.');
  }
  if (!entry || typeof entry !== 'object') {
    throw new Error('Invalid merge log entry.');
  }

  await fs.mkdir(outputDir, { recursive: true });
  const logPath = path.join(outputDir, MERGE_LOG_FILENAME);
  const line = `${JSON.stringify(entry)}\n`;
  if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES + 1) {
    throw new Error('Merge log entry too large to write.');
  }
  await fs.appendFile(logPath, line, 'utf8');
  return { logPath };
}

module.exports = {
  MERGE_LOG_FILENAME,
  createMergeLogEntry,
  buildMergeLogEntryForCompletedMerge,
  appendMergeLogEntry
};
