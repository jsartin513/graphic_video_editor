/**
 * Tests for main/ipc-preferences.js - preference and pattern IPC handlers
 */

const fs = require('fs').promises;
const { ipcMain, app } = require('electron');

jest.mock('../src/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('../src/error-mapper', () => ({ mapError: jest.fn((e) => ({ userMessage: String(e), code: 'MAPPED' })) }));
jest.mock('../src/video-grouping', () => ({ derivePatternFromFilename: jest.fn() }));
jest.mock('electron-updater', () => ({ autoUpdater: { quitAndInstall: jest.fn() } }));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      stat: jest.fn(),
      access: jest.fn()
    }
  };
});

const mockPrefs = {
  lastOutputDestination: null,
  recentFilenamePatterns: [],
  recentDirectories: []
};

const {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  setPreferredQuality,
  setPreferredFormat,
  setLastOutputDestination,
  applyDateTokens,
  addRecentDirectory,
  pinDirectory,
  unpinDirectory,
  clearRecentDirectories,
  cleanupDirectories
} = require('../src/preferences');

jest.mock('../src/preferences', () => {
  const actual = jest.requireActual('../src/preferences');
  return {
    ...actual,
    loadPreferences: jest.fn(),
    savePreferences: jest.fn(),
    addRecentPattern: jest.fn((p, pattern) => ({ ...p, recentFilenamePatterns: [pattern] })),
    setPreferredDateFormat: jest.fn((p, fmt) => ({ ...p, dateFormat: fmt })),
    setPreferredQuality: jest.fn((p, q) => ({ ...p, preferredQuality: q })),
    setPreferredFormat: jest.fn((p, f) => ({ ...p, preferredFormat: f })),
    setLastOutputDestination: jest.fn((p, d) => ({ ...p, lastOutputDestination: d })),
    applyDateTokens: jest.fn(() => 'output.mp4'),
    addRecentDirectory: jest.fn((p, dir) => ({ ...p, recentDirectories: [dir] })),
    pinDirectory: jest.fn((p, dir) => ({ ...p })),
    unpinDirectory: jest.fn((p, dir) => ({ ...p })),
    clearRecentDirectories: jest.fn((p) => ({ ...p, recentDirectories: [] })),
    cleanupDirectories: jest.fn(async (p) => p)
  };
});

const { registerPreferenceIpcHandlers } = require('../main/ipc-preferences');
const { mapError } = require('../src/error-mapper');
const { derivePatternFromFilename } = require('../src/video-grouping');

describe('ipc-preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadPreferences.mockResolvedValue({ ...mockPrefs });
    savePreferences.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.access.mockResolvedValue(undefined);
    app.isPackaged = false;
    registerPreferenceIpcHandlers();
  });

  describe('registration', () => {
    it('registers expected preference channels', () => {
      const channels = ipcMain.handle.mock.calls.map((c) => c[0]);
      expect(channels).toContain('load-preferences');
      expect(channels).toContain('save-preferences');
      expect(channels).toContain('save-filename-pattern');
      expect(channels).toContain('save-patterns-from-selected-files');
      expect(channels).toContain('set-date-format');
      expect(channels).toContain('set-preferred-quality');
      expect(channels).toContain('set-preferred-format');
      expect(channels).toContain('set-last-output-destination');
      expect(channels).toContain('map-error');
      expect(channels).toContain('install-update');
      expect(channels).toContain('apply-date-tokens');
      expect(channels).toContain('save-event-template');
      expect(channels).toContain('add-recent-directory');
      expect(channels).toContain('pin-directory');
      expect(channels).toContain('unpin-directory');
      expect(channels).toContain('clear-recent-directories');
      expect(channels).toContain('cleanup-directories');
    });
  });

  function getHandler(channel) {
    const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  }

  describe('load-preferences', () => {
    it('returns preferences from loadPreferences', async () => {
      const prefs = { ...mockPrefs, preferredQuality: 'high' };
      loadPreferences.mockResolvedValue(prefs);
      const handler = getHandler('load-preferences');
      const result = await handler();
      expect(result).toEqual(prefs);
    });

    it('clears lastOutputDestination when path is not a directory', async () => {
      const prefs = { ...mockPrefs, lastOutputDestination: '/some/file.txt' };
      loadPreferences.mockResolvedValue(prefs);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      const handler = getHandler('load-preferences');
      const result = await handler();
      expect(result.lastOutputDestination).toBeNull();
    });
  });

  describe('save-preferences', () => {
    it('calls savePreferences and returns success', async () => {
      const prefs = { ...mockPrefs };
      const handler = getHandler('save-preferences');
      const result = await handler(null, prefs);
      expect(savePreferences).toHaveBeenCalledWith(prefs);
      expect(result).toEqual({ success: true });
    });
  });

  describe('save-filename-pattern', () => {
    it('adds pattern and saves preferences', async () => {
      const pattern = 'Video_{date}';
      const updated = { ...mockPrefs, recentFilenamePatterns: [pattern] };
      addRecentPattern.mockReturnValue(updated);
      const handler = getHandler('save-filename-pattern');
      const result = await handler(null, pattern);
      expect(addRecentPattern).toHaveBeenCalledWith(expect.any(Object), pattern);
      expect(savePreferences).toHaveBeenCalledWith(updated);
      expect(result).toEqual({ success: true, preferences: updated });
    });
  });

  describe('save-event-template', () => {
    it('adds template and saves preferences', async () => {
      loadPreferences.mockResolvedValue({ ...mockPrefs, eventTemplates: [] });
      const handler = getHandler('save-event-template');
      const result = await handler(null, 'BDL Open Gym', 'BDL Open Gym ({date} {eventName})');
      expect(savePreferences).toHaveBeenCalled();
      expect(result.success).toBe(true);
      const savedPrefs = savePreferences.mock.calls[0][0];
      expect(savedPrefs.eventTemplates).toHaveLength(1);
      expect(savedPrefs.eventTemplates[0]).toEqual({ name: 'BDL Open Gym', pattern: 'BDL Open Gym ({date} {eventName})' });
    });

    it('returns error for invalid name or pattern', async () => {
      const handler = getHandler('save-event-template');
      expect(await handler(null, null, 'pattern')).toEqual({ success: false, error: expect.any(String) });
      expect(await handler(null, 'name', null)).toEqual({ success: false, error: expect.any(String) });
      expect(await handler(null, '', 'pattern')).toEqual({ success: false, error: expect.any(String) });
      expect(await handler(null, 'name', '   ')).toEqual({ success: false, error: expect.any(String) });
      expect(loadPreferences).not.toHaveBeenCalled();
    });
  });

  describe('save-patterns-from-selected-files', () => {
    it('uses derivePatternFromFilename from module (not require in loop)', async () => {
      derivePatternFromFilename.mockReturnValue('GX_%Y%m%d');
      const handler = getHandler('save-patterns-from-selected-files');
      await handler(null, ['/path/GX010001.MP4']);
      expect(derivePatternFromFilename).toHaveBeenCalledWith('GX010001.MP4');
      expect(derivePatternFromFilename).toHaveBeenCalledTimes(1);
    });

    it('returns saved: 0 for empty file list', async () => {
      const handler = getHandler('save-patterns-from-selected-files');
      const result = await handler(null, []);
      expect(result).toEqual({ success: true, saved: 0 });
    });
  });

  describe('set-preferred-quality', () => {
    it('saves valid quality and returns updated preferences', async () => {
      setPreferredQuality.mockReturnValue({ ...mockPrefs, preferredQuality: 'high' });
      const handler = getHandler('set-preferred-quality');
      const result = await handler(null, 'high');
      expect(result.success).toBe(true);
      expect(result.preferences.preferredQuality).toBe('high');
    });

    it('throws for invalid quality', async () => {
      const handler = getHandler('set-preferred-quality');
      await expect(handler(null, 'invalid')).rejects.toThrow(/Invalid quality/);
    });
  });

  describe('map-error', () => {
    it('returns result of mapError', async () => {
      const err = new Error('test');
      mapError.mockReturnValue({ userMessage: 'Mapped', code: 'TEST' });
      const handler = getHandler('map-error');
      const result = await handler(null, err);
      expect(mapError).toHaveBeenCalledWith(err);
      expect(result).toEqual({ userMessage: 'Mapped', code: 'TEST' });
    });
  });

  describe('install-update', () => {
    it('returns error when not packaged', async () => {
      app.isPackaged = false;
      const handler = getHandler('install-update');
      const result = await handler();
      expect(result.success).toBe(false);
      expect(result.error).toContain('production builds');
    });
  });

  describe('apply-date-tokens', () => {
    it('returns result from applyDateTokens', async () => {
      applyDateTokens.mockReturnValue('out_2025.mp4');
      const handler = getHandler('apply-date-tokens');
      const result = await handler(null, 'out_{date}.mp4', '2025-01-01', 'YYYY-MM-DD');
      expect(result).toEqual({ result: 'out_2025.mp4' });
    });
  });

  describe('add-recent-directory', () => {
    it('adds directory and returns updated preferences', async () => {
      addRecentDirectory.mockReturnValue({ ...mockPrefs, recentDirectories: ['/new/dir'] });
      const handler = getHandler('add-recent-directory');
      const result = await handler(null, '/new/dir');
      expect(result.success).toBe(true);
      expect(result.preferences.recentDirectories).toContain('/new/dir');
    });
  });

  describe('cleanup-directories', () => {
    it('calls cleanupDirectories and savePreferences', async () => {
      cleanupDirectories.mockResolvedValue({ ...mockPrefs });
      const handler = getHandler('cleanup-directories');
      const result = await handler();
      expect(result.success).toBe(true);
    });
  });
});
