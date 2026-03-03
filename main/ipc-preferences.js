const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { autoUpdater } = require('electron-updater');

const {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  addEventTemplate,
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

const { mapError } = require('../src/error-mapper');
const { logger } = require('../src/logger');
const { derivePatternFromFilename } = require('../src/video-grouping');

/**
 * Register IPC handlers related to preferences, patterns, and updates.
 */
function registerPreferenceIpcHandlers() {
  ipcMain.handle('load-preferences', async () => {
    try {
      const prefs = await loadPreferences();
      if (prefs.lastOutputDestination) {
        try {
          const stat = await fs.stat(prefs.lastOutputDestination);
          if (!stat.isDirectory()) {
            prefs.lastOutputDestination = null;
          }
        } catch {
          prefs.lastOutputDestination = null;
        }
      }
      return prefs;
    } catch (error) {
      logger.error('Error loading preferences', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('save-preferences', async (event, preferences) => {
    try {
      await savePreferences(preferences);
      return { success: true };
    } catch (error) {
      logger.error('Error saving preferences', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('save-filename-pattern', async (event, pattern) => {
    try {
      const prefs = await loadPreferences();
      const updated = addRecentPattern(prefs, pattern);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error saving filename pattern', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('save-patterns-from-selected-files', async (event, filePaths) => {
    try {
      if (!Array.isArray(filePaths) || filePaths.length === 0) return { success: true, saved: 0 };
      const seen = new Set();
      let prefs = await loadPreferences();
      for (const filePath of filePaths) {
        const filename = path.basename(filePath);
        const pattern = derivePatternFromFilename(filename);
        if (pattern && !seen.has(pattern)) {
          seen.add(pattern);
          prefs = addRecentPattern(prefs, pattern);
        }
      }
      if (seen.size > 0) {
        await savePreferences(prefs);
      }
      return { success: true, saved: seen.size };
    } catch (error) {
      logger.error('Error saving patterns from selected files', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('set-date-format', async (event, format) => {
    try {
      const prefs = await loadPreferences();
      const updated = setPreferredDateFormat(prefs, format);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error setting date format', { error: error.message });
      throw error;
    }
  });

  const ALLOWED_QUALITIES = new Set(['copy', 'high', 'medium', 'low']);
  ipcMain.handle('set-preferred-quality', async (event, quality) => {
    try {
      if (typeof quality !== 'string' || !ALLOWED_QUALITIES.has(quality)) {
        throw new Error(`Invalid quality value: ${String(quality)}`);
      }

      const prefs = await loadPreferences();
      const updated = setPreferredQuality(prefs, quality);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error setting preferred quality', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('set-preferred-format', async (event, format) => {
    try {
      const prefs = await loadPreferences();
      const updated = setPreferredFormat(prefs, format);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error setting preferred format', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('set-last-output-destination', async (event, destination) => {
    try {
      let safeDestination = null;
      if (!destination) {
        safeDestination = null;
      } else if (typeof destination === 'string' && path.isAbsolute(destination)) {
        safeDestination = destination;
      } else {
        throw new Error('Invalid output destination');
      }
      const prefs = await loadPreferences();
      const updated = setLastOutputDestination(prefs, safeDestination);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error setting last output destination', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('map-error', async (event, errorMessage) => {
    try {
      return mapError(errorMessage);
    } catch (error) {
      logger.error('Error mapping error', { error: error?.message });
      return {
        userMessage: 'An Error Occurred',
        suggestion: 'Something went wrong.',
        fixes: ['Try again', 'Check console for details'],
        code: 'MAPPING_ERROR',
        technicalDetails: errorMessage,
        originalError: error
      };
    }
  });

  ipcMain.handle('install-update', async () => {
    if (!app.isPackaged) {
      return {
        success: false,
        error: 'Updates can only be installed in production builds'
      };
    }

    try {
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
      return { success: true };
    } catch (error) {
      logger.error('Error installing update', { error: error?.message });
      return {
        success: false,
        error: 'Failed to install update. The app will install the update on the next quit.'
      };
    }
  });

  ipcMain.handle('save-event-template', async (event, name, pattern) => {
    try {
      const prefs = await loadPreferences();
      const updated = addEventTemplate(prefs, { name: name.trim(), pattern: pattern.trim() });
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error saving event template', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('apply-date-tokens', async (event, pattern, dateStr, dateFormat, customTokens) => {
    try {
      const date = dateStr ? new Date(dateStr) : new Date();
      const result = applyDateTokens(pattern, date, dateFormat, customTokens || {});
      return { result };
    } catch (error) {
      logger.error('Error applying date tokens', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('add-recent-directory', async (event, dirPath) => {
    try {
      const prefs = await loadPreferences();
      const updated = addRecentDirectory(prefs, dirPath);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error adding recent directory', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('pin-directory', async (event, dirPath) => {
    try {
      const prefs = await loadPreferences();
      const updated = pinDirectory(prefs, dirPath);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error pinning directory', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('unpin-directory', async (event, dirPath) => {
    try {
      const prefs = await loadPreferences();
      const updated = unpinDirectory(prefs, dirPath);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error unpinning directory', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('clear-recent-directories', async () => {
    try {
      const prefs = await loadPreferences();
      const updated = clearRecentDirectories(prefs);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error clearing recent directories', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('cleanup-directories', async () => {
    try {
      const prefs = await loadPreferences();
      const existsCheck = async (dirPath) => {
        try {
          await fs.access(dirPath);
          return true;
        } catch {
          return false;
        }
      };
      const updated = await cleanupDirectories(prefs, existsCheck);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error cleaning up directories', { error: error.message });
      throw error;
    }
  });
}

module.exports = {
  registerPreferenceIpcHandlers
};

