const { countAddedVideosFromBrowserResult } = require('../src/file-browser-add-result');

describe('file-browser-add-result', () => {
  it('counts only result.added, not resolved files', () => {
    expect(countAddedVideosFromBrowserResult({ files: ['/a.mp4', '/b.mp4'], added: [] })).toBe(0);
    expect(countAddedVideosFromBrowserResult({ files: ['/a.mp4'], added: ['/a.mp4'] })).toBe(1);
    expect(countAddedVideosFromBrowserResult({ files: ['/a.mp4', '/b.mp4'], added: ['/a.mp4', '/b.mp4'] })).toBe(2);
  });

  it('returns 0 for missing or invalid result', () => {
    expect(countAddedVideosFromBrowserResult(null)).toBe(0);
    expect(countAddedVideosFromBrowserResult({ files: ['/a.mp4'] })).toBe(0);
  });
});
