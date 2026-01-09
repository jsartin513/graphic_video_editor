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
  mergeVideos: (filePaths, outputPath, qualityOption) => ipcRenderer.invoke('merge-videos', filePaths, outputPath, qualityOption),
  splitVideo: (videoPath, splits, outputDir) => ipcRenderer.invoke('split-video', videoPath, splits, outputDir),
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
  setDateFormat: (format) => ipcRenderer.invoke('set-date-format', format),
  setPreferredQuality: (quality) => ipcRenderer.invoke('set-preferred-quality', quality),
  setLastOutputDestination: (destination) => ipcRenderer.invoke('set-last-output-destination', destination),
  applyDateTokens: (pattern, dateStr, dateFormat) => ipcRenderer.invoke('apply-date-tokens', pattern, dateStr, dateFormat)
});

