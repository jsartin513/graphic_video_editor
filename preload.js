const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFileMetadata: (filePath) => ipcRenderer.invoke('get-file-metadata', filePath),
  processDroppedPaths: (paths) => ipcRenderer.invoke('process-dropped-paths', paths),
  analyzeVideos: (filePaths) => ipcRenderer.invoke('analyze-videos', filePaths),
  getVideoDuration: (filePath) => ipcRenderer.invoke('get-video-duration', filePath),
  mergeVideos: (filePaths, outputPath) => ipcRenderer.invoke('merge-videos', filePaths, outputPath),
  splitVideo: (videoPath, splits, outputDir) => ipcRenderer.invoke('split-video', videoPath, splits, outputDir),
  getOutputDirectory: (inputPath) => ipcRenderer.invoke('get-output-directory', inputPath),
  selectOutputDestination: () => ipcRenderer.invoke('select-output-destination'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  getTestVideosPath: () => ipcRenderer.invoke('get-test-videos-path'),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  installPrerequisites: () => ipcRenderer.invoke('install-prerequisites'),
  onPrerequisitesMissing: (callback) => {
    ipcRenderer.on('prerequisites-missing', (event, data) => callback(data));
  },
  removePrerequisitesListener: () => {
    ipcRenderer.removeAllListeners('prerequisites-missing');
  },
  // Preferences API
  loadPreferences: () => ipcRenderer.invoke('load-preferences'),
  savePreferences: (preferences) => ipcRenderer.invoke('save-preferences', preferences),
  saveFilenamePattern: (pattern) => ipcRenderer.invoke('save-filename-pattern', pattern),
  setDateFormat: (format) => ipcRenderer.invoke('set-date-format', format),
  applyDateTokens: (pattern, dateStr, dateFormat) => ipcRenderer.invoke('apply-date-tokens', pattern, dateStr, dateFormat),
  // SD Card Detection API
  getGoProSDCards: () => ipcRenderer.invoke('get-gopro-sd-cards'),
  openSDCardDirectory: (sdCardPath) => ipcRenderer.invoke('open-sd-card-directory', sdCardPath),
  loadSDCardFiles: (sdCardPath) => ipcRenderer.invoke('load-sd-card-files', sdCardPath),
  setAutoDetectSDCards: (enabled) => ipcRenderer.invoke('set-auto-detect-sd-cards', enabled),
  setShowSDCardNotifications: (enabled) => ipcRenderer.invoke('set-show-sd-card-notifications', enabled),
  onSDCardDetected: (callback) => {
    ipcRenderer.on('sd-card-detected', (event, data) => callback(data));
  },
  onSDCardRemoved: (callback) => {
    ipcRenderer.on('sd-card-removed', (event, data) => callback(data));
  },
  removeSDCardListeners: () => {
    ipcRenderer.removeAllListeners('sd-card-detected');
    ipcRenderer.removeAllListeners('sd-card-removed');
  }
});

