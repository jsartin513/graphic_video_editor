/**
 * Logger IPC handlers
 */

const { ipcMain } = require('electron');
const { logger } = require('../src/logger');
const { loadPreferences, savePreferences } = require('../src/preferences');

function registerLoggerIpcHandlers() {
  ipcMain.handle('get-logs', async (event, filename = null, maxLines = 1000) => {
    try {
      const logs = await logger.readLogs(filename, maxLines);
      return { success: true, logs };
    } catch (error) {
      logger.error('Error getting logs', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-log-files', async () => {
    try {
      const files = await logger.getLogFiles();
      return { success: true, files };
    } catch (error) {
      logger.error('Error getting log files', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clear-logs', async () => {
    try {
      await logger.clearLogs();
      return { success: true };
    } catch (error) {
      logger.error('Error clearing logs', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-logs', async (event, destinationPath) => {
    try {
      const result = await logger.exportLogs(destinationPath);
      return result;
    } catch (error) {
      logger.error('Error exporting logs', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-debug-mode', async () => {
    try {
      const debugMode = logger.getDebugMode();
      return { success: true, debugMode };
    } catch (error) {
      logger.error('Error getting debug mode', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-debug-mode', async (event, enabled) => {
    try {
      logger.setDebugMode(enabled);
      const prefs = await loadPreferences();
      prefs.debugMode = enabled;
      await savePreferences(prefs);
      return { success: true, debugMode: enabled };
    } catch (error) {
      logger.error('Error setting debug mode', { error: error.message });
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerLoggerIpcHandlers };
