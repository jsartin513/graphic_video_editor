const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFileMetadata: (filePath) => ipcRenderer.invoke('get-file-metadata', filePath),
  processDroppedPaths: (paths) => ipcRenderer.invoke('process-dropped-paths', paths),
  analyzeVideos: (filePaths) => ipcRenderer.invoke('analyze-videos', filePaths),
  getVideoDuration: (filePath) => ipcRenderer.invoke('get-video-duration', filePath),
  getVideoMetadata: (videoPath) => ipcRenderer.invoke('get-video-metadata', videoPath),
  generateThumbnail: (videoPath, timestamp) => ipcRenderer.invoke('generate-thumbnail', videoPath, timestamp),
  getTotalFileSize: (filePaths) => ipcRenderer.invoke('get-total-file-size', filePaths),
  mergeVideos: (filePaths, outputPath, qualityOption, format) => ipcRenderer.invoke('merge-videos', filePaths, outputPath, qualityOption, format),
  setPreferredFormat: (format) => ipcRenderer.invoke('set-preferred-format', format),
  splitVideo: (videoPath, splits, outputDir) => ipcRenderer.invoke('split-video', videoPath, splits, outputDir),
  trimVideo: (options) => ipcRenderer.invoke('trim-video', options),
  getOutputDirectory: (inputPath) => ipcRenderer.invoke('get-output-directory', inputPath),
  selectOutputDestination: () => ipcRenderer.invoke('select-output-destination'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getTestVideosPath: () => ipcRenderer.invoke('get-test-videos-path'),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  installPrerequisites: () => ipcRenderer.invoke('install-prerequisites'),
  mapError: (error) => ipcRenderer.invoke('map-error', error),
  onPrerequisitesMissing: (callback) => {
    ipcRenderer.on('prerequisites-missing', (event, data) => callback(data));
  },
  removePrerequisitesListener: () => {
    ipcRenderer.removeAllListeners('prerequisites-missing');
  },
  onMergeProgress: (callback) => {
    ipcRenderer.on('merge-progress', (event, data) => callback(data));
  },
  removeMergeProgressListener: () => {
    ipcRenderer.removeAllListeners('merge-progress');
  },
  // Preferences API
  loadPreferences: () => ipcRenderer.invoke('load-preferences'),
  savePreferences: (preferences) => ipcRenderer.invoke('save-preferences', preferences),
  saveFilenamePattern: (pattern) => ipcRenderer.invoke('save-filename-pattern', pattern),
  savePatternsFromSelectedFiles: (filePaths) => ipcRenderer.invoke('save-patterns-from-selected-files', filePaths),
  setDateFormat: (format) => ipcRenderer.invoke('set-date-format', format),
  applyDateTokens: (pattern, dateStr, dateFormat) => ipcRenderer.invoke('apply-date-tokens', pattern, dateStr, dateFormat),
  // Recent directories API
  addRecentDirectory: (dirPath) => ipcRenderer.invoke('add-recent-directory', dirPath),
  pinDirectory: (dirPath) => ipcRenderer.invoke('pin-directory', dirPath),
  unpinDirectory: (dirPath) => ipcRenderer.invoke('unpin-directory', dirPath),
  clearRecentDirectories: () => ipcRenderer.invoke('clear-recent-directories'),
  cleanupDirectories: () => ipcRenderer.invoke('cleanup-directories'),
  openRecentDirectory: (dirPath) => ipcRenderer.invoke('open-recent-directory', dirPath),
  setPreferredQuality: (quality) => ipcRenderer.invoke('set-preferred-quality', quality),
  setLastOutputDestination: (destination) => ipcRenderer.invoke('set-last-output-destination', destination),
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
  },
  // Logger API
  getLogs: (filename, maxLines) => ipcRenderer.invoke('get-logs', filename, maxLines),
  getLogFiles: () => ipcRenderer.invoke('get-log-files'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  exportLogs: (destinationPath) => ipcRenderer.invoke('export-logs', destinationPath),
  getDebugMode: () => ipcRenderer.invoke('get-debug-mode'),
  setDebugMode: (enabled) => ipcRenderer.invoke('set-debug-mode', enabled),
  // Error recovery API
  addFailedOperation: (operation) => ipcRenderer.invoke('add-failed-operation', operation),
  removeFailedOperation: (sessionId, outputPath) => ipcRenderer.invoke('remove-failed-operation', sessionId, outputPath),
  getFailedOperations: () => ipcRenderer.invoke('get-failed-operations'),
  clearFailedOperations: () => ipcRenderer.invoke('clear-failed-operations')
});

