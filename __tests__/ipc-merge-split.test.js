/**
 * Tests for main/ipc-merge-split.js - merge, split, trim validation edge cases
 */

const { ipcMain } = require('electron');

jest.mock('../src/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('../src/error-mapper', () => ({ mapError: jest.fn((e) => ({ userMessage: String(e), code: 'MAPPED' })) }));
jest.mock('../src/ffmpeg-resolver', () => ({ getFFmpegPath: () => '/usr/bin/ffmpeg', getFFprobePath: () => '/usr/bin/ffprobe' }));
jest.mock('child_process', () => ({ spawn: jest.fn(() => ({ on: jest.fn(), once: jest.fn(), kill: jest.fn(), killed: false })) }));

const fs = require('fs').promises;
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined)
    }
  };
});

const { registerMergeSplitIpcHandlers } = require('../main/ipc-merge-split');

describe('ipc-merge-split', () => {
  const getMainWindow = () => null;

  beforeEach(() => {
    jest.clearAllMocks();
    registerMergeSplitIpcHandlers(getMainWindow);
  });

  function getHandler(channel) {
    const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  }

  describe('merge-videos validation', () => {
    it('rejects when filePaths is not an array', async () => {
      const handler = getHandler('merge-videos');
      await expect(handler(null, null, '/out.mp4')).rejects.toThrow('filePaths must be an array');
      await expect(handler(null, undefined, '/out.mp4')).rejects.toThrow('filePaths must be an array');
      await expect(handler(null, 'string', '/out.mp4')).rejects.toThrow('filePaths must be an array');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects when outputPath is missing or invalid', async () => {
      const handler = getHandler('merge-videos');
      await expect(handler(null, ['/a.mp4'], null)).rejects.toThrow('outputPath is required');
      await expect(handler(null, ['/a.mp4'], '')).rejects.toThrow('outputPath is required');
      await expect(handler(null, ['/a.mp4'], 123)).rejects.toThrow('outputPath is required');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('split-video validation', () => {
    it('rejects when videoPath is missing or invalid', async () => {
      const handler = getHandler('split-video');
      await expect(handler(null, null, [{ start: 0, end: 10 }], '/out')).rejects.toThrow('videoPath is required');
      await expect(handler(null, '', [{ start: 0, end: 10 }], '/out')).rejects.toThrow('videoPath is required');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects when splits is not a non-empty array', async () => {
      const handler = getHandler('split-video');
      await expect(handler(null, '/video.mp4', null, '/out')).rejects.toThrow('splits must be a non-empty array');
      await expect(handler(null, '/video.mp4', [], '/out')).rejects.toThrow('splits must be a non-empty array');
      await expect(handler(null, '/video.mp4', 'string', '/out')).rejects.toThrow('splits must be a non-empty array');
    });

    it('rejects when outputDir is missing or invalid', async () => {
      const handler = getHandler('split-video');
      await expect(handler(null, '/video.mp4', [{ start: 0, end: 10 }], null)).rejects.toThrow('outputDir is required');
      await expect(handler(null, '/video.mp4', [{ start: 0, end: 10 }], '')).rejects.toThrow('outputDir is required');
    });
  });

  describe('trim-video validation', () => {
    it('rejects when options is null or undefined', async () => {
      const handler = getHandler('trim-video');
      await expect(handler(null, null)).rejects.toThrow('options object is required');
      await expect(handler(null, undefined)).rejects.toThrow('options object is required');
    });

    it('rejects when options is not an object', async () => {
      const handler = getHandler('trim-video');
      await expect(handler(null, 'string')).rejects.toThrow('options object is required');
      await expect(handler(null, 123)).rejects.toThrow('options object is required');
    });

    it('rejects when options is missing inputPath or outputPath', async () => {
      const handler = getHandler('trim-video');
      await expect(handler(null, { outputPath: '/out.mp4' })).rejects.toThrow('Input and output paths are required');
      await expect(handler(null, { inputPath: '/in.mp4' })).rejects.toThrow('Input and output paths are required');
    });
  });
});
