/**
 * Tests for main/ipc-merge-split.js - merge, split, trim validation edge cases
 */

const { ipcMain } = require('electron');
const { spawn } = require('child_process');

jest.mock('../src/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
const mockLoadPreferences = jest.fn().mockResolvedValue({
  preferredDateFormat: 'YYYY-MM-DD',
  knownSDCardPaths: ['/Volumes/GOPRO']
});
jest.mock('../src/preferences', () => {
  const actual = jest.requireActual('../src/preferences');
  return {
    ...actual,
    loadPreferences: (...args) => mockLoadPreferences(...args)
  };
});
jest.mock('../src/error-mapper', () => ({ mapError: jest.fn((e) => ({ userMessage: String(e), code: 'MAPPED' })) }));
jest.mock('../src/ffmpeg-resolver', () => ({ getFFmpegPath: () => '/usr/bin/ffmpeg', getFFprobePath: () => '/usr/bin/ffprobe' }));
jest.mock('child_process', () => {
  const { EventEmitter } = require('events');
  return {
    spawn: jest.fn(() => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdout = new EventEmitter();
      child.killed = false;
      child.kill = jest.fn(function kill() {
        this.killed = true;
      });
      return child;
    })
  };
});

const fs = require('fs').promises;
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      appendFile: jest.fn().mockResolvedValue(undefined)
    }
  };
});

const { registerMergeSplitIpcHandlers, MERGE_STALL_TIMEOUT_MS } = require('../main/ipc-merge-split');

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('ipc-merge-split', () => {
  const getMainWindow = () => null;

  beforeEach(() => {
    jest.clearAllMocks();
    registerMergeSplitIpcHandlers(getMainWindow);
  });

  function getHandler(channel) {
    const calls = ipcMain.handle.mock.calls.filter((c) => c[0] === channel);
    return calls.length ? calls[calls.length - 1][1] : null;
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

  describe('merge output plan', () => {
    it('prompts for Movies when sources are on /Volumes', async () => {
      const handler = getHandler('get-merge-output-plan');
      const plan = await handler(null, {
        filePaths: ['/Volumes/GOPRO/DCIM/GX010001.MP4'],
        creationTimesMs: [Date.parse('2026-10-17T12:00:00Z')]
      });
      expect(plan.shouldPromptForMoviesFolder).toBe(true);
      expect(plan.defaultFolderName).toContain('2026-10-17');
      expect(plan.moviesDirectory).toContain('Movies');
    });

    it('does not prompt for local sources', async () => {
      const handler = getHandler('get-merge-output-plan');
      const plan = await handler(null, {
        filePaths: ['/Users/me/clips/GX010001.MP4'],
        creationTimesMs: [Date.parse('2026-10-17T12:00:00Z')]
      });
      expect(plan.shouldPromptForMoviesFolder).toBe(false);
    });
  });

  describe('create-movies-merge-output', () => {
    const fsSync = require('fs');

    beforeEach(() => {
      jest.spyOn(fsSync, 'existsSync').mockReturnValue(false);
    });

    afterEach(() => {
      fsSync.existsSync.mockRestore();
    });

    it('creates a sanitized folder under Movies', async () => {
      const handler = getHandler('create-movies-merge-output');
      const result = await handler(null, '2026-10-17 GOPRO', { makeUnique: true });
      expect(result.folderName).toBe('2026-10-17 GOPRO');
      expect(result.path).toContain('Movies');
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('rejects empty folder names', async () => {
      const handler = getHandler('create-movies-merge-output');
      await expect(handler(null, '   ', { makeUnique: true })).rejects.toThrow('valid folder name');
    });
  });

  describe('merge-videos stall timeout', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not kill a merge that is still making progress after 5 minutes', async () => {
      jest.useFakeTimers();
      const handler = getHandler('merge-videos');
      const resultPromise = handler(null, ['/a.mp4'], '/tmp/out.mp4');
      await flushPromises();

      const ffmpeg = spawn.mock.results[0].value;
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(MERGE_STALL_TIMEOUT_MS - 1000);
        ffmpeg.stderr.emit('data', Buffer.from('frame=10 time=00:01:00.00 bitrate=1000kbits/s\n'));
        await flushPromises();
      }

      expect(ffmpeg.kill).not.toHaveBeenCalled();
      ffmpeg.emit('close', 0);
      await flushPromises();
      await expect(resultPromise).resolves.toEqual({ success: true, outputPath: '/tmp/out.mp4' });
    });

    it('kills a merge only after 5 minutes with no FFmpeg progress', async () => {
      jest.useFakeTimers();
      const handler = getHandler('merge-videos');
      const resultPromise = handler(null, ['/a.mp4'], '/tmp/out.mp4');
      await flushPromises();

      const ffmpeg = spawn.mock.results[0].value;
      jest.advanceTimersByTime(MERGE_STALL_TIMEOUT_MS - 1);
      expect(ffmpeg.kill).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(ffmpeg.kill).toHaveBeenCalledWith('SIGTERM');
      await expect(resultPromise).rejects.toThrow('FFmpeg operation timed out');
    });
  });
});
