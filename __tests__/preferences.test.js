const {
  addRecentPattern,
  setPreferredDateFormat,
  formatDate,
  applyDateTokens,
  addFailedOperation,
  removeFailedOperation,
  getFailedOperations,
  clearFailedOperations,
  DEFAULT_PREFERENCES
} = require('../src/preferences');

describe('addRecentPattern', () => {
  test('adds pattern to empty list', () => {
    const prefs = { ...DEFAULT_PREFERENCES, recentFilenamePatterns: [] };
    const result = addRecentPattern(prefs, 'MyVideo_{date}');
    
    expect(result.recentFilenamePatterns).toEqual(['MyVideo_{date}']);
    expect(result.lastUsedPattern).toBe('MyVideo_{date}');
  });

  test('adds pattern to existing list', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      recentFilenamePatterns: ['Pattern1', 'Pattern2']
    };
    const result = addRecentPattern(prefs, 'Pattern3');
    
    expect(result.recentFilenamePatterns).toEqual(['Pattern3', 'Pattern1', 'Pattern2']);
  });

  test('moves existing pattern to front', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      recentFilenamePatterns: ['Pattern1', 'Pattern2', 'Pattern3']
    };
    const result = addRecentPattern(prefs, 'Pattern2');
    
    expect(result.recentFilenamePatterns).toEqual(['Pattern2', 'Pattern1', 'Pattern3']);
  });

  test('limits number of patterns', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      maxRecentPatterns: 3,
      recentFilenamePatterns: ['P1', 'P2', 'P3']
    };
    const result = addRecentPattern(prefs, 'P4');
    
    expect(result.recentFilenamePatterns).toEqual(['P4', 'P1', 'P2']);
    expect(result.recentFilenamePatterns.length).toBe(3);
  });

  test('ignores empty or invalid patterns', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      recentFilenamePatterns: ['Pattern1']
    };
    
    const result1 = addRecentPattern(prefs, '');
    expect(result1.recentFilenamePatterns).toEqual(['Pattern1']);
    
    const result2 = addRecentPattern(prefs, null);
    expect(result2.recentFilenamePatterns).toEqual(['Pattern1']);
  });
});

describe('setPreferredDateFormat', () => {
  test('sets date format', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = setPreferredDateFormat(prefs, 'MM-DD-YYYY');
    
    expect(result.preferredDateFormat).toBe('MM-DD-YYYY');
  });

  test('preserves other preferences', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      recentFilenamePatterns: ['Pattern1']
    };
    const result = setPreferredDateFormat(prefs, 'DD-MM-YYYY');
    
    expect(result.preferredDateFormat).toBe('DD-MM-YYYY');
    expect(result.recentFilenamePatterns).toEqual(['Pattern1']);
  });
});

describe('formatDate', () => {
  test('formats date with YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    const result = formatDate(date, 'YYYY-MM-DD');
    expect(result).toBe('2024-01-15');
  });

  test('formats date with MM-DD-YYYY', () => {
    const date = new Date(2024, 0, 15);
    const result = formatDate(date, 'MM-DD-YYYY');
    expect(result).toBe('01-15-2024');
  });

  test('formats date with DD-MM-YYYY', () => {
    const date = new Date(2024, 0, 15);
    const result = formatDate(date, 'DD-MM-YYYY');
    expect(result).toBe('15-01-2024');
  });

  test('formats date with YYYYMMDD', () => {
    const date = new Date(2024, 0, 15);
    const result = formatDate(date, 'YYYYMMDD');
    expect(result).toBe('20240115');
  });

  test('formats date with YY for 2-digit year', () => {
    const date = new Date(2024, 0, 15);
    const result = formatDate(date, 'YY-MM-DD');
    expect(result).toBe('24-01-15');
  });

  test('formats date without padding (M, D)', () => {
    const date = new Date(2024, 0, 5); // Jan 5
    const result = formatDate(date, 'YYYY-M-D');
    expect(result).toBe('2024-1-5');
  });

  test('handles single-digit months and days with padding', () => {
    const date = new Date(2024, 0, 5); // Jan 5
    const result = formatDate(date, 'YYYY-MM-DD');
    expect(result).toBe('2024-01-05');
  });
});

describe('applyDateTokens', () => {
  test('replaces {date} token', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Video_{date}', date, 'YYYY-MM-DD');
    expect(result).toBe('Video_2024-01-15');
  });

  test('replaces {year} token', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Video_{year}', date);
    expect(result).toBe('Video_2024');
  });

  test('replaces {month} token', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Video_{month}', date);
    expect(result).toBe('Video_01');
  });

  test('replaces {day} token', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Video_{day}', date);
    expect(result).toBe('Video_15');
  });

  test('replaces multiple tokens', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Video_{year}_{month}_{day}', date);
    expect(result).toBe('Video_2024_01_15');
  });

  test('uses different date formats', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Video_{date}', date, 'MM-DD-YYYY');
    expect(result).toBe('Video_01-15-2024');
  });

  test('is case insensitive for tokens', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Video_{DATE}_{YEAR}', date, 'YYYY-MM-DD');
    expect(result).toBe('Video_2024-01-15_2024');
  });

  test('uses current date when no date provided', () => {
    const result = applyDateTokens('Video_{year}');
    const currentYear = new Date().getFullYear();
    expect(result).toBe(`Video_${currentYear}`);
  });

  test('returns pattern unchanged if no tokens', () => {
    const result = applyDateTokens('MyVideo');
    expect(result).toBe('MyVideo');
  });

  test('handles empty pattern', () => {
    const result = applyDateTokens('');
    expect(result).toBe('');
  });

  test('handles null pattern', () => {
    const result = applyDateTokens(null);
    expect(result).toBeNull();
  });
});

describe('addFailedOperation', () => {
  const basePrefs = { ...DEFAULT_PREFERENCES };
  const op1 = {
    sessionId: 'session-1',
    outputPath: '/tmp/out.mp4',
    files: ['/tmp/a.mp4', '/tmp/b.mp4'],
    error: 'Merge failed',
    timestamp: 1000
  };

  test('adds a new failed operation', () => {
    const result = addFailedOperation(basePrefs, op1);
    expect(result.failedOperations).toHaveLength(1);
    expect(result.failedOperations[0].sessionId).toBe('session-1');
    expect(result.failedOperations[0].retryCount).toBe(0);
  });

  test('does not mutate the original preferences object', () => {
    const prefs = { ...basePrefs, failedOperations: [op1] };
    const original = [...prefs.failedOperations];
    addFailedOperation(prefs, { ...op1, sessionId: 'session-2' });
    expect(prefs.failedOperations).toEqual(original);
  });

  test('deduplicates by sessionId + outputPath and increments retryCount', () => {
    const prefs = addFailedOperation(basePrefs, op1);
    const result = addFailedOperation(prefs, { ...op1, error: 'Second failure' });
    expect(result.failedOperations).toHaveLength(1);
    expect(result.failedOperations[0].retryCount).toBe(1);
    expect(result.failedOperations[0].error).toBe('Second failure');
  });

  test('keeps entries from different sessionId as separate records', () => {
    const prefs = addFailedOperation(basePrefs, op1);
    const result = addFailedOperation(prefs, { ...op1, sessionId: 'session-2' });
    expect(result.failedOperations).toHaveLength(2);
  });

  test('ignores operation without sessionId', () => {
    const result = addFailedOperation(basePrefs, { outputPath: '/tmp/out.mp4' });
    expect(result).toBe(basePrefs);
  });

  test('enforces max history of 50 entries', () => {
    let prefs = { ...basePrefs };
    for (let i = 0; i < 55; i++) {
      prefs = addFailedOperation(prefs, {
        sessionId: `session-${i}`,
        outputPath: `/tmp/out${i}.mp4`,
        files: [],
        error: 'err',
        timestamp: i
      });
    }
    expect(prefs.failedOperations.length).toBeLessThanOrEqual(50);
  });
});

describe('removeFailedOperation', () => {
  const op1 = {
    sessionId: 'session-1',
    outputPath: '/tmp/out.mp4',
    files: [],
    error: 'err',
    timestamp: 1000,
    retryCount: 0
  };
  const op2 = {
    sessionId: 'session-2',
    outputPath: '/tmp/out2.mp4',
    files: [],
    error: 'err',
    timestamp: 2000,
    retryCount: 0
  };

  test('removes the matching operation', () => {
    const prefs = { ...DEFAULT_PREFERENCES, failedOperations: [op1, op2] };
    const result = removeFailedOperation(prefs, 'session-1', '/tmp/out.mp4');
    expect(result.failedOperations).toHaveLength(1);
    expect(result.failedOperations[0].sessionId).toBe('session-2');
  });

  test('does nothing when operation not found', () => {
    const prefs = { ...DEFAULT_PREFERENCES, failedOperations: [op1] };
    const result = removeFailedOperation(prefs, 'nonexistent', '/tmp/out.mp4');
    expect(result.failedOperations).toHaveLength(1);
  });

  test('handles empty failedOperations', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = removeFailedOperation(prefs, 'session-1', '/tmp/out.mp4');
    expect(result.failedOperations).toEqual([]);
  });
});

describe('getFailedOperations', () => {
  test('returns the failedOperations array', () => {
    const op = { sessionId: 's1', outputPath: '/tmp/out.mp4', files: [], error: 'err', timestamp: 1, retryCount: 0 };
    const prefs = { ...DEFAULT_PREFERENCES, failedOperations: [op] };
    expect(getFailedOperations(prefs)).toEqual([op]);
  });

  test('returns empty array when not set', () => {
    expect(getFailedOperations({ ...DEFAULT_PREFERENCES })).toEqual([]);
  });
});

describe('clearFailedOperations', () => {
  test('clears all failed operations', () => {
    const op = { sessionId: 's1', outputPath: '/tmp/out.mp4', files: [], error: 'err', timestamp: 1, retryCount: 0 };
    const prefs = { ...DEFAULT_PREFERENCES, failedOperations: [op] };
    const result = clearFailedOperations(prefs);
    expect(result.failedOperations).toEqual([]);
  });
});
