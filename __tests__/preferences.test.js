jest.mock('../src/logger', () => ({ logger: { error: jest.fn() } }));

const fs = require('fs').promises;
const path = require('path');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn()
    }
  };
});

const {
  addRecentPattern,
  setPreferredDateFormat,
  formatDate,
  applyDateTokens,
  sanitizeFailedOperation,
  addFailedOperation,
  removeFailedOperation,
  getFailedOperations,
  clearFailedOperations,
  loadPreferences,
  savePreferences,
  setPreferredQuality,
  setPreferredFormat,
  setLastOutputDestination,
  setAutoDetectSDCards,
  setShowSDCardNotifications,
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

describe('loadPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns merged preferences when file exists', async () => {
    const stored = { preferredDateFormat: 'MM-DD-YYYY', recentFilenamePatterns: ['P1'] };
    fs.readFile.mockResolvedValue(JSON.stringify(stored));

    const result = await loadPreferences();

    expect(result.preferredDateFormat).toBe('MM-DD-YYYY');
    expect(result.recentFilenamePatterns).toEqual(['P1']);
    expect(result.preferredQuality).toBe('copy'); // from defaults
  });

  test('returns defaults when file does not exist (ENOENT)', async () => {
    const err = new Error('not found');
    err.code = 'ENOENT';
    fs.readFile.mockRejectedValue(err);

    const result = await loadPreferences();

    expect(result).toEqual({ ...DEFAULT_PREFERENCES });
  });

  test('returns defaults on parse error', async () => {
    fs.readFile.mockResolvedValue('invalid json {{{');

    const result = await loadPreferences();

    expect(result).toEqual({ ...DEFAULT_PREFERENCES });
  });
});

describe('savePreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
  });

  test('creates directory and writes preferences', async () => {
    const prefs = { ...DEFAULT_PREFERENCES, preferredDateFormat: 'YYYY-MM-DD' };

    await savePreferences(prefs);

    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    const [filePath, content] = fs.writeFile.mock.calls[0];
    expect(JSON.parse(content).preferredDateFormat).toBe('YYYY-MM-DD');
  });

  test('throws on write error', async () => {
    fs.writeFile.mockRejectedValue(new Error('write failed'));

    await expect(savePreferences(DEFAULT_PREFERENCES)).rejects.toThrow('write failed');
  });
});

describe('setPreferredQuality', () => {
  test('sets preferred quality', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = setPreferredQuality(prefs, 'high');
    expect(result.preferredQuality).toBe('high');
  });
});

describe('setPreferredFormat', () => {
  test('sets preferred format', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = setPreferredFormat(prefs, 'mov');
    expect(result.preferredFormat).toBe('mov');
  });
});

describe('setLastOutputDestination', () => {
  test('sets last output destination', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = setLastOutputDestination(prefs, '/tmp/output');
    expect(result.lastOutputDestination).toBe('/tmp/output');
  });

  test('sets null for default destination', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = setLastOutputDestination(prefs, null);
    expect(result.lastOutputDestination).toBeNull();
  });
});

describe('setAutoDetectSDCards', () => {
  test('sets auto-detect preference', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = setAutoDetectSDCards(prefs, false);
    expect(result.autoDetectSDCards).toBe(false);
  });
});

describe('setShowSDCardNotifications', () => {
  test('sets show SD card notifications', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const result = setShowSDCardNotifications(prefs, false);
    expect(result.showSDCardNotifications).toBe(false);
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

describe('sanitizeFailedOperation', () => {
  const validOp = {
    sessionId: 'session-1',
    outputPath: '/tmp/out.mp4',
    files: ['/tmp/a.mp4'],
    error: 'Merge failed',
    timestamp: 1000
  };

  test('returns sanitized operation for valid input', () => {
    const result = sanitizeFailedOperation(validOp);
    expect(result.sessionId).toBe('session-1');
    expect(result.outputPath).toBe('/tmp/out.mp4');
    expect(result.files).toEqual(['/tmp/a.mp4']);
    expect(result.error).toBe('Merge failed');
    expect(result.timestamp).toBe(1000);
  });

  test('throws for null or non-object', () => {
    expect(() => sanitizeFailedOperation(null)).toThrow('Invalid failed operation: expected an object.');
    expect(() => sanitizeFailedOperation(undefined)).toThrow('Invalid failed operation: expected an object.');
    expect(() => sanitizeFailedOperation('string')).toThrow('Invalid failed operation: expected an object.');
  });

  test('throws for missing sessionId', () => {
    expect(() => sanitizeFailedOperation({ outputPath: '/tmp/out.mp4' })).toThrow('Invalid failed operation: missing sessionId.');
    expect(() => sanitizeFailedOperation({ sessionId: '', outputPath: '/tmp/out.mp4' })).toThrow('Invalid failed operation: missing sessionId.');
  });

  test('throws for missing outputPath', () => {
    expect(() => sanitizeFailedOperation({ sessionId: 's1' })).toThrow('Invalid failed operation: missing outputPath.');
  });

  test('trims and truncates long strings', () => {
    const long = 'a'.repeat(2000);
    const result = sanitizeFailedOperation({
      sessionId: '  s1  ',
      outputPath: '/path',
      error: long
    });
    expect(result.sessionId).toBe('s1');
    expect(result.error).toHaveLength(1024);
  });

  test('filters non-string files and limits count', () => {
    const files = Array(150).fill('/tmp/a.mp4');
    const result = sanitizeFailedOperation({ sessionId: 's1', outputPath: '/out', files });
    expect(result.files).toHaveLength(100);
  });

  test('uses default timestamp when not provided or invalid', () => {
    const before = Date.now();
    const result = sanitizeFailedOperation({ sessionId: 's1', outputPath: '/out' });
    const after = Date.now();
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  test('handles empty files array', () => {
    const result = sanitizeFailedOperation({ sessionId: 's1', outputPath: '/out', files: [] });
    expect(result.files).toEqual([]);
  });

  test('handles missing files (defaults to empty array)', () => {
    const result = sanitizeFailedOperation({ sessionId: 's1', outputPath: '/out' });
    expect(result.files).toEqual([]);
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
