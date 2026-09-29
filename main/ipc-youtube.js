/**
 * IPC handlers for YouTube OAuth and uploads.
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../src/logger');
const { mapError } = require('../src/error-mapper');
const { loadPreferences, savePreferences, setYouTubePreferences } = require('../src/preferences');
const {
  importOAuthClient,
  connectYouTube,
  disconnectYouTube,
  clearYouTubeCredentials,
  getConnectionStatus,
  listMyPlaylists
} = require('../src/youtube-auth');
const { enqueueYouTubeUpload, cancelCurrentYouTubeUpload } = require('../src/youtube-upload');

/**
 * @param {() => import('electron').BrowserWindow|null} getMainWindow
 */
function registerYouTubeIpcHandlers(getMainWindow) {
  ipcMain.handle('youtube-import-oauth-client', async (_event, json) => {
    try {
      const result = await importOAuthClient(json);
      return { success: true, ...result };
    } catch (error) {
      logger.error('youtube-import-oauth-client failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('youtube-import-oauth-client-file', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Google OAuth client JSON',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePaths?.[0]) {
        return { success: false, canceled: true };
      }
      const raw = await fs.readFile(filePaths[0], 'utf8');
      const result = await importOAuthClient(raw);
      return { success: true, ...result };
    } catch (error) {
      logger.error('youtube-import-oauth-client-file failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('youtube-connect', async () => {
    try {
      const result = await connectYouTube();
      return { success: true, ...result };
    } catch (error) {
      logger.error('youtube-connect failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('youtube-disconnect', async () => {
    try {
      const result = await disconnectYouTube();
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('youtube-clear-credentials', async () => {
    try {
      await clearYouTubeCredentials();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('youtube-get-status', async () => {
    try {
      const status = await getConnectionStatus();
      const prefs = await loadPreferences();
      return {
        success: true,
        status,
        settings: prefs.youtube || {}
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('youtube-list-playlists', async () => {
    try {
      const playlists = await listMyPlaylists();
      return { success: true, playlists };
    } catch (error) {
      return { success: false, error: error.message, playlists: [] };
    }
  });

  ipcMain.handle('youtube-save-settings', async (_event, settings) => {
    try {
      let prefs = await loadPreferences();
      prefs = setYouTubePreferences(prefs, settings);
      await savePreferences(prefs);
      return { success: true, preferences: prefs };
    } catch (error) {
      logger.error('youtube-save-settings failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('youtube-upload-video', async (_event, options) => {
    try {
      if (!options?.filePath || typeof options.filePath !== 'string') {
        throw new Error('filePath is required');
      }
      const prefs = await loadPreferences();
      const yt = prefs.youtube || {};
      const uploadId = options.uploadId || options.filePath;
      const title =
        options.title ||
        path.basename(options.filePath, path.extname(options.filePath));
      const job = {
        filePath: options.filePath,
        uploadId,
        title,
        description: options.description ?? yt.description ?? '',
        privacyStatus: options.privacyStatus ?? yt.privacyStatus ?? 'private',
        playlistId: options.playlistId !== undefined ? options.playlistId : yt.playlistId
      };

      const mainWindow = getMainWindow();
      const result = await enqueueYouTubeUpload(job, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('youtube-upload-progress', progress);
        }
      });
      return { success: Boolean(result.success), ...result };
    } catch (error) {
      const mapped = mapError(error);
      return { success: false, error: mapped.userMessage || error.message };
    }
  });

  ipcMain.handle('youtube-cancel-upload', async () => {
    return cancelCurrentYouTubeUpload();
  });
}

module.exports = { registerYouTubeIpcHandlers };
