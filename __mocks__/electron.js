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
  quit: jest.fn()
};

module.exports = {
  app,
  BrowserWindow: jest.fn(),
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  nativeImage: { createFromPath: jest.fn(() => ({})) }
};
