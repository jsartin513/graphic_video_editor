const { app, dialog } = require('electron');

/**
 * Bring the main window forward before showing a native file/folder dialog.
 */
function prepareWindowForDialog(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === 'darwin') {
    app.focus({ steal: true });
  }
}

/**
 * Show an open file/folder dialog.
 *
 * On macOS, native open panels often render behind the app window (especially with
 * Electron 28 on recent macOS). Hiding the main window while the panel is open is
 * the most reliable way to ensure the user actually sees the picker.
 */
async function showOpenDialog(mainWindow, options) {
  if (process.platform === 'darwin') {
    const canHide = mainWindow && !mainWindow.isDestroyed();
    if (canHide) {
      mainWindow.hide();
      // Let the hide complete before presenting the system open panel.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    try {
      app.focus({ steal: true });
      return await dialog.showOpenDialog(options);
    } finally {
      if (canHide) {
        mainWindow.show();
        mainWindow.focus();
        app.focus({ steal: true });
      }
    }
  }

  prepareWindowForDialog(mainWindow);
  return dialog.showOpenDialog(mainWindow, options);
}

module.exports = {
  prepareWindowForDialog,
  showOpenDialog
};
