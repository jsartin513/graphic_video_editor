/**
 * DJI split-clip grouping via ffprobe creation time + duration.
 * Matches contiguous segments from one recording (see DJIConcat-style chaining).
 */

const fs = require('fs');
const { spawn } = require('child_process');
const { getFFprobePath } = require('./ffmpeg-resolver');
const { parseCreationTimeMs } = require('./session-gaps');
const { DJI_SPLIT_SIZE_BYTES } = require('./camera-filenames');

const TIMING_TOLERANCE_SEC = 1;

/**
 * @param {string} creationTime
 * @param {number} durationSec
 * @returns {number|null}
 */
function endTimestampSec(creationTime, durationSec) {
  const startMs = parseCreationTimeMs(creationTime);
  if (startMs == null || !Number.isFinite(durationSec)) return null;
  return Math.ceil(startMs / 1000 + durationSec);
}

/**
 * @param {string} creationTime
 * @returns {number|null}
 */
function startTimestampSec(creationTime) {
  const ms = parseCreationTimeMs(creationTime);
  return ms != null ? ms / 1000 : null;
}

/**
 * @param {Array<{ filePath: string, djiIndex: number }>} chain
 * @param {string} directory
 */
function makeDjiGroup(chain, directory) {
  const startId = String(chain[0].djiIndex).padStart(4, '0');
  const endId = String(chain[chain.length - 1].djiIndex).padStart(4, '0');
  const sessionId = chain.length > 1 ? `${startId}-${endId}` : startId;
  return {
    sessionId,
    directory,
    files: chain.map((e) => e.filePath).sort(),
    cameraVendor: 'dji',
    outputFilename: null
  };
}

/**
 * Pure DJI chain builder (testable without ffprobe).
 * @param {string} directory
 * @param {Array<{ filePath: string, djiIndex: number }>} entries
 * @param {Record<string, { creation: string, duration: number }>} timings
 * @param {Record<string, number>} sizes
 */
function chainDjiEntries(directory, entries, timings, sizes) {
  const sorted = [...entries].sort((a, b) => a.djiIndex - b.djiIndex);
  const usedPaths = new Set();
  const groups = [];
  const continuationHeads = new Set();

  const largeEntries = sorted.filter(
    (e) => (sizes[e.filePath] ?? 0) >= DJI_SPLIT_SIZE_BYTES
  );

  for (const headEntry of largeEntries) {
    if (continuationHeads.has(headEntry.filePath) || usedPaths.has(headEntry.filePath)) {
      continue;
    }

    const headTiming = timings[headEntry.filePath];
    if (!headTiming) {
      groups.push(makeDjiGroup([headEntry], directory));
      usedPaths.add(headEntry.filePath);
      continue;
    }

    const chain = [headEntry];
    usedPaths.add(headEntry.filePath);
    let endTs = endTimestampSec(headTiming.creation, headTiming.duration);

    const headIdx = sorted.findIndex((e) => e.filePath === headEntry.filePath);
    for (let j = headIdx + 1; j < sorted.length; j += 1) {
      const next = sorted[j];
      const nextTiming = timings[next.filePath];
      if (!nextTiming || endTs == null) break;

      const nextStart = startTimestampSec(nextTiming.creation);
      if (nextStart == null) break;

      if (
        nextStart === endTs ||
        Math.abs(nextStart - endTs) <= TIMING_TOLERANCE_SEC
      ) {
        chain.push(next);
        usedPaths.add(next.filePath);
        if ((sizes[next.filePath] ?? 0) >= DJI_SPLIT_SIZE_BYTES) {
          continuationHeads.add(next.filePath);
        }
        endTs = endTimestampSec(nextTiming.creation, nextTiming.duration);
      } else {
        break;
      }
    }

    groups.push(makeDjiGroup(chain, directory));
  }

  for (const entry of sorted) {
    if (!usedPaths.has(entry.filePath)) {
      groups.push(makeDjiGroup([entry], directory));
      usedPaths.add(entry.filePath);
    }
  }

  return groups;
}

/**
 * @param {string} filePath
 * @returns {Promise<{ creation: string, duration: number }|null>}
 */
function probeVideoCreationAndDuration(filePath) {
  const ffprobeCmd = getFFprobePath();
  const env = { ...process.env };
  if (ffprobeCmd.includes('.app/Contents/Resources')) {
    env.PATH = '/usr/bin:/bin';
  } else {
    env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
  }

  return new Promise((resolve) => {
    const ffprobe = spawn(
      ffprobeCmd,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream_tags=creation_time:format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath
      ],
      { env }
    );

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    ffprobe.on('error', () => resolve(null));
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const lines = output
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        resolve(null);
        return;
      }
      const creation = lines[0];
      const duration = parseFloat(lines[1]);
      if (!creation || !Number.isFinite(duration)) {
        resolve(null);
        return;
      }
      resolve({ creation, duration });
    });
  });
}

/**
 * @param {string} directory
 * @param {Array<{ filePath: string, djiIndex: number }>} entries
 * @param {(filePath: string) => Promise<{ creation: string, duration: number }|null>} [probeFn]
 */
async function buildDjiGroups(directory, entries, probeFn = probeVideoCreationAndDuration) {
  const timings = {};
  const sizes = {};

  await Promise.all(
    entries.map(async (entry) => {
      try {
        sizes[entry.filePath] = fs.statSync(entry.filePath).size;
      } catch {
        sizes[entry.filePath] = 0;
      }
      const timing = await probeFn(entry.filePath);
      if (timing) {
        timings[entry.filePath] = timing;
      }
    })
  );

  return chainDjiEntries(directory, entries, timings, sizes);
}

module.exports = {
  TIMING_TOLERANCE_SEC,
  DJI_SPLIT_SIZE_BYTES,
  endTimestampSec,
  chainDjiEntries,
  probeVideoCreationAndDuration,
  buildDjiGroups
};
