const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fsSync = require('fs');

const { logger } = require('./src/logger');
const { checkFFmpeg } = require('./src/ffmpeg-resolver');
const { loadPreferences, savePreferences, addSDCardPath } = require('./src/preferences');
const { registerFileIpcHandlers } = require('./main/ipc-file');
const { registerPreferenceIpcHandlers } = require('./main/ipc-preferences');
const { registerVideoIpcHandlers } = require('./main/ipc-video');
const { registerMergeSplitIpcHandlers } = require('./main/ipc-merge-split');
const { registerMiscIpcHandlers } = require('./main/ipc-misc');
const { registerUpdatesIpcHandlers, hasUpdateFeed } = require('./main/ipc-updates');
const { registerLoggerIpcHandlers } = require('./main/ipc-logger');
const { registerSDCardIpcHandlers } = require('./main/ipc-sd-card');
const { SDCardDetector } = require('./src/sd-card-detector');

let mainWindow;
let sdCardDetector = null;

// Icon path constant (used in both development and production)
const ICON_PATH = path.join(__dirname, 'build', 'icons', 'icon.icns');

// Set app icon for development (will be overridden by electron-builder in production)
function setupAppIcon() {
  const iconPath = ICON_PATH;
  if (fsSync.existsSync(iconPath)) {
    try {
      const icon = nativeImage.createFromPath(iconPath);
      app.dock.setIcon(icon); // macOS Dock icon
      // Note: BrowserWindow icon is set in createWindow
    } catch (error) {
      logger.warn('Could not set app icon', { error: error.message });
    }
  }
}

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  // Set window icon if available
  let windowIcon = null;
  const iconPath = ICON_PATH;
  if (fsSync.existsSync(iconPath)) {
    try {
      windowIcon = nativeImage.createFromPath(iconPath);
    } catch (error) {
      logger.warn('Could not load window icon', { error: error.message });
    }
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: 'Video Merger',
    icon: windowIcon, // Set window icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Default sandbox strips File.path from Finder drops on recent Electron.
      sandbox: false
    },
    backgroundColor: '#ffffff',
    titleBarStyle: 'default',
    frame: true
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
    }
  });

  // Open DevTools in development (remove in production)
  // mainWindow.webContents.openDevTools();
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  if (mainWindow) mainWindow.webContents.send('update-checking');
});
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', { ...info, currentVersion: app.getVersion() });
  }
});
autoUpdater.on('update-not-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-not-available', info);
});
autoUpdater.on('error', (err) => {
  const message = err && err.message ? err.message : String(err);
  logger.error('Auto-updater error', { error: message });
  // Missing publish metadata, network blips, and unsigned local builds should
  // not surface a scary banner — friends still get a usable app.
  if (isIgnorableUpdateError(message)) {
    return;
  }
  if (mainWindow) mainWindow.webContents.send('update-error', message);
});
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('update-download-progress', progressObj);
});
autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', { ...info, currentVersion: app.getVersion() });
  }
});

app.whenReady().then(async () => {
  await logger.initialize();
  let prefs = {};
  try {
    prefs = await loadPreferences();
    if (prefs.debugMode) logger.setDebugMode(true);
  } catch (error) {
    logger.error('Failed to load preferences for logger', { error: error.message });
  }
  logger.info('Application started');
  setupAppIcon();
  createWindow();

  registerFileIpcHandlers(() => mainWindow);
  registerPreferenceIpcHandlers();
  registerVideoIpcHandlers();
  registerMergeSplitIpcHandlers(() => mainWindow);
  registerMiscIpcHandlers();
  registerUpdatesIpcHandlers();
  registerLoggerIpcHandlers();
  registerSDCardIpcHandlers(
    () => sdCardDetector,
    (v) => { sdCardDetector = v; },
    () => initializeSDCardDetection()
  );

  // Check prerequisites after window is ready
  setTimeout(() => {
    checkPrerequisites();
  }, 500);

  if (app.isPackaged && hasUpdateFeed()) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        logger.error('Failed to check for updates', { error: err.message });
      });
    }, 3000);
  } else if (app.isPackaged) {
    logger.info('Skipping auto-update check (no app-update.yml publish metadata)');
  }
  await initializeSDCardDetection();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setTimeout(() => {
        checkPrerequisites();
      }, 500);
      initializeSDCardDetection();
    }
  });
});

function isIgnorableUpdateError(message) {
  return /404|not found|latest-mac|app-update\.yml|Unable to find published|Cannot check for updates|ENOTFOUND|ECONNREFUSED|net::ERR_|code signature|not signed/i.test(message || '');
}

// Check if ffmpeg is installed
async function checkPrerequisites() {
  try {
    const result = await checkFFmpeg();
    if (!result.installed) {
      mainWindow.webContents.send('prerequisites-missing', result);
    }
  } catch (error) {
    logger.error('Error checking prerequisites', { error: error.message });
  }
}

app.on('window-all-closed', () => {
  // Stop SD card detection and clear reference so it can be restarted on activate
  if (sdCardDetector) {
    sdCardDetector.stop();
    sdCardDetector = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Misc, updates, logger, SD card IPC handlers live in main/ipc-*.js

// SD Card Detection (lifecycle - stays in main)
/**
 * Initialize SD card detection
 */
async function initializeSDCardDetection() {
  if (process.platform !== 'darwin') {
    return;
  }
  try {
    const prefs = await loadPreferences();
    
    // Only initialize if auto-detect is enabled
    if (prefs.autoDetectSDCards) {
      sdCardDetector = new SDCardDetector();
      
      // Listen for SD card detection events
      sdCardDetector.on('sd-card-detected', async (sdCard) => {
        console.log('[SD Card] Detected:', sdCard.name);
        
        // Save to preferences
        const currentPrefs = await loadPreferences();
        const updatedPrefs = addSDCardPath(currentPrefs, sdCard.path);
        await savePreferences(updatedPrefs);
        
        // Notify renderer if notifications are enabled
        if (currentPrefs.showSDCardNotifications && mainWindow) {
          mainWindow.webContents.send('sd-card-detected', sdCard);
        }
      });
      
      sdCardDetector.on('sd-card-removed', (sdCard) => {
        console.log('[SD Card] Removed:', sdCard.name);
        if (mainWindow) {
          mainWindow.webContents.send('sd-card-removed', sdCard);
        }
      });
      
      // Start monitoring
      sdCardDetector.start();
      
      console.log('[SD Card] Auto-detection initialized');
    }
  } catch (error) {
    console.error('[SD Card] Error initializing detection:', error);
  }
}

