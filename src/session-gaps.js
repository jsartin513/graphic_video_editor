/**
 * Session gap detection for multi-session merges.
 * Orders sessions by creation time and computes gaps between consecutive sessions.
 */

const GAP_THRESHOLD_SECONDS = 5;

/**
 * Parse ffprobe creation_time (ISO 8601) to epoch ms, or null if invalid.
 * @param {string|undefined|null} creationTime
 * @returns {number|null}
 */
function parseCreationTimeMs(creationTime) {
  if (typeof creationTime !== 'string' || !creationTime.trim()) return null;
  const ms = Date.parse(creationTime.trim());
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Compare sessions for stable fallback order (directory, then sessionId).
 * @param {{ directory: string, sessionId: string }} a
 * @param {{ directory: string, sessionId: string }} b
 */
function compareDirectorySessionId(a, b) {
  const dirCompare = (a.directory || '').localeCompare(b.directory || '');
  if (dirCompare !== 0) return dirCompare;
  return (a.sessionId || '').localeCompare(b.sessionId || '');
}

/**
 * Order sessions by first-clip creation time when available; otherwise directory + sessionId.
 * @param {Array<{ sessionId: string, directory: string, creationTimeMs?: number|null }>} sessions
 * @returns {Array<{ sessionId: string, directory: string, creationTimeMs?: number|null }>}
 */
function orderSessionsByRecordingTime(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const withTime = sessions.filter((s) => s.creationTimeMs != null && Number.isFinite(s.creationTimeMs));
  const allHaveTime = withTime.length === sessions.length;

  if (allHaveTime) {
    return [...sessions].sort((a, b) => a.creationTimeMs - b.creationTimeMs);
  }

  return [...sessions].sort(compareDirectorySessionId);
}

/**
 * @param {number} gapSeconds
 * @returns {string}
 */
function formatGapDurationHuman(gapSeconds) {
  if (!Number.isFinite(gapSeconds) || gapSeconds < 0) return 'time unknown';
  const total = Math.round(gapSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} sec`);
  return parts.join(' ');
}

/**
 * Compute boundaries between ordered sessions.
 * @param {Array<{ sessionId: string, directory: string, creationTimeMs?: number|null, durationSeconds?: number }>} orderedSessions
 * @returns {Array<{ fromSessionId: string, toSessionId: string, gapSeconds: number|null, gapKnown: boolean }>}
 */
function computeSessionBoundaries(orderedSessions) {
  const boundaries = [];
  if (!Array.isArray(orderedSessions) || orderedSessions.length < 2) return boundaries;

  for (let i = 0; i < orderedSessions.length - 1; i++) {
    const prev = orderedSessions[i];
    const next = orderedSessions[i + 1];
    const prevStart = prev.creationTimeMs;
    const prevDuration = typeof prev.durationSeconds === 'number' && prev.durationSeconds >= 0
      ? prev.durationSeconds
      : null;
    const nextStart = next.creationTimeMs;

    let gapSeconds = null;
    let gapKnown = false;

    if (
      prevStart != null && Number.isFinite(prevStart) &&
      nextStart != null && Number.isFinite(nextStart) &&
      prevDuration != null
    ) {
      const prevEndMs = prevStart + prevDuration * 1000;
      gapSeconds = (nextStart - prevEndMs) / 1000;
      gapKnown = true;
    }

    boundaries.push({
      fromSessionId: prev.sessionId,
      toSessionId: next.sessionId,
      gapSeconds,
      gapKnown
    });
  }

  return boundaries;
}

/**
 * Whether to insert a gap indicator at this boundary.
 * @param {{ gapSeconds: number|null, gapKnown: boolean }} boundary
 * @param {boolean} indicatorSelected - user chose an indicator (not "none")
 */
function shouldInsertGapIndicator(boundary, indicatorSelected) {
  if (!indicatorSelected) return false;
  if (!boundary.gapKnown) return true;
  return boundary.gapSeconds > GAP_THRESHOLD_SECONDS;
}

/**
 * Build ordered session list + boundaries for UI and merge.
 * @param {Array<{ sessionId: string, directory: string, creationTimeMs?: number|null, durationSeconds?: number, files?: string[] }>} sessions
 * @returns {{ orderedSessions: typeof sessions, boundaries: ReturnType<typeof computeSessionBoundaries> }}
 */
function analyzeSessionGaps(sessions) {
  const orderedSessions = orderSessionsByRecordingTime(sessions);
  const boundaries = computeSessionBoundaries(orderedSessions);
  return { orderedSessions, boundaries };
}

/**
 * Session ID range token for combined output filenames.
 * @param {Array<{ sessionId: string }>} orderedSessions
 */
function sessionIdRangeToken(orderedSessions) {
  if (!orderedSessions?.length) return '';
  if (orderedSessions.length === 1) return orderedSessions[0].sessionId;
  const first = orderedSessions[0].sessionId;
  const last = orderedSessions[orderedSessions.length - 1].sessionId;
  return `${first}-${last}`;
}

module.exports = {
  GAP_THRESHOLD_SECONDS,
  parseCreationTimeMs,
  orderSessionsByRecordingTime,
  computeSessionBoundaries,
  shouldInsertGapIndicator,
  formatGapDurationHuman,
  analyzeSessionGaps,
  sessionIdRangeToken
};
