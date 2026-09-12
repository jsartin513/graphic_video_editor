jest.mock('electron', () => ({
  app: { focus: jest.fn() },
  dialog: { showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }) }
}));

const { app, dialog } = require('electron');
const { prepareWindowForDialog, showOpenDialog } = require('../main/dialog-utils');

describe('dialog-utils', () => {
  const mainWindow = {
    isDestroyed: () => false,
    isMinimized: () => false,
    restore: jest.fn(),
    show: jest.fn(),
    focus: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prepareWindowForDialog focuses the window', () => {
    prepareWindowForDialog(mainWindow);
    expect(mainWindow.show).toHaveBeenCalled();
    expect(mainWindow.focus).toHaveBeenCalled();
    if (process.platform === 'darwin') {
      expect(app.focus).toHaveBeenCalledWith({ steal: true });
    }
  });

  it('showOpenDialog hides the main window on macOS while the panel is open', async () => {
    const options = { properties: ['openFile'] };
    const hide = jest.fn();
    const show = jest.fn();
    const win = {
      isDestroyed: () => false,
      isMinimized: () => false,
      hide,
      show,
      restore: jest.fn(),
      focus: jest.fn()
    };

    jest.useFakeTimers();
    const promise = showOpenDialog(win, options);

    if (process.platform === 'darwin') {
      expect(hide).toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(200);
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(options);
      await promise;
      expect(show).toHaveBeenCalled();
    } else {
      await promise;
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(win, options);
    }

    jest.useRealTimers();
  });
});
