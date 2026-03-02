const { dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const { formatFileSize } = require('../src/main-utils');
const { logger } = require('../src/logger');
const { scanDirectoryForVideos, VIDEO_EXTENSIONS } = require('../src/video-scanner');
const { loadPreferences, savePreferences, addRecentDirectory } = require('../src/preferences');

/**
 * Register IPC handlers related to file and folder selection, metadata, and dropped paths.
 * @param {() => BrowserWindow|null} getMainWindow - function returning the current main window
 */
function registerFileIpcHandlers(getMainWindow) {
  // Handle file selection dialog
  ipcMain.handle('select-files', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'MP4', 'MOV', 'AVI', 'MKV', 'M4V'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Select Video Files'
    });

    if (result.canceled) {
      return { canceled: true, files: [] };
    }

    if (result.filePaths.length > 0) {
      const dirPath = path.dirname(result.filePaths[0]);
      try {
        const prefs = await loadPreferences();
        const updated = addRecentDirectory(prefs, dirPath);
        await savePreferences(updated);
      } catch (error) {
        console.error('Error tracking recent directory:', error);
      }
    }

    return { canceled: false, files: result.filePaths };
  });

  // Handle folder selection dialog
  ipcMain.handle('select-folder', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Folder with Video Files'
    });

    if (result.canceled) {
      return { canceled: true, files: [] };
    }

    if (result.filePaths.length > 0) {
      try {
        const prefs = await loadPreferences();
        const updated = addRecentDirectory(prefs, result.filePaths[0]);
        await savePreferences(updated);
      } catch (error) {
        console.error('Error tracking recent directory:', error);
      }
    }

    const videoFiles = result.filePaths.length > 0
      ? await scanDirectoryForVideos(result.filePaths[0])
      : [];

    return { canceled: false, files: videoFiles };
  });

  // Handle getting file metadata
  ipcMain.handle('get-file-metadata', async (event, filePath) => {
    if (!filePath || typeof filePath !== 'string') {
      logger.error('Error getting file metadata: invalid filePath', { type: typeof filePath });
      return null;
    }

    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        modified: stats.mtime
      };
    } catch (error) {
      logger.error('Error getting file metadata', { filePath, error: error.message });
      return null;
    }
  });

  // Handle processing dropped files/folders
  ipcMain.handle('process-dropped-paths', async (event, paths) => {
    const videoFiles = [];

    for (const droppedPath of paths) {
      try {
        const stats = await fs.stat(droppedPath);
        if (stats.isDirectory()) {
          const files = await scanDirectoryForVideos(droppedPath);
          videoFiles.push(...files);

          try {
            const prefs = await loadPreferences();
            const updated = addRecentDirectory(prefs, droppedPath);
            await savePreferences(updated);
          } catch (error) {
            console.error('Error tracking recent directory:', error);
          }
        } else if (stats.isFile()) {
          const ext = path.extname(droppedPath);
          if (VIDEO_EXTENSIONS.includes(ext)) {
            videoFiles.push(droppedPath);
            const dirPath = path.dirname(droppedPath);
            try {
              const prefs = await loadPreferences();
              const updated = addRecentDirectory(prefs, dirPath);
              await savePreferences(updated);
            } catch (error) {
              console.error('Error tracking recent directory:', error);
            }
          }
        }
      } catch (error) {
        logger.error('Error processing dropped path', { droppedPath, error: error.message });
      }
    }

    return videoFiles;
  });

  // Open a recent directory and scan for video files
  ipcMain.handle('open-recent-directory', async (event, dirPath) => {
    try {
      await fs.access(dirPath);

      const prefs = await loadPreferences();
      const updated = addRecentDirectory(prefs, dirPath);
      await savePreferences(updated);

      const videoFiles = [];

      async function scanDirectory(scanDirPath) {
        try {
          const entries = await fs.readdir(scanDirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(scanDirPath, entry.name);

            if (entry.isDirectory()) {
              await scanDirectory(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name);
              if (VIDEO_EXTENSIONS.includes(ext)) {
                videoFiles.push(fullPath);
              }
            }
          }
        } catch (error) {
          console.error(`Error scanning directory ${scanDirPath}:`, error);
        }
      }

      await scanDirectory(dirPath);

      return { success: true, files: videoFiles };
    } catch (error) {
      console.error('Error opening recent directory:', error);
      throw error;
    }
  });
}

module.exports = {
  registerFileIpcHandlers
};

