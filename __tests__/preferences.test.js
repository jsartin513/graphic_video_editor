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
      mkdir: jest.fn(),
      access: jest.fn()
    }
  };
});

const {
  addRecentPattern,
  addEventTemplate,
  removeEventTemplate,
  replaceEventTemplate,
  setLastWeekCount,
  sanitizeFilenameForOutput,
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
  preferencesFileExists,
  shouldShowDefaultsSetup,
  completeDefaultsSetup,
  setDefaultFilenamePattern,
  setPreferredQuality,
  setPreferredFormat,
  setLastOutputDestination,
  setAutoDetectSDCards,
  setShowSDCardNotifications,
  DEFAULT_EVENT_TEMPLATES,
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
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
  });

  test('returns merged preferences when file exists', async () => {
    const stored = { preferredDateFormat: 'MM-DD-YYYY', recentFilenamePatterns: ['P1'], eventTemplates: [{ name: 'Custom', pattern: 'X {date}' }] };
    fs.readFile.mockResolvedValue(JSON.stringify(stored));

    const result = await loadPreferences();

    expect(result.preferredDateFormat).toBe('MM-DD-YYYY');
    expect(result.recentFilenamePatterns).toEqual(['P1']);
    expect(result.preferredQuality).toBe('copy'); // from defaults
    expect(result.eventTemplates).toEqual([{ name: 'Custom', pattern: 'X {date}' }]);
  });

  test('seeds default event templates when stored list is empty and not yet seeded', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ eventTemplates: [] }));

    const result = await loadPreferences();

    expect(result.eventTemplates).toEqual(DEFAULT_EVENT_TEMPLATES);
    expect(result.eventTemplatesSeeded).toBe(true);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  test('keeps empty event templates when user cleared list after seeding', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ eventTemplates: [], eventTemplatesSeeded: true }));

    const result = await loadPreferences();

    expect(result.eventTemplates).toEqual([]);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  test('returns merged preferences when template migration save fails', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ preferredQuality: 'high', eventTemplates: [] }));
    fs.writeFile.mockRejectedValue(new Error('disk full'));

    const result = await loadPreferences();

    expect(result.preferredQuality).toBe('high');
    expect(result.eventTemplates).toEqual(DEFAULT_EVENT_TEMPLATES);
  });

  test('seeds default event templates when key is missing', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ preferredQuality: 'high' }));

    const result = await loadPreferences();

    expect(result.eventTemplates).toEqual(DEFAULT_EVENT_TEMPLATES);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  test('does not persist seed when custom event templates exist', async () => {
    const custom = [{ name: 'Mine', pattern: 'Mine {date}' }];
    fs.readFile.mockResolvedValue(JSON.stringify({
      eventTemplates: custom,
      eventTemplatesSeeded: true
    }));

    const result = await loadPreferences();

    expect(result.eventTemplates).toEqual(custom);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  test('merges lastWeekCount from stored preferences', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ lastWeekCount: '12' }));

    const result = await loadPreferences();

    expect(result.lastWeekCount).toBe('12');
  });

  test('returns defaults when file does not exist (ENOENT)', async () => {
    const err = new Error('not found');
    err.code = 'ENOENT';
    fs.readFile.mockRejectedValue(err);

    const result = await loadPreferences();

    expect(result).toEqual({
      ...DEFAULT_PREFERENCES,
      eventTemplates: [...DEFAULT_EVENT_TEMPLATES],
      eventTemplatesSeeded: true
    });
  });

  test('returns defaults on parse error', async () => {
    fs.readFile.mockResolvedValue('invalid json {{{');

    const result = await loadPreferences();

    expect(result).toEqual({ ...DEFAULT_PREFERENCES, eventTemplates: [...DEFAULT_EVENT_TEMPLATES], eventTemplatesSeeded: true });
  });
});

describe('preferencesFileExists and shouldShowDefaultsSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('preferencesFileExists returns true when access succeeds', async () => {
    fs.access.mockResolvedValue(undefined);
    expect(await preferencesFileExists()).toBe(true);
  });

  test('preferencesFileExists returns false when access fails', async () => {
    fs.access.mockRejectedValue(new Error('ENOENT'));
    expect(await preferencesFileExists()).toBe(false);
  });

  test('shouldShowDefaultsSetup is true when file missing', async () => {
    fs.access.mockRejectedValue(new Error('ENOENT'));
    expect(await shouldShowDefaultsSetup()).toBe(true);
  });

  test('shouldShowDefaultsSetup is false for legacy file without flag', async () => {
    fs.access.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue(JSON.stringify({ preferredQuality: 'copy' }));
    expect(await shouldShowDefaultsSetup()).toBe(false);
  });

  test('shouldShowDefaultsSetup is true when flag is false', async () => {
    fs.access.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultsSetupCompleted: false }));
    expect(await shouldShowDefaultsSetup()).toBe(true);
  });

  test('shouldShowDefaultsSetup is false when flag is true', async () => {
    fs.access.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultsSetupCompleted: true }));
    expect(await shouldShowDefaultsSetup()).toBe(false);
  });
});

describe('completeDefaultsSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
  });

  test('skip writes preferences with defaultsSetupCompleted', async () => {
    const err = new Error('not found');
    err.code = 'ENOENT';
    fs.readFile.mockRejectedValue(err);

    const result = await completeDefaultsSetup({ skipped: true });

    expect(result.defaultsSetupCompleted).toBe(true);
    expect(result.lastUsedPattern).toBeNull();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  test('save sets lastUsedPattern and date format', async () => {
    const err = new Error('not found');
    err.code = 'ENOENT';
    fs.readFile.mockRejectedValue(err);

    const result = await completeDefaultsSetup({
      skipped: false,
      dateFormat: 'MM-DD-YYYY',
      pattern: 'BDL Open Gym {date} {sessionId}',
      templateName: 'BDL Open Gym',
      templatePattern: 'BDL Open Gym {date} {sessionId}'
    });

    expect(result.defaultsSetupCompleted).toBe(true);
    expect(result.preferredDateFormat).toBe('MM-DD-YYYY');
    expect(result.lastUsedPattern).toBe('BDL Open Gym {date} {sessionId}');
    expect(result.defaultTemplateName).toBe('BDL Open Gym');
  });
});

describe('setDefaultFilenamePattern', () => {
  test('updates lastUsedPattern and defaultTemplateName', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const updated = setDefaultFilenamePattern(prefs, 'Week {count} {date}', 'BYOT');
    expect(updated.lastUsedPattern).toBe('Week {count} {date}');
    expect(updated.defaultTemplateName).toBe('BYOT');
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

  test('replaces custom tokens: eventName, leagueName, weekName', () => {
    const date = new Date(2024, 0, 15);
    const customTokens = { eventName: 'BDL Open Gym', leagueName: 'Rec League', weekName: 'Week 3' };
    const result = applyDateTokens('BDL ({leagueName}) ({weekName})_{date}', date, 'YYYY-MM-DD', customTokens);
    expect(result).toBe('BDL (Rec League) (Week 3)_2024-01-15');
  });

  test('replaces empty string when custom token not provided', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Event_{eventName}_{date}', date, 'YYYY-MM-DD', {});
    expect(result).toBe('Event__2024-01-15');
  });

  test('trims custom token values', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('{eventName}', date, 'YYYY-MM-DD', { eventName: '  BDL  ' });
    expect(result).toBe('BDL');
  });

  test('replaces {count} token', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Week {count} {date}', date, 'YYYY-MM-DD', { count: '3' });
    expect(result).toBe('Week 3 2024-01-15');
  });

  test('trims {count} token value', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('{count}', date, 'YYYY-MM-DD', { count: '  5  ' });
    expect(result).toBe('5');
  });

  test('replaces empty {count} when not provided', () => {
    const date = new Date(2024, 0, 15);
    const result = applyDateTokens('Week {count}', date, 'YYYY-MM-DD', {});
    expect(result).toBe('Week ');
  });

  test('resolves default BYOT template pattern with count and date', () => {
    const date = new Date(2026, 8, 12);
    const byot = DEFAULT_EVENT_TEMPLATES.find((t) => t.name === 'BDL Fall 2026 BYOT');
    expect(byot).toBeDefined();
    const pattern = byot.pattern.replace(/\{sessionId\}/gi, '0534');
    const result = applyDateTokens(pattern, date, 'YYYY-MM-DD', { count: '3' });
    expect(result).toBe('BDL Fall 2026 BYOT Week 3 2026-09-12 0534');
  });
});

describe('addEventTemplate', () => {
  test('adds template to empty list', () => {
    const prefs = { ...DEFAULT_PREFERENCES, eventTemplates: [] };
    const result = addEventTemplate(prefs, { name: 'BDL Open Gym', pattern: 'BDL Open Gym ({date})' });
    expect(result.eventTemplates).toHaveLength(1);
    expect(result.eventTemplates[0]).toEqual({ name: 'BDL Open Gym', pattern: 'BDL Open Gym ({date})' });
  });

  test('moves existing template to front when re-added', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      eventTemplates: [
        { name: 'BDL League', pattern: 'BDL ({leagueName})' },
        { name: 'BDL Open Gym', pattern: 'BDL Open Gym ({date})' }
      ]
    };
    const result = addEventTemplate(prefs, { name: 'BDL Open Gym', pattern: 'BDL Open Gym ({date} {eventName})' });
    expect(result.eventTemplates[0].name).toBe('BDL Open Gym');
  });

  test('ignores invalid template', () => {
    const prefs = { ...DEFAULT_PREFERENCES, eventTemplates: [] };
    expect(addEventTemplate(prefs, null)).toEqual(prefs);
    expect(addEventTemplate(prefs, { name: '', pattern: 'x' })).toEqual(prefs);
    expect(addEventTemplate(prefs, { name: 'x', pattern: '' })).toEqual(prefs);
  });
});

describe('removeEventTemplate', () => {
  test('removes template by name', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      eventTemplates: [
        { name: 'A', pattern: 'a' },
        { name: 'B', pattern: 'b' }
      ]
    };
    const result = removeEventTemplate(prefs, 'A');
    expect(result.eventTemplates).toEqual([{ name: 'B', pattern: 'b' }]);
  });

  test('ignores blank template name', () => {
    const prefs = { ...DEFAULT_PREFERENCES, eventTemplates: [{ name: 'A', pattern: 'a' }] };
    expect(removeEventTemplate(prefs, '')).toEqual(prefs);
    expect(removeEventTemplate(prefs, '   ')).toEqual(prefs);
  });
});

describe('replaceEventTemplate', () => {
  test('renames template in one step', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      eventTemplates: [
        { name: 'Old', pattern: 'old {date}' },
        { name: 'Keep', pattern: 'keep {date}' }
      ]
    };
    const result = replaceEventTemplate(prefs, 'Old', { name: 'New', pattern: 'new {date}' });
    expect(result.eventTemplates).toEqual([
      { name: 'New', pattern: 'new {date}' },
      { name: 'Keep', pattern: 'keep {date}' }
    ]);
  });
});

describe('setLastWeekCount', () => {
  test('stores trimmed week count as string', () => {
    const result = setLastWeekCount(DEFAULT_PREFERENCES, '  4  ');
    expect(result.lastWeekCount).toBe('4');
  });

  test('coerces numeric week count to string', () => {
    const result = setLastWeekCount(DEFAULT_PREFERENCES, 9);
    expect(result.lastWeekCount).toBe('9');
  });

  test('clears week count when null', () => {
    const prefs = { ...DEFAULT_PREFERENCES, lastWeekCount: '2' };
    const result = setLastWeekCount(prefs, null);
    expect(result.lastWeekCount).toBe('');
  });
});

describe('sanitizeFilenameForOutput', () => {
  test('preserves spaces and strips invalid characters', () => {
    expect(sanitizeFilenameForOutput('BDL Open Gym 2026-09-12')).toBe('BDL Open Gym 2026-09-12');
    expect(sanitizeFilenameForOutput('bad/name:test')).toBe('bad_name_test');
  });

  test('strips quotes angle brackets and asterisk', () => {
    expect(sanitizeFilenameForOutput('a*b?c"d<e>|f\\g')).toBe('a_b_c_d_e__f_g');
  });

  test('returns empty string for non-string input', () => {
    expect(sanitizeFilenameForOutput(null)).toBe('');
    expect(sanitizeFilenameForOutput(undefined)).toBe('');
  });

  test('strips control characters and trailing dots', () => {
    expect(sanitizeFilenameForOutput('name\u0001test')).toBe('name_test');
    expect(sanitizeFilenameForOutput('file. ')).toBe('file');
  });

  test('prefixes Windows reserved device names', () => {
    expect(sanitizeFilenameForOutput('CON')).toBe('_CON');
    expect(sanitizeFilenameForOutput('nul.mp4')).toBe('_nul.mp4');
    expect(sanitizeFilenameForOutput('CON.notes.v1')).toBe('_CON.notes.v1');
  });
});

describe('DEFAULT_PREFERENCES', () => {
  test('includes seeded event templates', () => {
    expect(DEFAULT_PREFERENCES.eventTemplates).toEqual(DEFAULT_EVENT_TEMPLATES);
  });

  test('DEFAULT_EVENT_TEMPLATES includes BDL Open Gym and BYOT patterns', () => {
    expect(DEFAULT_EVENT_TEMPLATES).toEqual([
      { name: 'BDL Open Gym', pattern: 'BDL Open Gym {date} {sessionId}' },
      { name: 'BDL Fall 2026 BYOT', pattern: 'BDL Fall 2026 BYOT Week {count} {date} {sessionId}' }
    ]);
  });

  test('defaults lastWeekCount to empty string', () => {
    expect(DEFAULT_PREFERENCES.lastWeekCount).toBe('');
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

  test('throws when outputPath trims to empty', () => {
    expect(() => sanitizeFailedOperation({ sessionId: 's1', outputPath: '   ' })).toThrow('Invalid failed operation: missing outputPath.');
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
