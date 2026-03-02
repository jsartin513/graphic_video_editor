const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const { formatFileSize } = require('./src/main-utils');

// Import logger
const { logger } = require('./src/logger');

// Import video scanner
const { scanDirectoryForVideos, VIDEO_EXTENSIONS } = require('./src/video-scanner');

let mainWindow;
let sdCardDetector = null;

const { getFFmpegPath, getFFprobePath, checkFFmpeg } = require('./src/ffmpeg-resolver');

// Process tracking for cancellation
let currentMergeProcess = null;
let currentMergeTempFile = null;
let currentMergeOutputPath = null; // Track output path for cleanup
let currentSplitProcesses = [];
let isCancelled = false;

// Icon path constant (used in both development and production)
const ICON_PATH = path.join(__dirname, 'build', 'icons', 'icon.icns');

const {
  QUALITY_COPY,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  QUALITY_SETTINGS,
  validateQualityOption
} = require('./src/quality-utils');

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
      nodeIntegration: false
    },
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset',
    frame: true
  });

  mainWindow.loadFile('renderer/index.html');

  // Open DevTools in development (remove in production)
  // mainWindow.webContents.openDevTools();
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  if (mainWindow) mainWindow.webContents.send('update-checking');
});
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    const packageJson = require('./package.json');
    mainWindow.webContents.send('update-available', { ...info, currentVersion: packageJson.version || '1.0.0' });
  }
});
autoUpdater.on('update-not-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-not-available', info);
});
autoUpdater.on('error', (err) => {
  if (mainWindow) mainWindow.webContents.send('update-error', err.message);
});
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('update-download-progress', progressObj);
});
autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    const packageJson = require('./package.json');
    mainWindow.webContents.send('update-downloaded', { ...info, currentVersion: packageJson.version || '1.0.0' });
  }
});

app.whenReady().then(async () => {
  await logger.initialize();
  try {
    const prefs = await loadPreferences();
    if (prefs.debugMode) logger.setDebugMode(true);
  } catch (error) {
    logger.error('Failed to load preferences for logger', { error: error.message });
  }
  logger.info('Application started');
  setupAppIcon();
  createWindow();
  
  // Check prerequisites after window is ready
  setTimeout(() => {
    checkPrerequisites();
  }, 500);

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        logger.error('Failed to check for updates', { error: err.message });
      });
    }, 3000);
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

// Handle file selection dialog
ipcMain.handle('select-files', async () => {
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

  // Track directory of first selected file
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
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder with Video Files'
  });

  if (result.canceled) {
    return { canceled: true, files: [] };
  }

  // Track selected folder
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
  // Validate filePath before processing
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
        // Track dropped directory
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
          // Track directory of dropped file
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

// Import video grouping functions
const { analyzeAndGroupVideos, derivePatternFromFilename } = require('./src/video-grouping');

// Import preferences module
const {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  applyDateTokens,
  addRecentDirectory,
  pinDirectory,
  unpinDirectory,
  clearRecentDirectories,
  cleanupDirectories,
  addSDCardPath,
  setAutoDetectSDCards,
  setShowSDCardNotifications,
  setPreferredQuality,
  setPreferredFormat,
  setLastOutputDestination,
  sanitizeFailedOperation,
  addFailedOperation,
  removeFailedOperation,
  getFailedOperations,
  clearFailedOperations
} = require('./src/preferences');

// Import error mapper module
const { mapError } = require('./src/error-mapper');

// Import SD Card Detector
const { SDCardDetector } = require('./src/sd-card-detector');

// Analyze and group video files by session ID and directory
// Files from different subdirectories with the same session ID are processed separately
ipcMain.handle('analyze-videos', async (event, filePaths) => {
  return analyzeAndGroupVideos(filePaths);
});

// Get video duration using ffprobe
ipcMain.handle('get-video-duration', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const ffprobeCmd = getFFprobePath();
    const ffprobe = spawn(ffprobeCmd, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { 
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    
    let output = '';
    let errorOutput = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    ffprobe.on('error', (error) => {
      // Handle case where ffprobe is not found
      if (error.code === 'ENOENT') {
        logger.error('ffprobe not found. Please install ffmpeg.');
        resolve(0); // Return 0 duration instead of failing
      } else {
        reject(error);
      }
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        // Don't fail completely, just return 0 duration
        logger.error('ffprobe failed', { filePath, errorOutput });
        resolve(0);
      }
    });
  });
});

// Get detailed video metadata using ffprobe
ipcMain.handle('get-video-metadata', async (event, videoPath) => {
  // Validate videoPath
  if (!videoPath || typeof videoPath !== 'string') {
    throw new Error('Invalid video path');
  }

  return new Promise((resolve, reject) => {
    const ffprobeCmd = getFFprobePath();
    const env = { ...process.env };
    if (ffprobeCmd.includes('.app/Contents/Resources')) {
      env.PATH = '/usr/bin:/bin';
    } else {
      env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
    }

    // Get comprehensive video metadata
    const ffprobe = spawn(ffprobeCmd, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ], { env });

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('ffprobe not found'));
      } else {
        reject(error);
      }
    });

    ffprobe.on('close', async (code) => {
      if (code === 0) {
        try {
          const metadata = JSON.parse(output);
          const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
          const format = metadata.format || {};

          // Helper function to safely parse frame rate fraction
          const parseFPS = (framerateStr) => {
            if (!framerateStr || typeof framerateStr !== 'string') return 0;
            const parts = framerateStr.split('/');
            if (parts.length === 2) {
              const numerator = parseFloat(parts[0]);
              const denominator = parseFloat(parts[1]);
              if (denominator !== 0 && !isNaN(numerator) && !isNaN(denominator)) {
                return numerator / denominator;
              }
              // Invalid fraction (e.g., denominator is 0 or NaN)
              return 0;
            }
            // Single number (no fraction)
            return parseFloat(framerateStr) || 0;
          };

          // Extract useful metadata
          const result = {
            duration: parseFloat(format.duration) || 0,
            size: parseInt(format.size) || 0,
            bitrate: parseInt(format.bit_rate) || 0,
            video: videoStream ? {
              codec: videoStream.codec_name || 'unknown',
              codecLongName: videoStream.codec_long_name || 'unknown',
              width: videoStream.width || 0,
              height: videoStream.height || 0,
              fps: parseFPS(videoStream.r_frame_rate), // e.g., "30/1" -> 30
              bitrate: parseInt(videoStream.bit_rate) || 0,
              pixelFormat: videoStream.pix_fmt || 'unknown'
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name || 'unknown',
              codecLongName: audioStream.codec_long_name || 'unknown',
              sampleRate: parseInt(audioStream.sample_rate) || 0,
              channels: audioStream.channels || 0,
              bitrate: parseInt(audioStream.bit_rate) || 0
            } : null,
            container: format.format_name || 'unknown'
          };

          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
      }
    });
  });
});

// Generate thumbnail for a video file
ipcMain.handle('generate-thumbnail', async (event, videoPath, timestamp = 1) => {
  // Validate videoPath
  if (!videoPath || typeof videoPath !== 'string') {
    throw new Error('Invalid video path');
  }
  
  try {
    // Check if thumbnail cache directory exists, create if not
    const os = require('os');
    const cacheDir = path.join(os.tmpdir(), 'video-merger-thumbnails');
    await fs.mkdir(cacheDir, { recursive: true });
    
    // Create a cache key based on file path, size, and mtime
    const stats = await fs.stat(videoPath);
    const cacheKey = require('crypto')
      .createHash('md5')
      .update(`${videoPath}-${stats.size}-${stats.mtime.getTime()}-${timestamp}`)
      .digest('hex');
    
    const thumbnailPath = path.join(cacheDir, `${cacheKey}.jpg`);
    
    // Check if thumbnail already exists
    try {
      await fs.access(thumbnailPath);
      // Thumbnail exists, return as data URL
      const imageData = await fs.readFile(thumbnailPath);
      return `data:image/jpeg;base64,${imageData.toString('base64')}`;
    } catch {
      // Thumbnail doesn't exist, generate it
    }
    
    // Generate thumbnail using ffmpeg
    const ffmpegCmd = getFFmpegPath();
    const env = { ...process.env };
    if (ffmpegCmd.includes('.app/Contents/Resources')) {
      env.PATH = '/usr/bin:/bin';
    } else {
      env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
    }
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegCmd, [
        '-ss', timestamp.toString(), // Seek to timestamp
        '-i', videoPath,
        '-vframes', '1', // Extract 1 frame
        '-vf', 'scale=320:-1', // Scale to width 320, maintain aspect ratio
        '-q:v', '2', // High quality
        '-f', 'image2', // Output format
        '-y', // Overwrite output file
        thumbnailPath
      ], { env });
      
      let errorOutput = '';
      
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ffmpeg.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('ffmpeg not found'));
        } else {
          reject(error);
        }
      });
      
      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            // Read the generated thumbnail and return as data URL
            const imageData = await fs.readFile(thumbnailPath);
            const dataUrl = `data:image/jpeg;base64,${imageData.toString('base64')}`;
            resolve(dataUrl);
          } catch (error) {
            reject(new Error(`Failed to read generated thumbnail: ${error.message}`));
          }
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
        }
      });
    });
  } catch (error) {
    console.error(`Error generating thumbnail for ${videoPath}:`, error);
    throw error;
  }
});

/**
 * Get total file size for multiple files
 * @param {Event} event - IPC event (required by Electron IPC handler signature, not used)
 * @param {string[]} filePaths - Array of file paths to calculate total size for
 * @returns {Promise<{totalBytes: number, totalSizeFormatted: string}>} Object with total bytes and formatted string
 * @throws {Error} If all files fail to stat
 */
ipcMain.handle('get-total-file-size', async (event, filePaths) => {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { totalBytes: 0, totalSizeFormatted: '0 Bytes' };
  }
  
  let totalBytes = 0;
  const errors = [];
  
  for (const filePath of filePaths) {
    try {
      const stats = await fs.stat(filePath);
      totalBytes += stats.size;
    } catch (error) {
      console.error(`Error getting file size for ${filePath}:`, error);
      errors.push(filePath);
    }
  }
  
  if (errors.length > 0 && errors.length === filePaths.length) {
    // All files failed
    throw new Error(`Could not get file sizes for any of the ${filePaths.length} files`);
  }
  
  return {
    totalBytes,
    totalSizeFormatted: formatFileSize(totalBytes)
  };
});

// Merge videos using ffmpeg
ipcMain.handle('merge-videos', async (event, filePaths, outputPath, qualityOption = 'copy', format = 'mp4', normalizeAudio = false) => {
  return new Promise((resolve, reject) => {
    // Validate quality option
    try {
      validateQualityOption(qualityOption);
    } catch (error) {
      reject(error);
      return;
    }
    // Reset cancellation flag and track output path for cleanup
    isCancelled = false;
    currentMergeOutputPath = outputPath;

    // Filter out macOS metadata files (starting with ._)
    const validFilePaths = filePaths.filter(filePath => {
      const filename = path.basename(filePath);
      return !filename.startsWith('._');
    });
    
    if (validFilePaths.length === 0) {
      reject(new Error('No valid video files found (all files appear to be macOS metadata files)'));
      return;
    }
    
    // Create temporary file list
    const tempFileList = path.join(path.dirname(outputPath), `filelist_${Date.now()}.txt`);
    currentMergeTempFile = tempFileList;
    const fileListContent = validFilePaths.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    
    fs.writeFile(tempFileList, fileListContent, 'utf8')
      .then(() => {
        const ffmpegCmd = getFFmpegPath();
        logger.debug('merge-videos: Using ffmpeg', { ffmpegCmd });
        
        // When using bundled binary, we should not need PATH, but limit it to avoid finding system binaries
        const env = { ...process.env };
        if (ffmpegCmd.includes('.app/Contents/Resources')) {
          // Bundled binary - remove system PATH to avoid confusion
          env.PATH = '/usr/bin:/bin';
        } else {
          // System binary - keep original PATH
          env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
        }

        logger.debug('merge-videos: File list preview', {
          preview: fileListContent.substring(0, 500),
          fileCount: validFilePaths.length
        });
        logger.debug('merge-videos: Output path', { outputPath });
        logger.debug('merge-videos: Quality option', { qualityOption });

        // Normalize format to lowercase for consistent comparisons
        const normalizedFormat = (typeof format === 'string' ? format : 'mp4').toLowerCase();

        // Build ffmpeg command based on quality option and format
        const ffmpegArgs = [
          '-f', 'concat',
          '-safe', '0',
          '-i', tempFileList
        ];

        // Map format to ffmpeg muxer (if needed, otherwise auto-detect from extension)
        const formatMuxers = {
          'mp4': 'mp4',
          'mov': 'mov',
          'mkv': 'matroska',
          'avi': 'avi',
          'm4v': 'mp4' // M4V uses same muxer as MP4
        };

        // Ensure output path has correct extension
        const outputExt = path.extname(outputPath).toLowerCase().slice(1);
        if (outputExt !== normalizedFormat) {
          const basePath = outputPath.replace(/\.[^/.]+$/, '');
          outputPath = basePath + '.' + normalizedFormat;
        }

        // Add format muxer if not MP4 (MP4 is default)
        if (normalizedFormat !== 'mp4' && formatMuxers[normalizedFormat]) {
          ffmpegArgs.push('-f', formatMuxers[normalizedFormat]);
        }

        if (qualityOption === QUALITY_COPY) {
          // Fast copy mode (no re-encoding)
          if (normalizeAudio) {
            ffmpegArgs.push(
              '-c:v', 'copy',
              '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
              '-c:a', 'aac',
              '-b:a', '192k'
            );
          } else {
            ffmpegArgs.push('-c', 'copy');
          }
        } else {
          // Re-encode with quality settings
          const settings = QUALITY_SETTINGS[qualityOption];

          // Video codec settings (H.264 for maximum compatibility)
          ffmpegArgs.push(
            '-c:v', 'libx264',
            '-crf', settings.crf,
            '-preset', settings.preset
          );
          if (normalizeAudio) {
            ffmpegArgs.push(
              '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
              '-c:a', 'aac',
              '-b:a', '192k'
            );
          } else {
            // Audio codec - AAC for MP4/MOV/M4V, MP3 for others
            if (['mp4', 'mov', 'm4v'].includes(normalizedFormat)) {
              ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
            } else {
              ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', '192k');
            }
          }
        }

        ffmpegArgs.push('-y', outputPath);

        const ffmpeg = spawn(ffmpegCmd, ffmpegArgs, { 
          env
        });
        
        // Track the current merge process for cancellation
        currentMergeProcess = ffmpeg;
        
        let errorOutput = '';
        let stdoutOutput = '';
        let hasTimedOut = false;
        
        // Set a timeout for the merge operation (5 minutes max)
        const timeout = setTimeout(() => {
          hasTimedOut = true;
          ffmpeg.kill('SIGTERM');
          logger.error('merge-videos: FFmpeg operation timed out after 5 minutes');
          reject(new Error('FFmpeg operation timed out. The merge may have failed or is taking too long.'));
        }, 5 * 60 * 1000);
        
        ffmpeg.stdout.on('data', (data) => {
          stdoutOutput += data.toString();
        });
        
        // Track progress state
        let totalDuration = null; // Will be set if provided, otherwise calculated from video files
        ffmpeg.startTime = Date.now();
        
        // Calculate total duration from input files (non-blocking, runs in background)
        (async () => {
          try {
            const durationPromises = validFilePaths.map(async (filePath) => {
              try {
                return await new Promise((resolve) => {
                  const ffprobeCmd = getFFprobePath();
                  const ffprobe = spawn(ffprobeCmd, [
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    filePath
                  ], {
                    env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
                  });
                  
                  let output = '';
                  ffprobe.stdout.on('data', (data) => { output += data.toString(); });
                  ffprobe.on('close', (code) => {
                    if (code === 0) {
                      const dur = parseFloat(output.trim());
                      resolve(isNaN(dur) ? 0 : dur);
                    } else {
                      resolve(0);
                    }
                  });
                  ffprobe.on('error', () => resolve(0));
                });
              } catch {
                return 0;
              }
            });
            
            const durations = await Promise.all(durationPromises);
            totalDuration = durations.reduce((sum, d) => sum + d, 0);
            if (totalDuration > 0) {
              console.log(`[merge-videos] Total estimated duration: ${totalDuration.toFixed(2)} seconds`);
            }
          } catch (err) {
            console.log('[merge-videos] Could not calculate total duration, progress will show time only');
          }
        })();

        ffmpeg.stderr.on('data', (data) => {
          const output = data.toString();
          errorOutput += output;
          logger.debug('merge-videos: FFmpeg stderr', { output: output.trim() });

          // Check for cancellation during processing (faster detection)
          if (isCancelled) {
            ffmpeg.kill('SIGTERM');
            return;
          }

          // Parse time from FFmpeg output: time=00:00:05.00
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
          if (timeMatch && mainWindow) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;

            let percent = null;
            if (totalDuration !== null && totalDuration > 0) {
              percent = Math.min((currentTime / totalDuration) * 100, 100);
            }
            
            const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;

            let eta = null;
            let etaStr = null;
            if (percent !== null && percent > 0 && percent < 100 && totalDuration > 0) {
              const elapsed = (Date.now() - ffmpeg.startTime) / 1000;
              if (elapsed > 0 && currentTime > 0) {
                const rate = currentTime / elapsed;
                if (rate > 0) {
                  const remaining = totalDuration - currentTime;
                  eta = Math.round(remaining / rate);
                  const etaHours = Math.floor(eta / 3600);
                  const etaMinutes = Math.floor((eta % 3600) / 60);
                  const etaSeconds = eta % 60;
                  if (etaHours > 0) {
                    etaStr = `${etaHours}:${etaMinutes.toString().padStart(2, '0')}:${etaSeconds.toString().padStart(2, '0')}`;
                  } else {
                    etaStr = `${etaMinutes}:${etaSeconds.toString().padStart(2, '0')}`;
                  }
                }
              }
            }
            
            mainWindow.webContents.send('merge-progress', {
              currentTime,
              totalDuration: totalDuration || 0,
              percent,
              timeStr,
              eta,
              etaStr
            });
          }
        });

        ffmpeg.on('error', (error) => {
          clearTimeout(timeout);
          // Clean up references
          currentMergeProcess = null;
          currentMergeTempFile = null;
          currentMergeOutputPath = null;
          // Clean up temp file after error
          fs.unlink(tempFileList).catch(() => {});
          logger.error('merge-videos: FFmpeg spawn error', { error: error.message });
          // Handle case where ffmpeg is not found
          if (error.code === 'ENOENT') {
            const mappedError = mapError('ffmpeg not found');
            const userFriendlyError = new Error(mappedError.userMessage);
            userFriendlyError.mappedError = mappedError;
            reject(userFriendlyError);
          } else {
            const mappedError = mapError(error);
            const userFriendlyError = new Error(mappedError.userMessage);
            userFriendlyError.mappedError = mappedError;
            reject(userFriendlyError);
          }
        });
        
        ffmpeg.on('close', (code) => {
          clearTimeout(timeout);
          
          // Clean up temp file and process reference (after process exits)
          const tempFile = currentMergeTempFile;
          const outputFile = currentMergeOutputPath;
          currentMergeProcess = null;
          currentMergeTempFile = null;
          currentMergeOutputPath = null;
          
          // Clean up temp file after process has exited
          if (tempFile) {
            fs.unlink(tempFile).catch(() => {});
          }
          
          if (hasTimedOut) {
            return; // Already rejected in timeout handler
          }

          // Check if operation was cancelled
          if (isCancelled) {
            if (outputFile) {
              fs.unlink(outputFile).catch((err) => {
                logger.debug('merge-videos: Could not clean up partial output', { err: err.message });
              });
            }
            reject(new Error('Operation cancelled by user'));
            return;
          }

          logger.debug('merge-videos: FFmpeg exited', { code });
          
          if (code === 0) {
            logger.info('merge-videos: Merge completed successfully', { outputPath });
            resolve({ success: true, outputPath });
          } else {
            logger.error('merge-videos: FFmpeg failed', { code, errorOutput });
            // Map error to user-friendly message
            const mappedError = mapError(`ffmpeg failed: ${errorOutput}`);
            const userFriendlyError = new Error(mappedError.userMessage);
            userFriendlyError.mappedError = mappedError;
            reject(userFriendlyError);
          }
        });
      })
      .catch(reject);
  });
});

// Cancel ongoing merge operation
ipcMain.handle('cancel-merge', async () => {
  return new Promise((resolve, reject) => {
    try {
      if (currentMergeProcess && !currentMergeProcess.killed) {
        console.log('[cancel-merge] Cancelling merge operation...');
        isCancelled = true;
        
        // Kill the ffmpeg process with SIGTERM (graceful shutdown)
        currentMergeProcess.kill('SIGTERM');
        
        // Set up fallback: if process doesn't exit within 2 seconds, force kill with SIGKILL
        const forceKillTimeout = setTimeout(() => {
          if (currentMergeProcess && !currentMergeProcess.killed) {
            console.log('[cancel-merge] Process did not exit gracefully, force killing...');
            currentMergeProcess.kill('SIGKILL');
          }
        }, 2000);
        
        // Clear timeout if process exits gracefully
        currentMergeProcess.once('exit', () => {
          clearTimeout(forceKillTimeout);
        });
        
        // Note: Temp file and partial output cleanup happens in the 'close' handler
        // after the process fully exits, to avoid deleting files while process is using them
        
        resolve({ success: true, message: 'Merge operation cancelled' });
      } else {
        resolve({ success: false, message: 'No active merge operation to cancel' });
      }
    } catch (error) {
      console.error('[cancel-merge] Error cancelling merge:', error);
      reject(error);
    }
  });
});

// Get output directory (merged_videos subfolder)
ipcMain.handle('get-output-directory', async (event, inputPath) => {
  const inputDir = path.dirname(inputPath);
  const outputDir = path.join(inputDir, 'merged_videos');
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  } catch (error) {
    throw new Error(`Failed to create output directory: ${error.message}`);
  }
});

// Split video at specific timestamps
// splits: Array of {startTime: number (seconds), duration: number (seconds), filename: string}
ipcMain.handle('split-video', async (event, videoPath, splits, outputDir) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Reset split cancellation
      isCancelled = false;
      currentSplitProcesses = [];
      
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });
      
      const results = [];
      const ffmpegCmd = getFFmpegPath();
      
      // Process each split
      for (let i = 0; i < splits.length; i++) {
        // Check if operation was cancelled
        if (isCancelled) {
          console.log('[split-video] Operation cancelled by user');
          resolve({ success: false, cancelled: true, results });
          return;
        }
        
        const split = splits[i];
        const outputPath = path.join(outputDir, split.filename);
        
        // Convert seconds to HH:MM:SS format for ffmpeg
        const formatTime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = Math.floor(seconds % 60);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const startTime = formatTime(split.startTime);
        const duration = formatTime(split.duration);
        
        try {
          await new Promise((splitResolve, splitReject) => {
            const ffmpeg = spawn(ffmpegCmd, [
              '-i', videoPath,
              '-ss', startTime,
              '-t', duration,
              '-c', 'copy', // Use copy to avoid re-encoding (faster)
              '-avoid_negative_ts', 'make_zero',
              '-y', // Overwrite output without prompting
              outputPath
            ], {
              shell: true,
              env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
            });
            
            // Track this process for cancellation
            currentSplitProcesses.push(ffmpeg);
            
            let errorOutput = '';
            
            ffmpeg.stderr.on('data', (data) => {
              errorOutput += data.toString();
            });
            
            ffmpeg.on('error', (error) => {
              // Remove from tracking
              const idx = currentSplitProcesses.indexOf(ffmpeg);
              if (idx > -1) currentSplitProcesses.splice(idx, 1);
              
              if (error.code === 'ENOENT') {
                splitReject(new Error('ffmpeg not found'));
              } else {
                splitReject(error);
              }
            });
            
            ffmpeg.on('close', (code) => {
              // Remove from tracking
              const idx = currentSplitProcesses.indexOf(ffmpeg);
              if (idx > -1) currentSplitProcesses.splice(idx, 1);
              
              // Check if cancelled
              if (isCancelled) {
                splitReject(new Error('Operation cancelled'));
                return;
              }
              
              if (code === 0) {
                results.push({ success: true, filename: split.filename, outputPath });
                splitResolve();
              } else {
                results.push({ success: false, filename: split.filename, error: errorOutput });
                splitReject(new Error(`ffmpeg failed: ${errorOutput}`));
              }
            });
          });
        } catch (error) {
          // Continue with next split even if one fails
          logger.error('Error splitting segment', { segmentIndex: i + 1, error: error.message });
          if (!results.find(r => r.filename === split.filename)) {
            results.push({ success: false, filename: split.filename, error: error.message });
          }
        }
      }
      
      resolve({ success: true, results });
    } catch (error) {
      reject(error);
    }
  });
});

});

// Cancel ongoing split operation
ipcMain.handle('cancel-split', async () => {
  return new Promise((resolve) => {
    try {
      if (currentSplitProcesses.length > 0) {
        console.log('[cancel-split] Cancelling split operation...');
        isCancelled = true;

        // Kill all active split processes with SIGTERM (graceful shutdown)
        const processesToKill = [...currentSplitProcesses]; // Copy array
        processesToKill.forEach(process => {
          if (process && !process.killed) {
            process.kill('SIGTERM');

            // Set up fallback: if process doesn't exit within 2 seconds, force kill
            const forceKillTimeout = setTimeout(() => {
              if (process && !process.killed) {
                console.log('[cancel-split] Process did not exit gracefully, force killing...');
                process.kill('SIGKILL');
              }
            }, 2000);

            // Clear timeout if process exits gracefully
            process.once('exit', () => {
              clearTimeout(forceKillTimeout);
            });
          }
        });

        currentSplitProcesses = [];

        resolve({ success: true, message: 'Split operation cancelled' });
      } else {
        resolve({ success: false, message: 'No active split operation to cancel' });
      }
    } catch (error) {
      console.error('[cancel-split] Error cancelling split:', error);
      resolve({ success: false, message: error.message });
    }
  });
});

// Trim video to specific start and end times
// options: { inputPath: string, outputPath: string, startTime: number (seconds), endTime: number (seconds) }
ipcMain.handle('trim-video', async (event, options) => {
  return new Promise(async (resolve, reject) => {
    try {
      const { inputPath, outputPath, startTime, endTime } = options;

      // Validate inputs
      if (!inputPath || !outputPath) {
        reject(new Error('Input and output paths are required'));
        return;
      }

      if (startTime < 0 || endTime <= startTime) {
        reject(new Error('Invalid trim times'));
        return;
      }

      // Calculate duration
      const duration = endTime - startTime;

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      const ffmpegCmd = getFFmpegPath();

      // Convert seconds to HH:MM:SS format for ffmpeg
      const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      const startTimeFormatted = formatTime(startTime);
      const durationFormatted = formatTime(duration);

      console.log(`[trim-video] Trimming ${inputPath} from ${startTimeFormatted} for ${durationFormatted}`);

      const ffmpeg = spawn(ffmpegCmd, [
        '-y',
        '-i', inputPath,
        '-ss', startTimeFormatted,
        '-t', durationFormatted,
        '-c', 'copy', // Use copy to avoid re-encoding (faster)
        '-avoid_negative_ts', 'make_zero',
        outputPath
      ], {
        env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
      });

      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log(`[trim-video] FFmpeg stderr: ${data.toString().trim()}`);
      });

      ffmpeg.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('ffmpeg not found. Please install ffmpeg.'));
        } else {
          reject(error);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[trim-video] ✅ Trim completed successfully: ${outputPath}`);
          resolve({ success: true, outputPath });
        } else {
          console.error(`[trim-video] ❌ FFmpeg failed with code ${code}`);
          console.error(`[trim-video] Error output:\n${errorOutput}`);
          reject(new Error(`ffmpeg failed: ${errorOutput}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
});

// Select output destination folder
ipcMain.handle('select-output-destination', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Destination Folder'
  });

  if (result.canceled) {
    return { canceled: true, path: null };
  }

  const selectedPath = result.filePaths[0];
  
  try {
    // Ensure the directory exists
    await fs.mkdir(selectedPath, { recursive: true });
    return { canceled: false, path: selectedPath };
  } catch (error) {
    throw new Error(`Failed to access output directory: ${error.message}`);
  }
});

// Open folder in Finder
ipcMain.handle('open-folder', async (event, folderPath) => {
  const { shell } = require('electron');
  shell.openPath(folderPath);
});

// Open external URL (e.g., troubleshooting guide)
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  // Validate URL to prevent security issues
  try {
    const parsedUrl = new URL(url);
    // Only allow http and https protocols
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      await shell.openExternal(url);
    } else {
      throw new Error('Only HTTP and HTTPS URLs are allowed');
    }
  } catch (error) {
    throw new Error('Invalid URL');
  }
});

// Check if ffmpeg is installed
ipcMain.handle('check-ffmpeg', async () => {
  return await checkFFmpeg();
});

// Get path to test videos directory
ipcMain.handle('get-test-videos-path', async () => {
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath || path.join(path.dirname(app.getPath('exe')), '..', 'Resources');
    return path.join(resourcesPath, 'test-videos');
  } else {
    return path.join(__dirname, 'test-videos');
  }
});

// Install prerequisites
ipcMain.handle('install-prerequisites', async () => {
  return new Promise((resolve, reject) => {
    // Check if Homebrew is needed
    checkFFmpeg().then((status) => {
      if (status.installed) {
        resolve({ success: true, message: 'ffmpeg is already installed' });
        return;
      }
      
      if (!status.brewFound) {
        // Need to install Homebrew first
        resolve({ 
          success: false, 
          needsHomebrew: true,
          message: 'Homebrew needs to be installed first. Please run the install script manually or install Homebrew from https://brew.sh' 
        });
        return;
      }
      
      // Install ffmpeg via brew
      const brewInstall = spawn('brew', ['install', 'ffmpeg'], { 
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      brewInstall.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      brewInstall.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      brewInstall.on('close', (code) => {
        if (code === 0) {
          // Verify installation
          checkFFmpeg().then((newStatus) => {
            if (newStatus.installed) {
              resolve({ 
                success: true, 
                message: 'ffmpeg installed successfully',
                version: newStatus.ffmpegVersion
              });
            } else {
              resolve({ 
                success: false, 
                message: 'Installation completed but ffmpeg not found. Please restart the app.' 
              });
            }
          });
        } else {
          resolve({ 
            success: false, 
            message: `Installation failed: ${errorOutput}` 
          });
        }
      });
      
      brewInstall.on('error', (error) => {
        resolve({ 
          success: false, 
          message: `Failed to start installation: ${error.message}` 
        });
      });
    });
  });
});

// Auto-update IPC handlers
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { available: false, message: 'Updates are only available in production builds' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: result && result.updateInfo, updateInfo: result ? result.updateInfo : null };
  } catch (error) {
    const errorMessage = error.message || String(error);
    let userMessage = 'Failed to check for updates.';
    if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      userMessage = 'Cannot check for updates. Please check your internet connection.';
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      userMessage = 'Update server not found. This may be a new release.';
    }
    return { available: false, error: true, message: userMessage };
  }
});

ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) {
    return { success: false, error: 'Updates can only be downloaded in production builds' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    const errorMessage = error.message || String(error);
    let userMessage = 'Failed to download update.';
    if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      userMessage = 'Download failed. Please check your internet connection and try again.';
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      userMessage = 'Update file not found. Please try again later.';
    } else if (errorMessage.includes('space') || errorMessage.includes('ENOSPC')) {
      userMessage = 'Not enough disk space to download the update.';
    }
    return { success: false, error: userMessage };
  }
});

// Preferences IPC handlers

// Load user preferences
ipcMain.handle('load-preferences', async () => {
  try {
    const prefs = await loadPreferences();
    // Validate saved output destination: if path no longer exists, clear it
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

// Save user preferences
ipcMain.handle('save-preferences', async (event, preferences) => {
  try {
    await savePreferences(preferences);
    return { success: true };
  } catch (error) {
    logger.error('Error saving preferences', { error: error.message });
    throw error;
  }
});

// Save a filename pattern to recent patterns
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

// Derive patterns from selected filenames and save to recent patterns
// e.g. GXAA0123.MP4 -> GXAA{sessionId}; GOPR0001.MP4 -> GOPR{sessionId}
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

// Set preferred date format
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

// Set preferred video quality
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
    console.error('Error setting preferred quality:', error);
    throw error;
  }
});

// Set preferred format
ipcMain.handle('set-preferred-format', async (event, format) => {
  try {
    const prefs = await loadPreferences();
    const updated = setPreferredFormat(prefs, format);
    await savePreferences(updated);
    return { success: true, preferences: updated };
  } catch (error) {
    console.error('Error setting preferred format:', error);

    throw error;
  }
});

// Set last output destination
ipcMain.handle('set-last-output-destination', async (event, destination) => {
  try {
    // Validate destination: allow only null or a non-empty absolute path string
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
    console.error('Error setting last output destination:', error);
    throw error;
  }
});

// Map error to user-friendly message (for renderer)
ipcMain.handle('map-error', async (event, errorMessage) => {
  try {
    return mapError(errorMessage);
  } catch (error) {
    console.error('Error mapping error:', error);
    // Fallback to basic error structure
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
    // Note: quitAndInstall will quit the app, so code after this won't execute
    // But we wrap it for consistency and in case the behavior changes
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { success: true };
  } catch (error) {
    console.error('Error installing update:', error);
    return {
      success: false,
      error: 'Failed to install update. The app will install the update on the next quit.'
    };
  }
});

// Apply date tokens to a pattern
ipcMain.handle('apply-date-tokens', async (event, pattern, dateStr, dateFormat) => {
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    const result = applyDateTokens(pattern, date, dateFormat);
    return { result };
  } catch (error) {
    logger.error('Error applying date tokens', { error: error.message });
    throw error;
  }
});

// Add a directory to recent directories
ipcMain.handle('add-recent-directory', async (event, dirPath) => {
  try {
    const prefs = await loadPreferences();
    const updated = addRecentDirectory(prefs, dirPath);
    await savePreferences(updated);
    return { success: true, preferences: updated };
  } catch (error) {
    console.error('Error adding recent directory:', error);
    throw error;
  }
});

// Pin a directory
ipcMain.handle('pin-directory', async (event, dirPath) => {
  try {
    const prefs = await loadPreferences();
    const updated = pinDirectory(prefs, dirPath);
    await savePreferences(updated);
    return { success: true, preferences: updated };
  } catch (error) {
    console.error('Error pinning directory:', error);
    throw error;
  }
});

// Unpin a directory
ipcMain.handle('unpin-directory', async (event, dirPath) => {
  try {
    const prefs = await loadPreferences();
    const updated = unpinDirectory(prefs, dirPath);
    await savePreferences(updated);
    return { success: true, preferences: updated };
  } catch (error) {
    console.error('Error unpinning directory:', error);
    throw error;
  }
});

// Clear all recent directories
ipcMain.handle('clear-recent-directories', async () => {
  try {
    const prefs = await loadPreferences();
    const updated = clearRecentDirectories(prefs);
    await savePreferences(updated);
    return { success: true, preferences: updated };
  } catch (error) {
    console.error('Error clearing recent directories:', error);
    throw error;
  }
});

// Cleanup invalid directories
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
    console.error('Error cleaning up directories:', error);
    throw error;
  }
});

// Open a recent directory and scan for video files
ipcMain.handle('open-recent-directory', async (event, dirPath) => {
  try {
    // Verify directory exists
    await fs.access(dirPath);
    
    // Update recent directories
    const prefs = await loadPreferences();
    const updated = addRecentDirectory(prefs, dirPath);
    await savePreferences(updated);
    
    // Scan for video files
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

// Logger IPC handlers
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

// SD Card Detection Functions

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

// Get currently connected GoPro SD cards
ipcMain.handle('get-gopro-sd-cards', async () => {
  try {
    if (!sdCardDetector) {
      sdCardDetector = new SDCardDetector();
    }
    return await sdCardDetector.getGoProSDCards();
  } catch (error) {
    console.error('Error getting GoPro SD cards:', error);
    return [];
  }
});

// Open SD card directory
ipcMain.handle('open-sd-card-directory', async (event, sdCardPath) => {
  if (typeof sdCardPath !== 'string' || !sdCardPath.trim()) {
    return { success: false, error: 'Invalid SD card path' };
  }
  try {
    const dcimPath = path.join(sdCardPath, 'DCIM');
    
    // Check if DCIM exists, otherwise use the root SD card path
    const targetPath = fsSync.existsSync(dcimPath) ? dcimPath : sdCardPath;
    
    // Open in Finder (shell.openPath returns error string, empty on success)
    const { shell } = require('electron');
    const openError = await shell.openPath(targetPath);
    if (openError) {
      console.error('Error opening SD card directory via shell.openPath:', openError);
      return { success: false, error: openError };
    }
    return { success: true, path: targetPath };
  } catch (error) {
    console.error('Error opening SD card directory:', error);
    throw error;
  }
});

// Load SD card files into the app
ipcMain.handle('load-sd-card-files', async (event, sdCardPath) => {
  if (typeof sdCardPath !== 'string' || !sdCardPath.trim()) {
    return { success: false, error: 'Invalid SD card path', files: [] };
  }
  try {
    const dcimPath = path.join(sdCardPath, 'DCIM');
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.MP4', '.MOV', '.AVI', '.MKV', '.M4V'];
    const videoFiles = [];

    async function scanDirectory(dirPath) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (videoExtensions.includes(ext)) {
              videoFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
      }
    }

    // Scan DCIM directory if it exists
    if (fsSync.existsSync(dcimPath)) {
      await scanDirectory(dcimPath);
    }

    return { success: true, files: videoFiles };
  } catch (error) {
    console.error('Error loading SD card files:', error);
    throw error;
  }
});

// Toggle SD card auto-detection
ipcMain.handle('set-auto-detect-sd-cards', async (event, enabled) => {
  try {
    // Ensure `enabled` is a proper boolean before using or persisting it
    let normalizedEnabled;
    if (typeof enabled === 'boolean') {
      normalizedEnabled = enabled;
    } else if (typeof enabled === 'string') {
      const lower = enabled.trim().toLowerCase();
      if (lower === 'true') {
        normalizedEnabled = true;
      } else if (lower === 'false') {
        normalizedEnabled = false;
      } else {
        normalizedEnabled = Boolean(enabled);
      }
    } else {
      normalizedEnabled = Boolean(enabled);
    }

    const prefs = await loadPreferences();
    const updated = setAutoDetectSDCards(prefs, normalizedEnabled);
    await savePreferences(updated);
    
    // Start or stop detection based on setting
    if (normalizedEnabled && !sdCardDetector) {
      await initializeSDCardDetection();
    } else if (!normalizedEnabled && sdCardDetector) {
      sdCardDetector.stop();
      sdCardDetector = null;
    }
    
    return { success: true, preferences: updated };
  } catch (error) {
    console.error('Error setting auto-detect SD cards:', error);
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

// Toggle SD card notifications
ipcMain.handle('set-show-sd-card-notifications', async (event, enabled) => {
  try {
    // Ensure `enabled` is a proper boolean before persisting
    let normalizedEnabled;
    if (typeof enabled === 'boolean') {
      normalizedEnabled = enabled;
    } else if (typeof enabled === 'string') {
      const lower = enabled.trim().toLowerCase();
      if (lower === 'true') {
        normalizedEnabled = true;
      } else if (lower === 'false') {
        normalizedEnabled = false;
      } else {
        normalizedEnabled = Boolean(enabled);
      }
    } else {
      normalizedEnabled = Boolean(enabled);
    }
    const prefs = await loadPreferences();
    const updated = setShowSDCardNotifications(prefs, normalizedEnabled);
    await savePreferences(updated);
    return { success: true, preferences: updated };
  } catch (error) {
    console.error('Error setting SD card notifications:', error);
    throw error;
  }
});

// Remove a failed operation
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

// Get all failed operations
ipcMain.handle('get-failed-operations', async () => {
  try {
    const prefs = await loadPreferences();
    return getFailedOperations(prefs);
  } catch (error) {
    logger.error('Error getting failed operations', { error: error.message });
    throw error;
  }
});

// Clear all failed operations
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

// Map error to user-friendly format
ipcMain.handle('map-error', async (event, error) => {
  try {
    return mapError(error);
  } catch (e) {
    console.error('Error mapping error:', e);
    // Return a basic error object if mapping fails
    return {
      userMessage: "An Error Occurred",
      suggestion: "Something went wrong.",
      fixes: ["Try again", "Restart the app"],
      code: "UNKNOWN",
      technicalDetails: String(error)
    };
  }
});

