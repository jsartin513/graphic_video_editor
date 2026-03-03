/**
 * Tests for main/ipc-misc.js - open folder, open URL, ffmpeg check, etc.
 */

const { ipcMain, shell } = require('electron');

jest.mock('../src/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('../src/ffmpeg-resolver', () => ({ checkFFmpeg: jest.fn().mockResolvedValue({ installed: true }) }));

const { registerMiscIpcHandlers } = require('../main/ipc-misc');

describe('ipc-misc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shell.openExternal.mockResolvedValue(undefined);
    registerMiscIpcHandlers();
  });

  function getHandler(channel) {
    const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  }

  describe('open-external', () => {
    it('opens valid https URL', async () => {
      const handler = getHandler('open-external');
      await handler(null, 'https://example.com');
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });

    it('opens valid http URL', async () => {
      const handler = getHandler('open-external');
      await handler(null, 'http://example.com');
      expect(shell.openExternal).toHaveBeenCalledWith('http://example.com');
    });

    it('throws Invalid URL when url is null', async () => {
      const handler = getHandler('open-external');
      await expect(handler(null, null)).rejects.toThrow('Invalid URL');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('throws Invalid URL when url is undefined', async () => {
      const handler = getHandler('open-external');
      await expect(handler(null, undefined)).rejects.toThrow('Invalid URL');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('throws Invalid URL when url is empty string', async () => {
      const handler = getHandler('open-external');
      await expect(handler(null, '')).rejects.toThrow('Invalid URL');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('throws Invalid URL when url is whitespace only', async () => {
      const handler = getHandler('open-external');
      await expect(handler(null, '   ')).rejects.toThrow('Invalid URL');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('throws Invalid URL when url is not a string', async () => {
      const handler = getHandler('open-external');
      await expect(handler(null, 123)).rejects.toThrow('Invalid URL');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });
});
