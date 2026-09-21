const {
  GENERIC_FILENAME_PATTERN,
  chooseDefaultFilenamePattern,
  isProcessedPlaceholderFilename,
  directorySuffixForGroup
} = require('../src/filename-pattern');

describe('filename-pattern', () => {
  test('chooseDefaultFilenamePattern prefers lastUsedPattern', () => {
    expect(chooseDefaultFilenamePattern({ lastUsedPattern: 'Event {date}' })).toBe('Event {date}');
  });

  test('chooseDefaultFilenamePattern falls back to generic pattern', () => {
    expect(chooseDefaultFilenamePattern({})).toBe(GENERIC_FILENAME_PATTERN);
    expect(chooseDefaultFilenamePattern({ lastUsedPattern: '   ' })).toBe(GENERIC_FILENAME_PATTERN);
  });

  test('isProcessedPlaceholderFilename detects PROCESSED####', () => {
    expect(isProcessedPlaceholderFilename('PROCESSED0534.MP4')).toBe(true);
    expect(isProcessedPlaceholderFilename('PROCESSED0534_court1')).toBe(true);
    expect(isProcessedPlaceholderFilename('BDL Open Gym 2026-09-12')).toBe(false);
  });

  test('directorySuffixForGroup adds folder when session duplicated', () => {
    const groups = [
      { sessionId: '0534', directory: '/vol/court1' },
      { sessionId: '0534', directory: '/vol/court2' }
    ];
    expect(directorySuffixForGroup(groups[0], groups)).toBe('_court1');
    expect(directorySuffixForGroup({ sessionId: '0001', directory: '/a' }, [{ sessionId: '0001' }])).toBe('');
  });
});
