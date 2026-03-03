/**
 * Auto-update IPC handlers
 */

const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

function registerUpdatesIpcHandlers() {
  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { available: false, message: 'Updates are only available in production builds' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { available: result && result.updateInfo, updateInfo: result ? result.updateInfo : null };
    } catch (error) {
      const errorMessage = error.message || String(error);
      let userMessage = 'Failed to check for updates.';
      if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        userMessage = 'Cannot check for updates. Please check your internet connection.';
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        userMessage = 'Update server not found. This may be a new release.';
      }
      return { available: false, error: true, message: userMessage };
    }
  });

  ipcMain.handle('download-update', async () => {
    if (!app.isPackaged) {
      return { success: false, error: 'Updates can only be downloaded in production builds' };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      const errorMessage = error.message || String(error);
      let userMessage = 'Failed to download update.';
      if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        userMessage = 'Download failed. Please check your internet connection and try again.';
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        userMessage = 'Update file not found. Please try again later.';
      } else if (errorMessage.includes('space') || errorMessage.includes('ENOSPC')) {
        userMessage = 'Not enough disk space to download the update.';
      }
      return { success: false, error: userMessage };
    }
  });
}

module.exports = { registerUpdatesIpcHandlers };
