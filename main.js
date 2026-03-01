const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn, execSync } = require('child_process');
const { formatFileSize } = require('./src/main-utils');

let mainWindow;
let ffmpegPath = null;
let ffprobePath = null;
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
      console.warn('Could not set app icon:', error.message);
    }
  }
}

function createWindow() {
  // Set window icon if available
  let windowIcon = null;
  const iconPath = ICON_PATH;
  if (fsSync.existsSync(iconPath)) {
    try {
      windowIcon = nativeImage.createFromPath(iconPath);
    } catch (error) {
      console.warn('Could not load window icon:', error.message);
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

app.whenReady().then(async () => {
  // Set up app icon (for development - production uses electron-builder config)
  setupAppIcon();
  
  createWindow();
  
  // Check prerequisites after window is ready
  setTimeout(() => {
    checkPrerequisites();
  }, 500);

  // Initialize SD card detection
  await initializeSDCardDetection();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setTimeout(() => {
        checkPrerequisites();
      }, 500);
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
    console.error('Error checking prerequisites:', error);
  }
}

app.on('window-all-closed', () => {
  // Stop SD card detection
  if (sdCardDetector) {
    sdCardDetector.stop();
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

  // Recursively find all video files in the folder
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

  if (result.filePaths.length > 0) {
    await scanDirectory(result.filePaths[0]);
  }

  return { canceled: false, files: videoFiles };
});

// Handle getting file metadata
ipcMain.handle('get-file-metadata', async (event, filePath) => {
  // Validate filePath before processing
  if (!filePath || typeof filePath !== 'string') {
    console.error(`Error getting file metadata: invalid filePath (received: ${typeof filePath})`);
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
    console.error(`Error getting file metadata for ${filePath}:`, error);
    return null;
  }
});

// Handle processing dropped files/folders
ipcMain.handle('process-dropped-paths', async (event, paths) => {
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

  for (const droppedPath of paths) {
    try {
      const stats = await fs.stat(droppedPath);
      if (stats.isDirectory()) {
        await scanDirectory(droppedPath);
      } else if (stats.isFile()) {
        const ext = path.extname(droppedPath);
        if (videoExtensions.includes(ext)) {
          videoFiles.push(droppedPath);
        }
      }
    } catch (error) {
      console.error(`Error processing ${droppedPath}:`, error);
    }
  }

  return videoFiles;
});

// Import video grouping functions
const { analyzeAndGroupVideos } = require('./src/video-grouping');

// Import preferences module
const {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  applyDateTokens,
  addSDCardPath,
  setAutoDetectSDCards,
  setShowSDCardNotifications,
  setPreferredQuality,
  setLastOutputDestination,
  addFailedOperation,
  removeFailedOperation,
  getFailedOperations,
  clearFailedOperations
} = require('./src/preferences');

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
        console.error('ffprobe not found. Please install ffmpeg.');
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
        console.error(`ffprobe failed for ${filePath}: ${errorOutput}`);
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

// Get total file size for multiple files
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
ipcMain.handle('merge-videos', async (event, filePaths, outputPath, qualityOption = 'copy') => {
  return new Promise((resolve, reject) => {
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
    const fileListContent = validFilePaths.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    
    fs.writeFile(tempFileList, fileListContent, 'utf8')
      .then(() => {
        const ffmpegCmd = getFFmpegPath();
        console.log(`[merge-videos] Using ffmpeg at: ${ffmpegCmd}`);
        
        // When using bundled binary, we should not need PATH, but limit it to avoid finding system binaries
        const env = { ...process.env };
        if (ffmpegCmd.includes('.app/Contents/Resources')) {
          // Bundled binary - remove system PATH to avoid confusion
          env.PATH = '/usr/bin:/bin';
        } else {
          // System binary - keep original PATH
          env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
        }
        
        console.log(`[merge-videos] File list content (first 500 chars):\n${fileListContent.substring(0, 500)}`);
        console.log(`[merge-videos] Output path: ${outputPath}`);
        console.log(`[merge-videos] Number of files to merge: ${validFilePaths.length}`);
        console.log(`[merge-videos] Quality option: ${qualityOption}`);
        
        // Build ffmpeg command based on quality option
        const ffmpegArgs = [
          '-f', 'concat',
          '-safe', '0',
          '-i', tempFileList
        ];
        
        if (qualityOption === 'copy') {
          // Fast copy mode (no re-encoding)
          ffmpegArgs.push('-c', 'copy');
        } else {
          // Re-encode with quality settings
          const qualitySettings = {
            'high': { crf: '18', preset: 'slow' },
            'medium': { crf: '23', preset: 'medium' },
            'low': { crf: '28', preset: 'fast' }
          };
          
          const settings = qualitySettings[qualityOption] || qualitySettings['medium'];
          
          // Video codec settings
          ffmpegArgs.push(
            '-c:v', 'libx264',
            '-crf', settings.crf,
            '-preset', settings.preset,
            '-c:a', 'aac',
            '-b:a', '192k'
          );
        }
        
        ffmpegArgs.push('-y', outputPath); // -y: overwrite output without prompting
        
        const ffmpeg = spawn(ffmpegCmd, ffmpegArgs, { 
          env
        });
        
        let errorOutput = '';
        let stdoutOutput = '';
        let hasTimedOut = false;
        
        // Set a timeout for the merge operation (5 minutes max)
        const timeout = setTimeout(() => {
          hasTimedOut = true;
          ffmpeg.kill('SIGTERM');
          console.error(`[merge-videos] ⚠️  FFmpeg operation timed out after 5 minutes`);
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
          // Log stderr in real-time for debugging
          console.log(`[merge-videos] FFmpeg stderr: ${output.trim()}`);
          
          // Parse time from FFmpeg output: time=00:00:05.00
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
          if (timeMatch && mainWindow) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            
            // Calculate progress percentage if we have total duration
            let percent = null;
            if (totalDuration !== null && totalDuration > 0) {
              percent = Math.min((currentTime / totalDuration) * 100, 100);
            }
            
            // Format time string for display (HH:MM:SS)
            const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;
            
            // Calculate ETA if we have progress
            let eta = null;
            let etaStr = null;
            if (percent !== null && percent > 0 && percent < 100 && totalDuration > 0) {
              const elapsed = (Date.now() - ffmpeg.startTime) / 1000; // seconds
              if (elapsed > 0 && currentTime > 0) {
                const rate = currentTime / elapsed; // seconds per second (should be ~1.0 for real-time)
                if (rate > 0) {
                  const remaining = totalDuration - currentTime;
                  eta = Math.round(remaining / rate); // seconds remaining
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
            
            // Emit progress event to renderer
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
          fs.unlink(tempFileList).catch(() => {});
          console.error(`[merge-videos] ⚠️  FFmpeg spawn error:`, error);
          // Handle case where ffmpeg is not found
          if (error.code === 'ENOENT') {
            reject(new Error('ffmpeg not found. Please install ffmpeg using the prerequisites installer or run: brew install ffmpeg'));
          } else {
            reject(error);
          }
        });
        
        ffmpeg.on('close', (code) => {
          clearTimeout(timeout);
          // Clean up temp file
          fs.unlink(tempFileList).catch(() => {});
          
          if (hasTimedOut) {
            return; // Already rejected in timeout handler
          }
          
          console.log(`[merge-videos] FFmpeg exited with code: ${code}`);
          
          if (code === 0) {
            console.log(`[merge-videos] ✅ Merge completed successfully: ${outputPath}`);
            resolve({ success: true, outputPath });
          } else {
            console.error(`[merge-videos] ❌ FFmpeg failed with code ${code}`);
            console.error(`[merge-videos] Error output:\n${errorOutput}`);
            reject(new Error(`ffmpeg failed: ${errorOutput}`));
          }
        });
      })
      .catch(reject);
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
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });
      
      const results = [];
      const ffmpegCmd = getFFmpegPath();
      
      // Process each split
      for (let i = 0; i < splits.length; i++) {
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
            
            let errorOutput = '';
            
            ffmpeg.stderr.on('data', (data) => {
              errorOutput += data.toString();
            });
            
            ffmpeg.on('error', (error) => {
              if (error.code === 'ENOENT') {
                splitReject(new Error('ffmpeg not found'));
              } else {
                splitReject(error);
              }
            });
            
            ffmpeg.on('close', (code) => {
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
          console.error(`Error splitting segment ${i + 1}:`, error);
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

// Get the path to bundled ffmpeg/ffprobe binaries
function getBundledBinaryPath(binaryName) {
  try {
    if (app.isPackaged) {
      // Packaged app: binaries are under <app>.app/Contents/Resources/resources/
      // Use process.resourcesPath which is set by Electron
      let resourcesPath = process.resourcesPath;
      
      // Fallback if process.resourcesPath is not set
      if (!resourcesPath) {
        try {
          resourcesPath = app.getPath('resources');
        } catch (e) {
          try {
            const exePath = app.getPath('exe');
            resourcesPath = path.join(path.dirname(exePath), '..', 'Resources');
          } catch (exeError) {
            console.error('[getBundledBinaryPath] Error getting resources path:', e, exeError);
            resourcesPath = path.join(__dirname, '..');
          }
        }
      }
      
      const binaryPath = path.join(resourcesPath, 'resources', binaryName);
      
      console.log(`[getBundledBinaryPath] Looking for ${binaryName} at: ${binaryPath}`);
      console.log(`[getBundledBinaryPath] resourcesPath: ${resourcesPath}`);
      console.log(`[getBundledBinaryPath] process.resourcesPath: ${process.resourcesPath || 'undefined'}`);
      
      // Check if the binary exists
      if (fsSync.existsSync(binaryPath)) {
        // Make sure it's executable
        try {
          fsSync.chmodSync(binaryPath, 0o755);
          const stats = fsSync.statSync(binaryPath);
          console.log(`[getBundledBinaryPath] ✅ Found ${binaryName}: ${binaryPath} (${stats.size} bytes)`);
          return binaryPath;
        } catch (e) {
          console.warn(`[getBundledBinaryPath] Failed to set executable permissions on "${binaryPath}":`, e);
          // Still return the path even if chmod fails
          return binaryPath;
        }
      } else {
        console.log(`[getBundledBinaryPath] ❌ ${binaryName} not found at ${binaryPath}`);
        console.log(`[getBundledBinaryPath] Checking if resources directory exists: ${fsSync.existsSync(resourcesPath)}`);
        if (fsSync.existsSync(resourcesPath)) {
          const contents = fsSync.readdirSync(resourcesPath);
          console.log(`[getBundledBinaryPath] Contents of resourcesPath:`, contents);
          // Check if 'resources' subdirectory exists
          const resourcesSubdir = path.join(resourcesPath, 'resources');
          if (fsSync.existsSync(resourcesSubdir)) {
            console.log(`[getBundledBinaryPath] Found 'resources' subdirectory, contents:`, fsSync.readdirSync(resourcesSubdir));
          }
        }
        // Try alternative locations for debugging
        const altPaths = [
          path.join(resourcesPath, binaryName), // Direct in Resources
          process.resourcesPath ? path.join(process.resourcesPath, 'resources', binaryName) : null, // Using process.resourcesPath
        ];
        // Try app.getPath('resources') if available
        try {
          altPaths.push(path.join(app.getPath('resources'), 'resources', binaryName));
        } catch (e) {
          // app.getPath('resources') not available, skip
        }
        const validAltPaths = altPaths.filter(p => p !== null);
        
        for (const altPath of validAltPaths) {
          if (fsSync.existsSync(altPath)) {
            console.log(`[getBundledBinaryPath] ✅ Found ${binaryName} at alternative location: ${altPath}`);
            try {
              fsSync.chmodSync(altPath, 0o755);
            } catch (e) {
              console.warn(`[getBundledBinaryPath] Failed to chmod ${altPath}:`, e);
            }
            return altPath;
          }
        }
        console.log(`[getBundledBinaryPath] ❌ ${binaryName} not found in any location`);
        return null;
      }
    } else {
      // Development: use the packages directly
      try {
        if (binaryName === 'ffmpeg') {
          return require('ffmpeg-static');
        } else if (binaryName === 'ffprobe') {
          const ffprobeStatic = require('ffprobe-static');
          // Handle both cases: path as string or object with .path property
          return ffprobeStatic.path || ffprobeStatic;
        }
      } catch (e) {
        // Packages not installed or not found
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting bundled binary for ${binaryName}:`, error);
    return null;
  }
}

// Find the actual path to ffmpeg/ffprobe (system install)
function findSystemExecutablePath(command) {
  try {
    // Common Homebrew paths
    const commonPaths = [
      '/opt/homebrew/bin',  // Apple Silicon
      '/usr/local/bin',      // Intel Mac
      '/usr/bin',
      '/bin'
    ];
    
    // First try using which with proper environment
    try {
      const envPath = process.env.PATH || '';
      const fullPath = [envPath, ...commonPaths].filter(p => p).join(':');
      const result = execSync(`which ${command}`, { 
        encoding: 'utf8',
        env: { ...process.env, PATH: fullPath },
        shell: '/bin/bash'
      }).trim();
      if (result && result.length > 0) {
        return result;
      }
    } catch (e) {
      // which failed, try direct paths
    }
    
    // Fallback: check common paths directly
    for (const basePath of commonPaths) {
      const fullCommandPath = path.join(basePath, command);
      try {
        fsSync.accessSync(fullCommandPath, fsSync.constants.F_OK);
        return fullCommandPath;
      } catch (e) {
        // File doesn't exist, continue
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Get the path to ffmpeg/ffprobe, checking bundled first, then system
function getFFmpegPath() {
  if (ffmpegPath) return ffmpegPath;
  
  // First try bundled binary
  const bundled = getBundledBinaryPath('ffmpeg');
  if (bundled) {
    ffmpegPath = bundled;
    return ffmpegPath;
  }
  
  // Fall back to system binary
  ffmpegPath = findSystemExecutablePath('ffmpeg') || 'ffmpeg';
  return ffmpegPath;
}

function getFFprobePath() {
  if (ffprobePath) return ffprobePath;
  
  // First try bundled binary
  const bundled = getBundledBinaryPath('ffprobe');
  if (bundled) {
    ffprobePath = bundled;
    return ffprobePath;
  }
  
  // Fall back to system binary
  ffprobePath = findSystemExecutablePath('ffprobe') || 'ffprobe';
  return ffprobePath;
}

async function checkFFmpeg() {
  return new Promise((resolve) => {
    // Check bundled binaries first
    const bundledFFmpeg = getBundledBinaryPath('ffmpeg');
    const bundledFFprobe = getBundledBinaryPath('ffprobe');
    
    console.log('[checkFFmpeg] Bundled ffmpeg:', bundledFFmpeg);
    console.log('[checkFFmpeg] Bundled ffprobe:', bundledFFprobe);
    
    // Then check system binaries
    const foundFFmpegPath = bundledFFmpeg || findSystemExecutablePath('ffmpeg');
    const foundFFprobePath = bundledFFprobe || findSystemExecutablePath('ffprobe');
    
    console.log('[checkFFmpeg] Found ffmpeg path:', foundFFmpegPath);
    console.log('[checkFFmpeg] Found ffprobe path:', foundFFprobePath);
    
    ffmpegPath = foundFFmpegPath;
    ffprobePath = foundFFprobePath;
    
    let ffmpegFound = false;
    let ffprobeFound = false;
    let brewFound = false;
    let ffmpegVersion = null;
    let checksDone = 0;
    let versionCheckDone = false;
    
    function checkComplete() {
      checksDone++;
      if (checksDone === 3 && versionCheckDone) {
        console.log('[checkFFmpeg] Final result - ffmpegFound:', ffmpegFound, 'ffprobeFound:', ffprobeFound, 'installed:', ffmpegFound && ffprobeFound);
        resolve({
          installed: ffmpegFound && ffprobeFound,
          ffmpegFound,
          ffprobeFound,
          brewFound,
          ffmpegVersion
        });
      }
    }
    
    // If we have bundled binaries, test them directly instead of using 'which'
    if (bundledFFmpeg && bundledFFprobe) {
      console.log('[checkFFmpeg] Testing bundled binaries directly...');
      // Test bundled ffmpeg
      try {
        const testFFmpeg = spawn(bundledFFmpeg, ['-version'], { timeout: 5000 });
        let ffmpegOutput = '';
        testFFmpeg.stdout.on('data', (data) => {
          ffmpegOutput += data.toString();
        });
        testFFmpeg.on('close', (code) => {
          ffmpegFound = code === 0;
          if (ffmpegFound) {
            const match = ffmpegOutput.match(/ffmpeg version (\S+)/);
            if (match) {
              ffmpegVersion = match[1];
            }
          } else {
            console.log('[checkFFmpeg] Bundled ffmpeg test failed with code:', code);
          }
          
          // Test bundled ffprobe
          try {
            const testFFprobe = spawn(bundledFFprobe, ['-version'], { timeout: 5000 });
            testFFprobe.on('close', (code) => {
              ffprobeFound = code === 0;
              if (!ffprobeFound) {
                console.log('[checkFFmpeg] Bundled ffprobe test failed with code:', code);
              }
              
              // Check for brew (still needed for install message)
              const brewCheck = spawn('which', ['brew'], { 
                shell: true,
                env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
              });
              brewCheck.on('close', (code) => {
                brewFound = code === 0;
                versionCheckDone = true;
                checkComplete();
              });
              brewCheck.on('error', () => {
                versionCheckDone = true;
                checkComplete();
              });
            });
            testFFprobe.on('error', (err) => {
              console.error('[checkFFmpeg] Error testing bundled ffprobe:', err);
              ffprobeFound = false;
              versionCheckDone = true;
              checkComplete();
            });
          } catch (err) {
            console.error('[checkFFmpeg] Error spawning bundled ffprobe test:', err);
            ffprobeFound = false;
            versionCheckDone = true;
            checkComplete();
          }
        });
        testFFmpeg.on('error', (err) => {
          console.error('[checkFFmpeg] Error testing bundled ffmpeg:', err);
          ffmpegFound = false;
          versionCheckDone = true;
          checkComplete();
        });
      } catch (err) {
        console.error('[checkFFmpeg] Error spawning bundled ffmpeg test:', err);
        ffmpegFound = false;
        versionCheckDone = true;
        checkComplete();
      }
      return; // Exit early, we're testing bundled binaries
    }
    
    // Fallback to system check (only if no bundled binaries)
    // Check ffmpeg
    const ffmpegCheck = spawn('which', ['ffmpeg'], { 
      shell: true,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    ffmpegCheck.on('close', (code) => {
      ffmpegFound = code === 0 || foundFFmpegPath !== null;
      if (ffmpegFound && foundFFmpegPath) {
        // Get version using found path
        const versionCheck = spawn(foundFFmpegPath, ['-version']);
        let output = '';
        versionCheck.stdout.on('data', (data) => {
          output += data.toString();
        });
        versionCheck.on('close', () => {
          const match = output.match(/ffmpeg version (\S+)/);
          if (match) {
            ffmpegVersion = match[1];
          }
          versionCheckDone = true;
          checkComplete();
        });
        versionCheck.on('error', () => {
          versionCheckDone = true;
          checkComplete();
        });
      } else {
        versionCheckDone = true;
        checkComplete();
      }
    });
    ffmpegCheck.on('error', () => {
      versionCheckDone = true;
      checkComplete();
    });
    
    // Check ffprobe
    const ffprobeCheck = spawn('which', ['ffprobe'], { 
      shell: true,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    ffprobeCheck.on('close', (code) => {
      ffprobeFound = code === 0 || foundFFprobePath !== null;
      checkComplete();
    });
    ffprobeCheck.on('error', () => {
      checkComplete();
    });
    
    // Check brew
    const brewCheck = spawn('which', ['brew'], { 
      shell: true,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    brewCheck.on('close', (code) => {
      brewFound = code === 0;
      checkComplete();
    });
    brewCheck.on('error', () => {
      checkComplete();
    });
  });
}

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
    console.error('Error loading preferences:', error);
    throw error;
  }
});

// Save user preferences
ipcMain.handle('save-preferences', async (event, preferences) => {
  try {
    await savePreferences(preferences);
    return { success: true };
  } catch (error) {
    console.error('Error saving preferences:', error);
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
    console.error('Error saving filename pattern:', error);
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
    console.error('Error setting date format:', error);
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

// Apply date tokens to a pattern
ipcMain.handle('apply-date-tokens', async (event, pattern, dateStr, dateFormat) => {
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    const result = applyDateTokens(pattern, date, dateFormat);
    return { result };
  } catch (error) {
    console.error('Error applying date tokens:', error);
    throw error;
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
    
    // Open in Finder
    const { shell } = require('electron');
    await shell.openPath(targetPath);
    
    return { success: true, path: targetPath };
  } catch (error) {
    console.error('Error opening SD card directory:', error);
    throw error;
  }
});

// Load SD card files into the app
ipcMain.handle('load-sd-card-files', async (event, sdCardPath) => {
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

// Add a failed operation for recovery
function sanitizeFailedOperation(operation) {
  const MAX_STRING_LENGTH = 1024;
  const MAX_FILES = 100;
  const MAX_SERIALIZED_LENGTH = 10 * 1024; // 10 KB

  if (!operation || typeof operation !== 'object') {
    throw new Error('Invalid failed operation: expected an object.');
  }

  const sanitized = {};

  if (typeof operation.sessionId === 'string') {
    sanitized.sessionId = operation.sessionId.trim().slice(0, MAX_STRING_LENGTH);
  }
  if (!sanitized.sessionId) {
    throw new Error('Invalid failed operation: missing sessionId.');
  }

  if (typeof operation.outputPath === 'string') {
    sanitized.outputPath = operation.outputPath.trim().slice(0, MAX_STRING_LENGTH);
  }
  if (!sanitized.outputPath) {
    throw new Error('Invalid failed operation: missing outputPath.');
  }

  if (Array.isArray(operation.files)) {
    sanitized.files = operation.files
      .filter(f => typeof f === 'string')
      .slice(0, MAX_FILES)
      .map(f => f.slice(0, MAX_STRING_LENGTH));
  } else {
    sanitized.files = [];
  }

  if (typeof operation.timestamp === 'number' && Number.isFinite(operation.timestamp)) {
    sanitized.timestamp = operation.timestamp;
  } else {
    sanitized.timestamp = Date.now();
  }

  if (typeof operation.error === 'string') {
    sanitized.error = operation.error.slice(0, MAX_STRING_LENGTH);
  } else {
    sanitized.error = '';
  }

  const serialized = JSON.stringify(sanitized);
  if (serialized.length > MAX_SERIALIZED_LENGTH) {
    throw new Error('Failed operation too large to store.');
  }

  return sanitized;
}

ipcMain.handle('add-failed-operation', async (event, operation) => {
  try {
    const sanitizedOperation = sanitizeFailedOperation(operation);
    const prefs = await loadPreferences();
    const updated = addFailedOperation(prefs, sanitizedOperation);
    await savePreferences(updated);
    return { success: true };
  } catch (error) {
    console.error('Error adding failed operation:', error);
    throw error;
  }
});

// Toggle SD card notifications
ipcMain.handle('set-show-sd-card-notifications', async (event, enabled) => {
  try {
    const prefs = await loadPreferences();
    const updated = setShowSDCardNotifications(prefs, enabled);
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
    console.error('Error removing failed operation:', error);
    throw error;
  }
});

// Get all failed operations
ipcMain.handle('get-failed-operations', async () => {
  try {
    const prefs = await loadPreferences();
    return getFailedOperations(prefs);
  } catch (error) {
    console.error('Error getting failed operations:', error);
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
    console.error('Error clearing failed operations:', error);
    throw error;
  }
});

