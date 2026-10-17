const path = require('path');
const {
  isE2eEnabled,
  getE2eMoviesDirectory,
  anyE2eRemovableSource,
  isE2eRemovableSourcePath
} = require('../src/e2e-test-hooks');

describe('e2e-test-hooks', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('is inactive without VIDEO_MERGER_E2E', () => {
    delete process.env.VIDEO_MERGER_E2E;
    expect(isE2eEnabled()).toBe(false);
    expect(getE2eMoviesDirectory()).toBeNull();
    expect(anyE2eRemovableSource(['/any/path'])).toBe(false);
  });

  it('honors e2e movies and removable prefixes when enabled', () => {
    process.env.VIDEO_MERGER_E2E = '1';
    process.env.VIDEO_MERGER_E2E_MOVIES_DIR = '/tmp/e2e-movies';
    process.env.VIDEO_MERGER_E2E_REMOVABLE_PREFIX = '/tmp/e2e-vol';

    expect(isE2eEnabled()).toBe(true);
    expect(getE2eMoviesDirectory()).toBe(path.resolve('/tmp/e2e-movies'));
    expect(isE2eRemovableSourcePath('/tmp/e2e-vol/DCIM/GX010001.MP4')).toBe(true);
    expect(anyE2eRemovableSource(['/home/local/GX010001.MP4'])).toBe(false);
  });
});
