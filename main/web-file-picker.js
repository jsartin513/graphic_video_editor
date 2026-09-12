const path = require('path');
const { BrowserWindow } = require('electron');
const { logger } = require('../src/logger');

const PICKER_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body></body></html>`)}`;

function createPickerWindow(getMainWindow) {
  const parent = getMainWindow?.();
  const win = new BrowserWindow({
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    modal: Boolean(parent && !parent.isDestroyed()),
    show: false,
    width: 1,
    height: 1,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });
  if (parent && !parent.isDestroyed()) {
    parent.show();
    parent.focus();
  }
  return win;
}

function getRootFolderFromWebkitFiles(files) {
  if (!files.length) return null;
  const first = files[0];
  const rel = first.webkitRelativePath || path.basename(first.path);
  if (!rel.includes('/')) {
    return path.dirname(first.path);
  }
  return first.path.slice(0, first.path.length - rel.length).replace(/[/\\]$/, '');
}

/**
 * Open files using a hidden renderer <input type="file">.
 * Works when Electron's dialog and osascript panels fail to appear on macOS.
 */
function pickFilesWeb(getMainWindow) {
  return new Promise((resolve, reject) => {
    const win = createPickerWindow(getMainWindow);
    let settled = false;

    const finish = (filePaths) => {
      if (settled) return;
      settled = true;
      if (!win.isDestroyed()) win.destroy();
      const paths = (filePaths || []).filter(Boolean);
      resolve({
        canceled: paths.length === 0,
        filePaths: paths
      });
    };

    const timeout = setTimeout(() => {
      logger.warn('web-file-picker: file pick timed out');
      finish([]);
    }, 5 * 60 * 1000);

    win.webContents.once('did-finish-load', () => {
      win.webContents.executeJavaScript(`
        (function() {
          const { webUtils } = require('electron');
          return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'video/mp4,video/quicktime,video/x-m4v,video/*,.mp4,.mov,.avi,.mkv,.m4v';
            input.style.display = 'none';
            document.body.appendChild(input);
            const done = (paths) => {
              input.remove();
              resolve(paths);
            };
            input.addEventListener('change', () => {
              const paths = Array.from(input.files || []).map((f) => webUtils.getPathForFile(f));
              done(paths);
            });
            input.addEventListener('cancel', () => done([]));
            input.click();
          });
        })()
      `, true).then((paths) => {
        clearTimeout(timeout);
        logger.info('web-file-picker: files selected', { count: paths?.length || 0 });
        finish(paths);
      }).catch((error) => {
        clearTimeout(timeout);
        logger.error('web-file-picker: file pick failed', { error: error.message });
        if (!win.isDestroyed()) win.destroy();
        reject(error);
      });
    });

    win.loadURL(PICKER_HTML).catch((error) => {
      clearTimeout(timeout);
      if (!win.isDestroyed()) win.destroy();
      reject(error);
    });
  });
}

/**
 * Open a folder using <input webkitdirectory>.
 */
function pickFolderWeb(getMainWindow) {
  return new Promise((resolve, reject) => {
    const win = createPickerWindow(getMainWindow);
    let settled = false;

    const finish = (folderPath) => {
      if (settled) return;
      settled = true;
      if (!win.isDestroyed()) win.destroy();
      resolve({
        canceled: !folderPath,
        filePaths: folderPath ? [folderPath] : []
      });
    };

    const timeout = setTimeout(() => {
      logger.warn('web-file-picker: folder pick timed out');
      finish(null);
    }, 5 * 60 * 1000);

    win.webContents.once('did-finish-load', () => {
      win.webContents.executeJavaScript(`
        (function() {
          const { webUtils } = require('electron');
          return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.style.display = 'none';
            document.body.appendChild(input);
            const done = (folder) => {
              input.remove();
              resolve(folder);
            };
            input.addEventListener('change', () => {
              const files = Array.from(input.files || []);
              if (!files.length) {
                done(null);
                return;
              }
              const first = files[0];
              const rel = first.webkitRelativePath || first.name;
              const fullPath = webUtils.getPathForFile(first);
              if (!rel.includes('/')) {
                done(fullPath.replace(/[/\\\\][^/\\\\]+$/, ''));
                return;
              }
              done(fullPath.slice(0, fullPath.length - rel.length).replace(/[/\\\\]$/, ''));
            });
            input.addEventListener('cancel', () => done(null));
            input.click();
          });
        })()
      `, true).then((folderPath) => {
        clearTimeout(timeout);
        logger.info('web-file-picker: folder selected', { folderPath });
        finish(folderPath);
      }).catch((error) => {
        clearTimeout(timeout);
        logger.error('web-file-picker: folder pick failed', { error: error.message });
        if (!win.isDestroyed()) win.destroy();
        reject(error);
      });
    });

    win.loadURL(PICKER_HTML).catch((error) => {
      clearTimeout(timeout);
      if (!win.isDestroyed()) win.destroy();
      reject(error);
    });
  });
}

module.exports = {
  pickFilesWeb,
  pickFolderWeb,
  getRootFolderFromWebkitFiles
};
