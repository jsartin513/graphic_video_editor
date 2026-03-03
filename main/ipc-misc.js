/**
 * Miscellaneous IPC handlers: open folder, open URL, ffmpeg check, test videos, prerequisites
 */

const path = require('path');
const { app, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const { checkFFmpeg } = require('../src/ffmpeg-resolver');

function registerMiscIpcHandlers() {
  ipcMain.handle('open-folder', async (event, folderPath) => {
    shell.openPath(folderPath);
  });

  ipcMain.handle('open-external', async (event, url) => {
    if (url == null || typeof url !== 'string' || !url.trim()) {
      throw new Error('Invalid URL');
    }
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        await shell.openExternal(url);
      } else {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
      }
    } catch (error) {
      throw new Error('Invalid URL');
    }
  });

  ipcMain.handle('check-ffmpeg', async () => {
    return await checkFFmpeg();
  });

  ipcMain.handle('get-test-videos-path', async () => {
    if (app.isPackaged) {
      const resourcesPath = process.resourcesPath || path.join(path.dirname(app.getPath('exe')), '..', 'Resources');
      return path.join(resourcesPath, 'test-videos');
    }
    return path.join(__dirname, '..', 'test-videos');
  });

  ipcMain.handle('install-prerequisites', async () => {
    return new Promise((resolve) => {
      checkFFmpeg().then((status) => {
        if (status.installed) {
          resolve({ success: true, message: 'ffmpeg is already installed' });
          return;
        }
        if (!status.brewFound) {
          resolve({
            success: false,
            needsHomebrew: true,
            message: 'Homebrew needs to be installed first. Please run the install script manually or install Homebrew from https://brew.sh'
          });
          return;
        }
        const brewInstall = spawn('brew', ['install', 'ffmpeg'], {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        let errorOutput = '';
        brewInstall.stderr.on('data', (data) => { errorOutput += data.toString(); });
        brewInstall.on('close', (code) => {
          if (code === 0) {
            checkFFmpeg().then((newStatus) => {
              if (newStatus.installed) {
                resolve({ success: true, message: 'ffmpeg installed successfully', version: newStatus.ffmpegVersion });
              } else {
                resolve({ success: false, message: 'Installation completed but ffmpeg not found. Please restart the app.' });
              }
            });
          } else {
            resolve({ success: false, message: `Installation failed: ${errorOutput}` });
          }
        });
        brewInstall.on('error', (error) => {
          resolve({ success: false, message: `Failed to start installation: ${error.message}` });
        });
      });
    });
  });
}

module.exports = { registerMiscIpcHandlers };
