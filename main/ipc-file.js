const { app, ipcMain } = require('electron');
const { showOpenDialog } = require('./dialog-utils');
const { chooseFiles, chooseFolder } = require('./mac-open-panel');
const { pickFilesWeb, pickFolderWeb } = require('./web-file-picker');
const path = require('path');
const fs = require('fs').promises;

const { formatFileSize } = require('../src/main-utils');
const { logger } = require('../src/logger');
const { scanDirectoryForVideos, VIDEO_EXTENSIONS } = require('../src/video-scanner');
const { loadPreferences, savePreferences, addRecentDirectory } = require('../src/preferences');
const { listDirectory, listVolumes, getBrowserRoots } = require('../src/directory-lister');

const FILE_DIALOG_OPTIONS = {
  properties: ['openFile', 'multiSelections'],
  filters: [
    { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'MP4', 'MOV', 'AVI', 'MKV', 'M4V'] },
    { name: 'All Files', extensions: ['*'] }
  ],
  title: 'Select Video Files'
};

async function pickFiles(getMainWindow) {
  if (process.platform === 'darwin') {
    try {
      logger.info('pickFiles: trying macOS open panel (AppleScript)');
      const panel = await chooseFiles('Select Video Files');
      if (!panel.canceled) {
        return panel;
      }
      logger.info('pickFiles: AppleScript panel canceled');
      return panel;
    } catch (error) {
      logger.warn('pickFiles: AppleScript panel failed', { error: error.message });
    }
  }

  logger.info('pickFiles: opening electron file dialog');
  try {
    return await showOpenDialog(getMainWindow(), FILE_DIALOG_OPTIONS);
  } catch (error) {
    if (process.platform !== 'darwin') throw error;
    logger.warn('pickFiles: electron dialog failed, trying web-file-picker', { error: error.message });
    return pickFilesWeb(getMainWindow);
  }
}

async function pickFolder(getMainWindow, title) {
  if (process.platform === 'darwin') {
    try {
      logger.info('pickFolder: trying macOS folder panel (AppleScript)');
      const panel = await chooseFolder(title);
      if (!panel.canceled) {
        return panel;
      }
      logger.info('pickFolder: AppleScript panel canceled');
      return panel;
    } catch (error) {
      logger.warn('pickFolder: AppleScript panel failed', { error: error.message });
    }
  }

  logger.info('pickFolder: opening electron folder dialog');
  const folderOptions = { properties: ['openDirectory'], title };
  try {
    return await showOpenDialog(getMainWindow(), folderOptions);
  } catch (error) {
    if (process.platform !== 'darwin') throw error;
    logger.warn('pickFolder: electron dialog failed, trying web-file-picker', { error: error.message });
    return pickFolderWeb(getMainWindow);
  }
}

/**
 * Register IPC handlers related to file and folder selection, metadata, and dropped paths.
 * @param {() => BrowserWindow|null} getMainWindow - function returning the current main window
 */
function registerFileIpcHandlers(getMainWindow) {
  ipcMain.on('native-file-drop', (event, paths) => {
    logger.info('native-file-drop', { count: Array.isArray(paths) ? paths.length : 0 });
    event.sender.send('native-file-drop', paths);
  });

  ipcMain.handle('list-directory', async (event, dirPath) => {
    logger.info('list-directory', { dirPath });
    try {
      const listing = await listDirectory(dirPath);
      logger.debug('list-directory: ok', {
        path: listing.path,
        entryCount: listing.entries?.length ?? 0
      });
      return listing;
    } catch (error) {
      logger.warn('list-directory: failed', { dirPath, error: error.message });
      throw error;
    }
  });

  ipcMain.handle('get-file-browser-roots', async () => {
    const prefs = await loadPreferences();
    const recents = []
      .concat(prefs.pinnedDirectories || [], prefs.recentDirectories || [])
      .map((item) => (typeof item === 'string' ? item : item?.path))
      .filter(Boolean);
    return {
      roots: getBrowserRoots({
        home: app.getPath('home'),
        desktop: app.getPath('desktop'),
        documents: app.getPath('documents'),
        videos: app.getPath('videos'),
        downloads: app.getPath('downloads')
      }),
      recents,
      volumes: await listVolumes()
    };
  });

  ipcMain.handle('select-files', async () => {
    const result = await pickFiles(getMainWindow);

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true, files: [] };
    }

    if (result.filePaths.length > 0) {
      const dirPath = path.dirname(result.filePaths[0]);
      try {
        const prefs = await loadPreferences();
        const updated = addRecentDirectory(prefs, dirPath);
        await savePreferences(updated);
      } catch (error) {
        logger.warn('Error tracking recent directory', { error: error.message });
      }
    }

    return { canceled: false, files: result.filePaths };
  });

  ipcMain.handle('select-folder', async () => {
    const result = await pickFolder(getMainWindow, 'Select Folder with Video Files');

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true, files: [] };
    }

    if (result.filePaths.length > 0) {
      try {
        const prefs = await loadPreferences();
        const updated = addRecentDirectory(prefs, result.filePaths[0]);
        await savePreferences(updated);
      } catch (error) {
        logger.warn('Error tracking recent directory', { error: error.message });
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
    logger.info('process-dropped-paths', { count: Array.isArray(paths) ? paths.length : 0 });
    if (!Array.isArray(paths)) return { files: videoFiles };

    for (const droppedPath of paths) {
      if (typeof droppedPath !== 'string' || !droppedPath.trim()) continue;
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
            logger.warn('Error tracking recent directory', { error: error.message });
          }
        } else if (stats.isFile()) {
          const ext = path.extname(droppedPath).toLowerCase();
          if (VIDEO_EXTENSIONS.includes(ext)) {
            videoFiles.push(droppedPath);
            const dirPath = path.dirname(droppedPath);
            try {
              const prefs = await loadPreferences();
              const updated = addRecentDirectory(prefs, dirPath);
              await savePreferences(updated);
            } catch (error) {
              logger.warn('Error tracking recent directory', { error: error.message });
            }
          }
        }
      } catch (error) {
        logger.error('Error processing dropped path', { droppedPath, error: error.message });
      }
    }

    logger.info('process-dropped-paths: done', { videoCount: videoFiles.length });
    return { files: videoFiles };
  });

  // Open a recent directory and scan for video files
  ipcMain.handle('open-recent-directory', async (event, dirPath) => {
    if (!dirPath || typeof dirPath !== 'string' || !dirPath.trim()) {
      throw new Error('Invalid directory path');
    }
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
              const ext = path.extname(entry.name).toLowerCase();
              if (VIDEO_EXTENSIONS.includes(ext)) {
                videoFiles.push(fullPath);
              }
            }
          }
        } catch (error) {
          logger.warn('Error scanning directory', { scanDirPath, error: error.message });
        }
      }

      await scanDirectory(dirPath);

      return { success: true, files: videoFiles };
    } catch (error) {
      logger.error('Error opening recent directory', { dirPath, error: error.message });
      throw error;
    }
  });
}

module.exports = {
  registerFileIpcHandlers,
  pickFiles,
  pickFolder
};
