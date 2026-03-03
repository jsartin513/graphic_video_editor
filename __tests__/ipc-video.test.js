/**
 * Tests for main/ipc-video.js - video analysis, metadata, thumbnail, file size handlers
 */

const { ipcMain } = require('electron');
const fs = require('fs').promises;

jest.mock('../src/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('../src/main-utils', () => ({ formatFileSize: jest.fn((n) => `${n} bytes`) }));
jest.mock('../src/video-grouping', () => ({ analyzeAndGroupVideos: jest.fn() }));
jest.mock('../src/ffmpeg-resolver', () => ({
  getFFmpegPath: () => '/usr/local/bin/ffmpeg',
  getFFprobePath: () => '/usr/local/bin/ffprobe'
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      stat: jest.fn(),
      access: jest.fn(),
      readFile: jest.fn(),
      mkdir: jest.fn()
    }
  };
});

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args)
}));

const { registerVideoIpcHandlers } = require('../main/ipc-video');
const { analyzeAndGroupVideos } = require('../src/video-grouping');

describe('ipc-video', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpawn.mockReset();
    fs.stat.mockRejectedValue(new Error('not found'));
    registerVideoIpcHandlers();
  });

  function getHandler(channel) {
    const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  }

  describe('registration', () => {
    it('registers analyze-videos, get-video-duration, get-video-metadata, generate-thumbnail, get-total-file-size', () => {
      const channels = ipcMain.handle.mock.calls.map((c) => c[0]);
      expect(channels).toContain('analyze-videos');
      expect(channels).toContain('get-video-duration');
      expect(channels).toContain('get-video-metadata');
      expect(channels).toContain('generate-thumbnail');
      expect(channels).toContain('get-total-file-size');
    });
  });

  describe('analyze-videos', () => {
    it('delegates to analyzeAndGroupVideos', async () => {
      const groups = [{ sessionId: 'GX', files: ['a.mp4'] }];
      analyzeAndGroupVideos.mockResolvedValue(groups);
      const handler = getHandler('analyze-videos');
      const result = await handler(null, ['/path/a.mp4']);
      expect(analyzeAndGroupVideos).toHaveBeenCalledWith(['/path/a.mp4']);
      expect(result).toEqual(groups);
    });

    it('returns empty array when filePaths is null or undefined', async () => {
      const handler = getHandler('analyze-videos');
      expect(await handler(null, null)).toEqual([]);
      expect(await handler(null, undefined)).toEqual([]);
      expect(analyzeAndGroupVideos).not.toHaveBeenCalled();
    });

    it('returns empty array when filePaths is not an array', async () => {
      const handler = getHandler('analyze-videos');
      expect(await handler(null, 'string')).toEqual([]);
      expect(await handler(null, 123)).toEqual([]);
      expect(analyzeAndGroupVideos).not.toHaveBeenCalled();
    });
  });

  describe('get-total-file-size', () => {
    it('returns zeros for empty array', async () => {
      const handler = getHandler('get-total-file-size');
      const result = await handler(null, []);
      expect(result).toEqual({ totalBytes: 0, totalSizeFormatted: '0 Bytes' });
    });

    it('sums file sizes', async () => {
      fs.stat
        .mockResolvedValueOnce({ size: 100 })
        .mockResolvedValueOnce({ size: 200 });
      const handler = getHandler('get-total-file-size');
      const result = await handler(null, ['/a.mp4', '/b.mp4']);
      expect(result.totalBytes).toBe(300);
      expect(result.totalSizeFormatted).toBe('300 bytes');
    });
  });
});
