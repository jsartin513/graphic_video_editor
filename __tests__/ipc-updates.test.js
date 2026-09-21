/**
 * Tests for main/ipc-updates.js
 */

const fs = require('fs');
const { app, ipcMain } = require('electron');

const mockCheckForUpdates = jest.fn();
const mockDownloadUpdate = jest.fn();

jest.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: (...args) => mockCheckForUpdates(...args),
    downloadUpdate: (...args) => mockDownloadUpdate(...args)
  }
}));

const { registerUpdatesIpcHandlers } = require('../main/ipc-updates');

describe('ipc-updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.isPackaged = true;
    app.getVersion.mockReturnValue('1.3.1');
    process.resourcesPath = '/tmp/Video Merger.app/Contents/Resources';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    registerUpdatesIpcHandlers();
  });

  afterEach(() => {
    fs.existsSync.mockRestore?.();
    delete process.resourcesPath;
  });

  function getHandler(channel) {
    const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  }

  describe('check-for-updates', () => {
    it('does not treat latest feed metadata as an update when versions match', async () => {
      mockCheckForUpdates.mockResolvedValue({
        isUpdateAvailable: false,
        updateInfo: { version: '1.3.1' }
      });

      const result = await getHandler('check-for-updates')();

      expect(result.available).toBe(false);
      expect(result.updateInfo).toEqual({ version: '1.3.1' });
      expect(result.currentVersion).toBe('1.3.1');
    });

    it('reports an update when electron-updater says one is available', async () => {
      mockCheckForUpdates.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: { version: '1.4.0' }
      });

      const result = await getHandler('check-for-updates')();

      expect(result.available).toBe(true);
      expect(result.updateInfo).toEqual({ version: '1.4.0' });
    });
  });
});
