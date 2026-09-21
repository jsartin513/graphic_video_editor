/**
 * Bug report IPC handlers — pre-filled GitHub issues (no token in app).
 */

const { app, ipcMain, shell, clipboard } = require('electron');
const { logger } = require('../src/logger');
const { prepareBugReport } = require('../src/bug-report');

function registerBugReportIpcHandlers() {
  ipcMain.handle('prepare-bug-report', async (_event, input = {}) => {
    try {
      const payload = await prepareBugReport(
        { app, process, logger },
        {
          userDescription: input.userDescription,
          errorInfo: input.errorInfo
        }
      );
      return { success: true, ...payload };
    } catch (error) {
      logger.error('Failed to prepare bug report', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-bug-report', async (_event, input = {}) => {
    try {
      const payload = await prepareBugReport(
        { app, process, logger },
        {
          userDescription: input.userDescription,
          errorInfo: input.errorInfo
        }
      );
      clipboard.writeText(payload.body);
      const parsedUrl = new URL(payload.url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid issue URL');
      }
      await shell.openExternal(payload.url);
      return { success: true, copiedToClipboard: true };
    } catch (error) {
      logger.error('Failed to open bug report', { error: error.message });
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerBugReportIpcHandlers };
