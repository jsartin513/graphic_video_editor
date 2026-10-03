jest.mock('../src/logger', () => ({ logger: { error: jest.fn() } }));

const fs = require('fs').promises;
const path = require('path');

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/video-merger-test-userdata')
  }
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      mkdir: jest.fn(),
      copyFile: jest.fn(),
      unlink: jest.fn(),
      access: jest.fn()
    }
  };
});

const {
  addGapIndicator,
  removeGapIndicator,
  getGapIndicatorsFromPreferences,
  listGapIndicatorsWithPaths,
  resolveGapIndicatorPath,
  MAX_GAP_INDICATORS
} = require('../src/gap-indicators');
const { DEFAULT_PREFERENCES } = require('../src/preferences');

describe('gap-indicators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir.mockResolvedValue(undefined);
    fs.copyFile.mockResolvedValue(undefined);
    fs.unlink.mockResolvedValue(undefined);
    fs.access.mockResolvedValue(undefined);
  });

  test('addGapIndicator copies file and updates preferences', async () => {
    const prefs = { ...DEFAULT_PREFERENCES, gapIndicators: [] };
    const updated = await addGapIndicator(prefs, '/tmp/clip.mp4', 'Pause card');
    expect(updated.gapIndicators).toHaveLength(1);
    expect(updated.gapIndicators[0].name).toBe('Pause card');
    expect(fs.copyFile).toHaveBeenCalled();
  });

  test('rejects unsupported extension', async () => {
    const prefs = { ...DEFAULT_PREFERENCES, gapIndicators: [] };
    await expect(addGapIndicator(prefs, '/tmp/clip.avi', 'x')).rejects.toThrow(/MP4/);
  });

  test('removeGapIndicator removes entry', async () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      gapIndicators: [{ id: 'abc', name: 'Test', storedFileName: 'abc.mp4' }]
    };
    const updated = await removeGapIndicator(prefs, 'abc');
    expect(getGapIndicatorsFromPreferences(updated)).toHaveLength(0);
    expect(fs.unlink).toHaveBeenCalledWith(path.join('/tmp/video-merger-test-userdata', 'gap-indicators', 'abc.mp4'));
  });

  test('resolveGapIndicatorPath rejects path traversal storedFileName', () => {
    expect(() => resolveGapIndicatorPath({ storedFileName: '../evil.mp4' })).toThrow(/Invalid indicator/);
  });

  test('listGapIndicatorsWithPaths skips invalid storedFileName', async () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      gapIndicators: [{ id: 'x', name: 'bad', storedFileName: '../evil.mp4' }]
    };
    const result = await listGapIndicatorsWithPaths(prefs);
    expect(result).toHaveLength(0);
    expect(fs.access).not.toHaveBeenCalled();
  });

  test('enforces max indicators', async () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      gapIndicators: Array.from({ length: MAX_GAP_INDICATORS }, (_, i) => ({
        id: `id-${i}`,
        name: `n${i}`,
        storedFileName: `id-${i}.mp4`
      }))
    };
    await expect(addGapIndicator(prefs, '/tmp/new.mp4')).rejects.toThrow(/at most/);
  });
});
