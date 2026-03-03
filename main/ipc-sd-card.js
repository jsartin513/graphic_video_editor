/**
 * SD card and failed-operation IPC handlers
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { ipcMain, shell } = require('electron');

const { logger } = require('../src/logger');
const {
  loadPreferences,
  savePreferences,
  setAutoDetectSDCards,
  setShowSDCardNotifications,
  sanitizeFailedOperation,
  addFailedOperation,
  removeFailedOperation,
  getFailedOperations,
  clearFailedOperations
} = require('../src/preferences');
const { SDCardDetector } = require('../src/sd-card-detector');
const { VIDEO_EXTENSIONS } = require('../src/video-scanner');

function normalizeBoolean(enabled) {
  if (typeof enabled === 'boolean') return enabled;
  if (typeof enabled === 'string') {
    const lower = enabled.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return Boolean(enabled);
}

/**
 * @param {() => import('../src/sd-card-detector').SDCardDetector|null} getSdCardDetector
 * @param {(detector: import('../src/sd-card-detector').SDCardDetector|null) => void} setSdCardDetector
 * @param {() => Promise<void>} initializeSDCardDetection
 */
function registerSDCardIpcHandlers(getSdCardDetector, setSdCardDetector, initializeSDCardDetection) {
  ipcMain.handle('get-gopro-sd-cards', async () => {
    try {
      let detector = getSdCardDetector();
      if (!detector) {
        detector = new SDCardDetector();
        setSdCardDetector(detector);
      }
      return await detector.getGoProSDCards();
    } catch (error) {
      logger.error('Error getting GoPro SD cards', { error: error.message });
      return [];
    }
  });

  ipcMain.handle('open-sd-card-directory', async (event, sdCardPath) => {
    if (typeof sdCardPath !== 'string' || !sdCardPath.trim()) {
      return { success: false, error: 'Invalid SD card path' };
    }
    try {
      const dcimPath = path.join(sdCardPath, 'DCIM');
      const targetPath = fsSync.existsSync(dcimPath) ? dcimPath : sdCardPath;
      const openError = await shell.openPath(targetPath);
      if (openError) {
        logger.error('Error opening SD card directory', { error: openError });
        return { success: false, error: openError };
      }
      return { success: true, path: targetPath };
    } catch (error) {
      logger.error('Error opening SD card directory', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('load-sd-card-files', async (event, sdCardPath) => {
    if (typeof sdCardPath !== 'string' || !sdCardPath.trim()) {
      return { success: false, error: 'Invalid SD card path', files: [] };
    }
    try {
      const dcimPath = path.join(sdCardPath, 'DCIM');
      const videoFiles = [];

      async function scanDirectory(dirPath) {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              await scanDirectory(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (VIDEO_EXTENSIONS.includes(ext)) {
                videoFiles.push(fullPath);
              }
            }
          }
        } catch (error) {
          logger.warn('Error scanning directory', { dirPath, error: error.message });
        }
      }

      if (fsSync.existsSync(dcimPath)) {
        await scanDirectory(dcimPath);
      }
      return { success: true, files: videoFiles };
    } catch (error) {
      logger.error('Error loading SD card files', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('set-auto-detect-sd-cards', async (event, enabled) => {
    try {
      const normalizedEnabled = normalizeBoolean(enabled);
      const detector = getSdCardDetector();
      const prefs = await loadPreferences();
      const updated = setAutoDetectSDCards(prefs, normalizedEnabled);
      await savePreferences(updated);

      if (normalizedEnabled && !detector) {
        await initializeSDCardDetection();
      } else if (!normalizedEnabled && detector) {
        detector.stop();
        setSdCardDetector(null);
      }
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error setting auto-detect SD cards', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('set-show-sd-card-notifications', async (event, enabled) => {
    try {
      const normalizedEnabled = normalizeBoolean(enabled);
      const prefs = await loadPreferences();
      const updated = setShowSDCardNotifications(prefs, normalizedEnabled);
      await savePreferences(updated);
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error setting SD card notifications', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('add-failed-operation', async (event, operation) => {
    try {
      const sanitizedOperation = sanitizeFailedOperation(operation);
      const prefs = await loadPreferences();
      const updated = addFailedOperation(prefs, sanitizedOperation);
      await savePreferences(updated);
      return { success: true };
    } catch (error) {
      logger.error('Error adding failed operation', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('remove-failed-operation', async (event, sessionId, outputPath) => {
    try {
      const prefs = await loadPreferences();
      const updated = removeFailedOperation(prefs, sessionId, outputPath);
      await savePreferences(updated);
      return { success: true };
    } catch (error) {
      logger.error('Error removing failed operation', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('get-failed-operations', async () => {
    try {
      const prefs = await loadPreferences();
      return getFailedOperations(prefs);
    } catch (error) {
      logger.error('Error getting failed operations', { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('clear-failed-operations', async () => {
    try {
      const prefs = await loadPreferences();
      const updated = clearFailedOperations(prefs);
      await savePreferences(updated);
      return { success: true };
    } catch (error) {
      logger.error('Error clearing failed operations', { error: error.message });
      throw error;
    }
  });
}

module.exports = { registerSDCardIpcHandlers };
