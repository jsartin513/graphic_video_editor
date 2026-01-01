const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn, execSync } = require('child_process');

let mainWindow;
let ffmpegPath = null;
let ffprobePath = null;

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

app.whenReady().then(() => {
  // Set up app icon (for development - production uses electron-builder config)
  setupAppIcon();
  
  createWindow();
  
  // Check prerequisites after window is ready
  setTimeout(() => {
    checkPrerequisites();
  }, 500);

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

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Extract session ID from GoPro filename
function extractSessionId(filename) {
  // Pattern: GX??????.MP4 -> extract last 4 digits
  const gxMatch = filename.match(/GX\d{2}(\d{4})\.MP4$/i);
  if (gxMatch) return gxMatch[1];
  
  // Pattern: GP??????.MP4 -> extract last 4 digits
  const gpMatch = filename.match(/GP\d{2}(\d{4})\.MP4$/i);
  if (gpMatch) return gpMatch[1];
  
  // Pattern: GOPR????.MP4 -> extract 4 digits
  const goprMatch = filename.match(/GOPR(\d{4})\.MP4$/i);
  if (goprMatch) return goprMatch[1];
  
  return null;
}

// Import video grouping functions
const { analyzeAndGroupVideos } = require('./src/video-grouping');

// Import preferences module
const {
  loadPreferences,
  savePreferences,
  addRecentPattern,
  setPreferredDateFormat,
  applyDateTokens
} = require('./src/preferences');

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

// Merge videos using ffmpeg
ipcMain.handle('merge-videos', async (event, filePaths, outputPath) => {
  return new Promise((resolve, reject) => {
    // Create temporary file list
    const tempFileList = path.join(path.dirname(outputPath), `filelist_${Date.now()}.txt`);
    const fileListContent = filePaths.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    
    fs.writeFile(tempFileList, fileListContent, 'utf8')
      .then(() => {
        const ffmpegCmd = getFFmpegPath();
        const ffmpeg = spawn(ffmpegCmd, [
          '-f', 'concat',
          '-safe', '0',
          '-i', tempFileList,
          '-c', 'copy',
          outputPath
        ], { 
          env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
        });
        
        let errorOutput = '';
        
        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        ffmpeg.on('error', (error) => {
          fs.unlink(tempFileList).catch(() => {});
          // Handle case where ffmpeg is not found
          if (error.code === 'ENOENT') {
            reject(new Error('ffmpeg not found. Please install ffmpeg using the prerequisites installer or run: brew install ffmpeg'));
          } else {
            reject(error);
          }
        });
        
        ffmpeg.on('close', (code) => {
          // Clean up temp file
          fs.unlink(tempFileList).catch(() => {});
          
          if (code === 0) {
            resolve({ success: true, outputPath });
          } else {
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

// Get the path to bundled ffmpeg/ffprobe binaries
function getBundledBinaryPath(binaryName) {
  try {
    if (app.isPackaged) {
      // Packaged app: binaries are typically under <app>.app/Contents/Resources/resources/ (note the nested resources directory)
      const resourcesPath = process.resourcesPath || path.join(path.dirname(app.getPath('exe')), '..', 'Resources');
      const binaryPath = path.join(resourcesPath, 'resources', binaryName);
      
      if (fsSync.existsSync(binaryPath)) {
        // Make sure it's executable
        try {
          fsSync.chmodSync(binaryPath, 0o755);
        } catch (e) {
          console.warn(`Failed to set executable permissions on "${binaryPath}":`, e);
        }
        return binaryPath;
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
    
    // Then check system binaries
    const foundFFmpegPath = bundledFFmpeg || findSystemExecutablePath('ffmpeg');
    const foundFFprobePath = bundledFFprobe || findSystemExecutablePath('ffprobe');
    
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
        resolve({
          installed: ffmpegFound && ffprobeFound,
          ffmpegFound,
          ffprobeFound,
          brewFound,
          ffmpegVersion
        });
      }
    }
    
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
    return await loadPreferences();
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

