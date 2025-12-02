const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: 'Video Merger',
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

// Analyze and group video files by session ID
ipcMain.handle('analyze-videos', async (event, filePaths) => {
  const groups = new Map();
  
  for (const filePath of filePaths) {
    const filename = path.basename(filePath);
    const sessionId = extractSessionId(filename);
    
    if (!sessionId) {
      // Skip files that don't match GoPro patterns
      continue;
    }
    
    if (!groups.has(sessionId)) {
      groups.set(sessionId, []);
    }
    
    groups.get(sessionId).push(filePath);
  }
  
  // Sort files within each group
  const result = [];
  for (const [sessionId, files] of groups.entries()) {
    const sortedFiles = files.sort();
    result.push({
      sessionId,
      files: sortedFiles,
      outputFilename: `PROCESSED${sessionId}.MP4`
    });
  }
  
  // Sort by session ID
  result.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  
  return result;
});

// Get video duration using ffprobe
ipcMain.handle('get-video-duration', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    
    let output = '';
    let errorOutput = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        reject(new Error(`ffprobe failed: ${errorOutput}`));
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
        const ffmpeg = spawn('ffmpeg', [
          '-f', 'concat',
          '-safe', '0',
          '-i', tempFileList,
          '-c', 'copy',
          outputPath
        ]);
        
        let errorOutput = '';
        
        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
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
        
        ffmpeg.on('error', (error) => {
          fs.unlink(tempFileList).catch(() => {});
          reject(error);
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

// Open folder in Finder
ipcMain.handle('open-folder', async (event, folderPath) => {
  const { shell } = require('electron');
  shell.openPath(folderPath);
});

// Check if ffmpeg is installed
ipcMain.handle('check-ffmpeg', async () => {
  return await checkFFmpeg();
});

async function checkFFmpeg() {
  return new Promise((resolve) => {
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
    const ffmpegCheck = spawn('which', ['ffmpeg'], { shell: true });
    ffmpegCheck.on('close', (code) => {
      ffmpegFound = code === 0;
      if (ffmpegFound) {
        // Get version
        const versionCheck = spawn('ffmpeg', ['-version'], { shell: true });
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
    const ffprobeCheck = spawn('which', ['ffprobe'], { shell: true });
    ffprobeCheck.on('close', (code) => {
      ffprobeFound = code === 0;
      checkComplete();
    });
    ffprobeCheck.on('error', () => {
      checkComplete();
    });
    
    // Check brew
    const brewCheck = spawn('which', ['brew'], { shell: true });
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

