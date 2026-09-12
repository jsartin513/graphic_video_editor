const path = require('path');
const { BrowserWindow } = require('electron');
const { logger } = require('../src/logger');
const { getRootFolderFromFiles } = require('../src/file-pick-utils');

const PICKER_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body></body></html>`)}`;

const PICKER_FILE_PATH_HELPER = `
function getPathFromFile(file) {
  if (file && file.path) return file.path;
  try {
    const { webUtils } = require('electron');
    if (webUtils && typeof webUtils.getPathForFile === 'function') {
      return webUtils.getPathForFile(file);
    }
  } catch (error) {}
  return '';
}
function describeFile(file) {
  return {
    path: getPathFromFile(file),
    webkitRelativePath: file.webkitRelativePath || file.name || '',
    name: file.name || ''
  };
}
`;

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
  return getRootFolderFromFiles(files, (file) => file.path || '');
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
          ${PICKER_FILE_PATH_HELPER}
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
              const paths = Array.from(input.files || []).map((f) => describeFile(f).path).filter(Boolean);
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
          ${PICKER_FILE_PATH_HELPER}
          return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.style.display = 'none';
            document.body.appendChild(input);
            const done = (files) => {
              input.remove();
              resolve(files);
            };
            input.addEventListener('change', () => {
              const files = Array.from(input.files || []).map((f) => describeFile(f));
              done(files);
            });
            input.addEventListener('cancel', () => done([]));
            input.click();
          });
        })()
      `, true).then((files) => {
        clearTimeout(timeout);
        const folderPath = getRootFolderFromWebkitFiles(files || []);
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
