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

const safeStorage = {
  isEncryptionAvailable: jest.fn(() => true),
  encryptString: jest.fn((str) => Buffer.from(`enc:${str}`, 'utf8')),
  decryptString: jest.fn((buf) => {
    const s = buf.toString('utf8');
    return s.startsWith('enc:') ? s.slice(4) : s;
  })
};

module.exports = {
  app,
  safeStorage,
  BrowserWindow: jest.fn(),
  clipboard,
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  nativeImage: { createFromPath: jest.fn(() => ({})) },
  shell
};
