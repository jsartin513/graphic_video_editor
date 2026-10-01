const {
  parseCreationTimeMs,
  orderSessionsByRecordingTime,
  computeSessionBoundaries,
  shouldInsertGapIndicator,
  formatGapDurationHuman,
  analyzeSessionGaps,
  sessionIdRangeToken,
  GAP_THRESHOLD_SECONDS
} = require('../src/session-gaps');

describe('session-gaps', () => {
  describe('parseCreationTimeMs', () => {
    test('parses ISO creation time', () => {
      const ms = parseCreationTimeMs('2026-03-15T10:00:00.000000Z');
      expect(ms).toBe(Date.parse('2026-03-15T10:00:00.000000Z'));
    });

    test('returns null for invalid input', () => {
      expect(parseCreationTimeMs(null)).toBeNull();
      expect(parseCreationTimeMs('')).toBeNull();
      expect(parseCreationTimeMs('not-a-date')).toBeNull();
    });
  });

  describe('orderSessionsByRecordingTime', () => {
    test('orders by creation time when all sessions have timestamps', () => {
      const sessions = [
        { sessionId: '0002', directory: '/a', creationTimeMs: 2000 },
        { sessionId: '0001', directory: '/a', creationTimeMs: 1000 }
      ];
      const ordered = orderSessionsByRecordingTime(sessions);
      expect(ordered.map((s) => s.sessionId)).toEqual(['0001', '0002']);
    });

    test('falls back to directory then sessionId when any timestamp missing', () => {
      const sessions = [
        { sessionId: '0002', directory: '/b', creationTimeMs: 1000 },
        { sessionId: '0001', directory: '/a', creationTimeMs: null }
      ];
      const ordered = orderSessionsByRecordingTime(sessions);
      expect(ordered.map((s) => s.sessionId)).toEqual(['0001', '0002']);
    });
  });

  describe('computeSessionBoundaries', () => {
    test('computes gap between session end and next start', () => {
      const ordered = [
        { sessionId: '0534', creationTimeMs: 0, durationSeconds: 600 },
        { sessionId: '0535', creationTimeMs: 970000, durationSeconds: 300 }
      ];
      const boundaries = computeSessionBoundaries(ordered);
      expect(boundaries).toHaveLength(1);
      expect(boundaries[0].gapKnown).toBe(true);
      expect(boundaries[0].gapSeconds).toBe(370);
      expect(boundaries[0].fromSessionId).toBe('0534');
      expect(boundaries[0].toSessionId).toBe('0535');
    });

    test('marks unknown when previous session duration is missing', () => {
      const ordered = [
        { sessionId: '0534', creationTimeMs: 0, durationSeconds: null },
        { sessionId: '0535', creationTimeMs: 1000, durationSeconds: 300 }
      ];
      const boundaries = computeSessionBoundaries(ordered);
      expect(boundaries[0].gapKnown).toBe(false);
    });

    test('marks unknown when creation time missing', () => {
      const ordered = [
        { sessionId: '0534', creationTimeMs: null, durationSeconds: 600 },
        { sessionId: '0535', creationTimeMs: 1000, durationSeconds: 300 }
      ];
      const boundaries = computeSessionBoundaries(ordered);
      expect(boundaries[0].gapKnown).toBe(false);
      expect(boundaries[0].gapSeconds).toBeNull();
    });
  });

  describe('shouldInsertGapIndicator', () => {
    test('does not insert when no indicator selected', () => {
      expect(shouldInsertGapIndicator({ gapKnown: true, gapSeconds: 100 }, false)).toBe(false);
    });

    test('inserts when gap exceeds threshold', () => {
      expect(shouldInsertGapIndicator({ gapKnown: true, gapSeconds: GAP_THRESHOLD_SECONDS + 1 }, true)).toBe(true);
    });

    test('does not insert when gap at or below threshold', () => {
      expect(shouldInsertGapIndicator({ gapKnown: true, gapSeconds: GAP_THRESHOLD_SECONDS }, true)).toBe(false);
      expect(shouldInsertGapIndicator({ gapKnown: true, gapSeconds: 2 }, true)).toBe(false);
    });

    test('inserts when time unknown and indicator selected', () => {
      expect(shouldInsertGapIndicator({ gapKnown: false, gapSeconds: null }, true)).toBe(true);
    });
  });

  describe('formatGapDurationHuman', () => {
    test('formats minutes and seconds', () => {
      expect(formatGapDurationHuman(370)).toContain('6 min');
      expect(formatGapDurationHuman(370)).toContain('10 sec');
    });
  });

  describe('analyzeSessionGaps', () => {
    test('returns ordered sessions and boundaries', () => {
      const { orderedSessions, boundaries } = analyzeSessionGaps([
        { sessionId: '0002', directory: '/x', creationTimeMs: 5000, durationSeconds: 10 },
        { sessionId: '0001', directory: '/x', creationTimeMs: 0, durationSeconds: 10 }
      ]);
      expect(orderedSessions[0].sessionId).toBe('0001');
      expect(boundaries.length).toBe(1);
    });
  });

  describe('sessionIdRangeToken', () => {
    test('single session returns id', () => {
      expect(sessionIdRangeToken([{ sessionId: '0534' }])).toBe('0534');
    });

    test('multiple sessions returns range', () => {
      expect(sessionIdRangeToken([{ sessionId: '0534' }, { sessionId: '0536' }])).toBe('0534-0536');
    });
  });
});
