const { setYouTubePreferences, DEFAULT_PREFERENCES } = require('../src/preferences');

describe('setYouTubePreferences', () => {
  it('merges youtube settings with defaults', () => {
    const prefs = { youtube: { ...DEFAULT_PREFERENCES.youtube } };
    const updated = setYouTubePreferences(prefs, {
      autoUpload: true,
      privacyStatus: 'public',
      playlistId: 'PL1',
      playlistTitle: 'Games',
      description: 'Merged from Video Merger'
    });
    expect(updated.youtube.autoUpload).toBe(true);
    expect(updated.youtube.privacyStatus).toBe('public');
    expect(updated.youtube.playlistId).toBe('PL1');
    expect(updated.youtube.description).toContain('Video Merger');
  });

  it('ignores invalid privacy values', () => {
    const prefs = { youtube: { privacyStatus: 'private' } };
    const updated = setYouTubePreferences(prefs, { privacyStatus: 'invalid' });
    expect(updated.youtube.privacyStatus).toBe('private');
  });
});
