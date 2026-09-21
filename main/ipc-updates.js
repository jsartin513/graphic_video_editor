/**
 * Auto-update IPC handlers
 */

const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const RELEASES_LATEST_URL = 'https://github.com/jsartin513/graphic_video_editor/releases/latest';

function hasUpdateFeed() {
  try {
    const ymlPath = path.join(process.resourcesPath || '', 'app-update.yml');
    return Boolean(process.resourcesPath && fs.existsSync(ymlPath));
  } catch (error) {
    return false;
  }
}

function registerUpdatesIpcHandlers() {
  ipcMain.handle('get-app-info', async () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    hasUpdateFeed: app.isPackaged && hasUpdateFeed(),
    releasesLatestUrl: RELEASES_LATEST_URL
  }));

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { available: false, message: 'Updates are only available in production builds' };
    }
    if (!hasUpdateFeed()) {
      return {
        available: false,
        noUpdateFeed: true,
        message: `This install cannot check for updates in the app. Download the latest fat DMG from ${RELEASES_LATEST_URL}, then replace Video Merger in Applications.`
      };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      const updateInfo = result?.updateInfo ?? null;
      // checkForUpdates() always returns updateInfo for the latest feed entry.
      // isUpdateAvailable is the version comparison (electron-updater ships its
      // own nested semver; do not require('semver') here — it is not packed).
      const available = Boolean(result?.isUpdateAvailable);
      return { available, updateInfo, currentVersion: app.getVersion() };
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
    if (!hasUpdateFeed()) {
      return {
        success: false,
        error: `Download the latest fat DMG from ${RELEASES_LATEST_URL} and replace the app in Applications.`
      };
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

module.exports = { registerUpdatesIpcHandlers, hasUpdateFeed };
