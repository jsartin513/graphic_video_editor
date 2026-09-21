// Jest manual mock for the Electron module.
// Provides stub implementations of Electron APIs used in Node/Jest test environments.

const path = require('path');
const os = require('os');

const app = {
  getPath: jest.fn((name) => {
    if (name === 'userData') return path.join(os.tmpdir(), 'test-user-data');
    return os.tmpdir();
  }),
  getVersion: jest.fn(() => '1.0.0'),
  getName: jest.fn(() => 'video-editor'),
  isPackaged: false,
  quit: jest.fn()
};

const clipboard = {
  writeText: jest.fn()
};

const shell = {
  openPath: jest.fn(),
  openExternal: jest.fn().mockResolvedValue(undefined)
};

module.exports = {
  app,
  BrowserWindow: jest.fn(),
  clipboard,
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  nativeImage: { createFromPath: jest.fn(() => ({})) },
  shell
};
