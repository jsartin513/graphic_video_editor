/**
 * Miscellaneous IPC handlers: open folder, open URL, ffmpeg check, test videos, prerequisites
 */

const path = require('path');
const { app, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const { checkFFmpeg, hasBundledBinariesInApp } = require('../src/ffmpeg-resolver');

function registerMiscIpcHandlers() {
  ipcMain.handle('open-folder', async (event, folderPath) => {
    if (folderPath == null || typeof folderPath !== 'string' || !folderPath.trim()) {
      throw new Error('Invalid folder path');
    }
    const error = await shell.openPath(folderPath);
    if (error && typeof error === 'string' && error.trim()) {
      throw new Error(error);
    }
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

  ipcMain.handle('install-prerequisites', async (_event, options = {}) => {
    if (hasBundledBinariesInApp()) {
      return {
        success: false,
        notApplicable: true,
        message:
          'This build includes bundled ffmpeg. Reinstall the fat (arm64-fat / x64-fat) build from GitHub Releases instead of using Homebrew.'
      };
    }

    if (!options.confirmed) {
      return {
        success: false,
        cancelled: true,
        message: 'Installation was not started. Confirm the Homebrew install prompt to continue.'
      };
    }

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
            message:
              'Homebrew needs to be installed first. Install Homebrew from https://brew.sh, then try again.'
          });
          return;
        }

        const brewInstall = spawn('brew', ['install', 'ffmpeg'], {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdoutOutput = '';
        let stderrOutput = '';
        brewInstall.stdout.on('data', (data) => {
          stdoutOutput += data.toString();
        });
        brewInstall.stderr.on('data', (data) => {
          stderrOutput += data.toString();
        });
        brewInstall.on('close', (code) => {
          if (code === 0) {
            checkFFmpeg().then((newStatus) => {
              if (newStatus.installed) {
                resolve({
                  success: true,
                  message: 'ffmpeg installed successfully via Homebrew',
                  version: newStatus.ffmpegVersion
                });
              } else {
                resolve({
                  success: false,
                  message: 'Homebrew finished but ffmpeg was not found. Quit and reopen the app, then check again.'
                });
              }
            });
          } else {
            const detail = (stderrOutput || stdoutOutput || '').trim().slice(-2000);
            resolve({
              success: false,
              message: detail
                ? `Homebrew install failed (exit ${code}): ${detail}`
                : `Homebrew install failed with exit code ${code}`
            });
          }
        });
        brewInstall.on('error', (error) => {
          resolve({ success: false, message: `Failed to start Homebrew install: ${error.message}` });
        });
      });
    });
  });
}

module.exports = { registerMiscIpcHandlers };
