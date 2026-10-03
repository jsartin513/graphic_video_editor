/**
 * Browser-side session gap helpers (mirrors src/session-gaps.js for merge UI).
 */

const GAP_THRESHOLD_SECONDS = 5;

function parseCreationTimeMs(creationTime) {
  if (typeof creationTime !== 'string' || !creationTime.trim()) return null;
  const ms = Date.parse(creationTime.trim());
  return Number.isFinite(ms) ? ms : null;
}

function compareDirectorySessionId(a, b) {
  const dirCompare = (a.directory || '').localeCompare(b.directory || '');
  if (dirCompare !== 0) return dirCompare;
  return (a.sessionId || '').localeCompare(b.sessionId || '');
}

function orderSessionsByRecordingTime(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  const withTime = sessions.filter((s) => s.creationTimeMs != null && Number.isFinite(s.creationTimeMs));
  const allHaveTime = withTime.length === sessions.length;
  if (allHaveTime) {
    return [...sessions].sort((a, b) => a.creationTimeMs - b.creationTimeMs);
  }
  return [...sessions].sort(compareDirectorySessionId);
}

function computeSessionBoundaries(orderedSessions) {
  const boundaries = [];
  if (!Array.isArray(orderedSessions) || orderedSessions.length < 2) return boundaries;

  for (let i = 0; i < orderedSessions.length - 1; i++) {
    const prev = orderedSessions[i];
    const next = orderedSessions[i + 1];
    const prevStart = prev.creationTimeMs;
    const prevDuration = typeof prev.durationSeconds === 'number' &&
      Number.isFinite(prev.durationSeconds) &&
      prev.durationSeconds >= 0
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

function shouldInsertGapIndicator(boundary, indicatorSelected) {
  if (!indicatorSelected) return false;
  if (!boundary.gapKnown) return true;
  return boundary.gapSeconds > GAP_THRESHOLD_SECONDS;
}

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

function analyzeSessionGaps(sessions) {
  const orderedSessions = orderSessionsByRecordingTime(sessions);
  const boundaries = computeSessionBoundaries(orderedSessions);
  return { orderedSessions, boundaries };
}

function sessionIdRangeToken(orderedSessions) {
  if (!orderedSessions?.length) return '';
  if (orderedSessions.length === 1) return orderedSessions[0].sessionId;
  const first = orderedSessions[0].sessionId;
  const last = orderedSessions[orderedSessions.length - 1].sessionId;
  return `${first}-${last}`;
}

function buildSegmentPlan(orderedGroups, boundaries, indicatorPath) {
  const indicatorSelected = !!indicatorPath;
  const gaps = [];
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    if (shouldInsertGapIndicator(boundary, indicatorSelected)) {
      gaps.push({
        afterSessionIndex: i,
        indicatorPath,
        gapSeconds: boundary.gapSeconds,
        gapKnown: boundary.gapKnown,
        fromSessionId: boundary.fromSessionId,
        toSessionId: boundary.toSessionId
      });
    }
  }
  return {
    sessions: orderedGroups.map((g) => ({ sessionId: g.sessionId, files: g.files })),
    gaps
  };
}

export {
  GAP_THRESHOLD_SECONDS,
  parseCreationTimeMs,
  analyzeSessionGaps,
  shouldInsertGapIndicator,
  formatGapDurationHuman,
  sessionIdRangeToken,
  buildSegmentPlan
};
