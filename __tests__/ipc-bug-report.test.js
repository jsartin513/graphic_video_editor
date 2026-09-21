/**
 * Tests for main/ipc-bug-report.js
 */

const { ipcMain, shell, clipboard, app } = require('electron');

jest.mock('../src/logger', () => ({
  logger: {
    getDebugMode: jest.fn(() => false),
    readLogs: jest.fn().mockResolvedValue(''),
    error: jest.fn()
  }
}));

const { registerBugReportIpcHandlers } = require('../main/ipc-bug-report');

describe('ipc-bug-report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.getVersion.mockReturnValue('1.3.2');
    app.isPackaged = true;
    clipboard.writeText.mockImplementation(() => {});
    shell.openExternal.mockResolvedValue(undefined);
    registerBugReportIpcHandlers();
  });

  function getHandler(channel) {
    const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  }

  describe('prepare-bug-report', () => {
    it('returns title, body, and url', async () => {
      const handler = getHandler('prepare-bug-report');
      const result = await handler(null, { userDescription: 'Test issue' });
      expect(result.success).toBe(true);
      expect(result.title).toContain('Test issue');
      expect(result.body).toContain('Test issue');
      expect(result.url).toContain('issues/new');
    });
  });

  describe('open-bug-report', () => {
    it('copies body to clipboard and opens GitHub', async () => {
      const handler = getHandler('open-bug-report');
      const result = await handler(null, { userDescription: 'Crash on merge' });
      expect(result.success).toBe(true);
      expect(result.copiedToClipboard).toBe(true);
      expect(clipboard.writeText).toHaveBeenCalled();
      expect(shell.openExternal).toHaveBeenCalled();
      const openedUrl = shell.openExternal.mock.calls[0][0];
      expect(openedUrl).toMatch(/^https:\/\/github\.com\//);
    });
  });
});
