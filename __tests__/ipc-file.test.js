/**
 * Tests for main/ipc-file.js - file and folder IPC handlers
 */

const path = require('path');
const { ipcMain, dialog } = require('electron');

jest.mock('../src/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('../src/main-utils', () => ({ formatFileSize: jest.fn((n) => `${n} bytes`) }));
jest.mock('../src/video-scanner', () => ({
  scanDirectoryForVideos: jest.fn(),
  VIDEO_EXTENSIONS: ['.mp4', '.mov', '.avi', '.mkv', '.m4v']
}));
jest.mock('../src/preferences', () => ({
  loadPreferences: jest.fn(),
  savePreferences: jest.fn(),
  addRecentDirectory: jest.fn((prefs, dir) => ({ ...prefs, recentDirs: [dir] }))
}));

const fs = require('fs').promises;
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      stat: jest.fn(),
      access: jest.fn(),
      readdir: jest.fn()
    }
  };
});

const { registerFileIpcHandlers } = require('../main/ipc-file');
const { loadPreferences, savePreferences } = require('../src/preferences');
const { scanDirectoryForVideos } = require('../src/video-scanner');

describe('ipc-file', () => {
  const getMainWindow = () => null;

  beforeEach(() => {
    jest.clearAllMocks();
    loadPreferences.mockResolvedValue({});
    savePreferences.mockResolvedValue(undefined);
    scanDirectoryForVideos.mockResolvedValue([]);
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [] });
    fs.stat.mockRejectedValue(new Error('not found'));
    fs.access.mockResolvedValue(undefined);
    fs.readdir.mockResolvedValue([]);
    registerFileIpcHandlers(getMainWindow);
  });

  describe('registration', () => {
    it('registers select-files, select-folder, get-file-metadata, process-dropped-paths, open-recent-directory', () => {
      const channels = ipcMain.handle.mock.calls.map((c) => c[0]);
      expect(channels).toContain('select-files');
      expect(channels).toContain('select-folder');
      expect(channels).toContain('get-file-metadata');
      expect(channels).toContain('process-dropped-paths');
      expect(channels).toContain('open-recent-directory');
      expect(ipcMain.handle).toHaveBeenCalledTimes(5);
    });
  });

  function getHandler(channel) {
    const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  }

  describe('select-files', () => {
    it('returns canceled and empty files when dialog is canceled', async () => {
      dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
      const handler = getHandler('select-files');
      const result = await handler();
      expect(result).toEqual({ canceled: true, files: [] });
    });

    it('returns files when dialog is not canceled', async () => {
      const paths = ['/a/v1.mp4', '/a/v2.mov'];
      dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: paths });
      const handler = getHandler('select-files');
      const result = await handler();
      expect(result).toEqual({ canceled: false, files: paths });
    });
  });

  describe('select-folder', () => {
    it('returns canceled when dialog is canceled', async () => {
      dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
      const handler = getHandler('select-folder');
      const result = await handler();
      expect(result).toEqual({ canceled: true, files: [] });
    });

    it('returns scanned video files when folder selected', async () => {
      const dir = '/path/to/folder';
      const files = ['/path/to/folder/a.mp4'];
      dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [dir] });
      scanDirectoryForVideos.mockResolvedValue(files);
      const handler = getHandler('select-folder');
      const result = await handler();
      expect(scanDirectoryForVideos).toHaveBeenCalledWith(dir);
      expect(result).toEqual({ canceled: false, files });
    });
  });

  describe('get-file-metadata', () => {
    it('returns null for invalid filePath', async () => {
      const handler = getHandler('get-file-metadata');
      expect(await handler(null, null)).toBeNull();
      expect(await handler(null, 123)).toBeNull();
    });

    it('returns size, sizeFormatted, modified when file exists', async () => {
      const filePath = '/some/video.mp4';
      const mtime = new Date();
      fs.stat.mockResolvedValue({ size: 1000, mtime });
      const handler = getHandler('get-file-metadata');
      const result = await handler(null, filePath);
      expect(result).toMatchObject({ size: 1000, modified: mtime });
      expect(result.sizeFormatted).toBe('1000 bytes');
    });

    it('returns null when stat fails', async () => {
      fs.stat.mockRejectedValue(new Error('ENOENT'));
      const handler = getHandler('get-file-metadata');
      const result = await handler(null, '/missing.mp4');
      expect(result).toBeNull();
    });
  });

  describe('process-dropped-paths', () => {
    it('includes dropped file when extension is lowercase video', async () => {
      const videoPath = '/dir/video.mp4';
      fs.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      const handler = getHandler('process-dropped-paths');
      const result = await handler(null, [videoPath]);
      expect(result).toEqual([videoPath]);
    });

    it('includes dropped file when extension is uppercase (.MP4)', async () => {
      const videoPath = '/dir/video.MP4';
      fs.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      const handler = getHandler('process-dropped-paths');
      const result = await handler(null, [videoPath]);
      expect(result).toEqual([videoPath]);
    });

    it('scans directory and returns video files', async () => {
      const dirPath = '/dropped/folder';
      const files = ['/dropped/folder/a.mp4'];
      fs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => false });
      scanDirectoryForVideos.mockResolvedValue(files);
      const handler = getHandler('process-dropped-paths');
      const result = await handler(null, [dirPath]);
      expect(scanDirectoryForVideos).toHaveBeenCalledWith(dirPath);
      expect(result).toEqual(files);
    });

    it('returns empty array when paths is null', async () => {
      const handler = getHandler('process-dropped-paths');
      const result = await handler(null, null);
      expect(result).toEqual([]);
      expect(fs.stat).not.toHaveBeenCalled();
    });

    it('returns empty array when paths is undefined', async () => {
      const handler = getHandler('process-dropped-paths');
      const result = await handler(null, undefined);
      expect(result).toEqual([]);
      expect(fs.stat).not.toHaveBeenCalled();
    });

    it('returns empty array when paths is not an array', async () => {
      const handler = getHandler('process-dropped-paths');
      expect(await handler(null, 'string')).toEqual([]);
      expect(await handler(null, 123)).toEqual([]);
      expect(await handler(null, {})).toEqual([]);
      expect(fs.stat).not.toHaveBeenCalled();
    });
  });

  describe('open-recent-directory', () => {
    it('throws when dirPath is null, undefined, or empty string', async () => {
      const handler = getHandler('open-recent-directory');
      await expect(handler(null, null)).rejects.toThrow('Invalid directory path');
      await expect(handler(null, undefined)).rejects.toThrow('Invalid directory path');
      await expect(handler(null, '')).rejects.toThrow('Invalid directory path');
      await expect(handler(null, '   ')).rejects.toThrow('Invalid directory path');
      expect(fs.access).not.toHaveBeenCalled();
    });

    it('throws when dirPath is not a string', async () => {
      const handler = getHandler('open-recent-directory');
      await expect(handler(null, 123)).rejects.toThrow('Invalid directory path');
      expect(fs.access).not.toHaveBeenCalled();
    });

    it('returns success and files when directory is accessible', async () => {
      const dirPath = '/recent/dir';
      fs.access.mockResolvedValue(undefined);
      fs.readdir.mockResolvedValue([
        { name: 'v.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'skip.txt', isDirectory: () => false, isFile: () => true }
      ]);
      const handler = getHandler('open-recent-directory');
      const result = await handler(null, dirPath);
      expect(result.success).toBe(true);
      expect(result.files).toContain(path.join(dirPath, 'v.mp4'));
      expect(result.files).not.toContain(path.join(dirPath, 'skip.txt'));
    });

    it('includes files with uppercase extension when normalized', async () => {
      const dirPath = '/recent/dir';
      fs.access.mockResolvedValue(undefined);
      fs.readdir.mockResolvedValue([
        { name: 'v.MP4', isDirectory: () => false, isFile: () => true }
      ]);
      const handler = getHandler('open-recent-directory');
      const result = await handler(null, dirPath);
      expect(result.files).toContain(path.join(dirPath, 'v.MP4'));
    });
  });
});
