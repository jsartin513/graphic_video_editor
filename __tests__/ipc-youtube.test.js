/**
 * Tests for main/ipc-youtube.js handler registration
 */

const { ipcMain } = require('electron');

jest.mock('../src/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/error-mapper', () => ({
  mapError: jest.fn((e) => ({ userMessage: e.message }))
}));
jest.mock('../src/preferences', () => ({
  loadPreferences: jest.fn().mockResolvedValue({
    youtube: { privacyStatus: 'private', description: '', playlistId: null }
  }),
  savePreferences: jest.fn(),
  setYouTubePreferences: jest.fn((p, s) => ({ ...p, youtube: { ...p.youtube, ...s } }))
}));
jest.mock('../src/youtube-auth', () => ({
  importOAuthClient: jest.fn(),
  connectYouTube: jest.fn(),
  disconnectYouTube: jest.fn(),
  clearYouTubeCredentials: jest.fn(),
  getConnectionStatus: jest.fn().mockResolvedValue({ connected: false }),
  listMyPlaylists: jest.fn().mockResolvedValue([])
}));
jest.mock('../src/youtube-upload', () => ({
  enqueueYouTubeUpload: jest.fn().mockResolvedValue({ success: true, videoId: 'v1' }),
  cancelCurrentYouTubeUpload: jest.fn().mockReturnValue({ success: true })
}));

const { registerYouTubeIpcHandlers } = require('../main/ipc-youtube');

function getHandler(channel) {
  const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
  return call ? call[1] : null;
}

describe('ipc-youtube', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ipcMain.handle.mockClear();
    registerYouTubeIpcHandlers(() => null);
  });

  it('registers expected channels', () => {
    const channels = ipcMain.handle.mock.calls.map((c) => c[0]);
    expect(channels).toContain('youtube-get-status');
    expect(channels).toContain('youtube-upload-video');
    expect(channels).toContain('youtube-save-settings');
  });

  it('youtube-get-status returns status and settings', async () => {
    const handler = getHandler('youtube-get-status');
    const result = await handler();
    expect(result.success).toBe(true);
    expect(result.status).toEqual({ connected: false });
    expect(result.settings).toBeDefined();
  });
});
