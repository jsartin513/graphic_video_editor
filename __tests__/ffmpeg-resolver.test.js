/**
 * Tests for ffmpeg-resolver module
 */

jest.mock('electron');
jest.mock('../src/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Prevent tests from accidentally using real system binaries
// via findSystemExecutablePath()'s direct path probing.
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    accessSync: jest.fn(() => {
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    })
  };
});

const { EventEmitter } = require('events');

const mockSpawn = jest.fn();
const mockExecSync = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
  execSync: (...args) => mockExecSync(...args)
}));

/**
 * Creates a mock child process that emits close after a tick.
 */
function makeMockChild({ exitCode = 0, data = null, autoEmit = true } = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.kill = jest.fn(() => {
    process.nextTick(() => child.emit('close', null));
  });
  if (autoEmit) {
    process.nextTick(() => {
      if (data) child.stdout.emit('data', data);
      child.emit('close', exitCode);
    });
  }
  return child;
}

/**
 * Creates a mock child process that emits 'error' when its 'error' listener is registered.
 * This avoids the race between emitting and registering when the spawn happens in an async callback.
 */
function makeMockErrorChild(err = new Error('spawn ENOENT')) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.kill = jest.fn();
  const origOn = child.on.bind(child);
  child.on = (event, handler) => {
    origOn(event, handler);
    if (event === 'error') {
      process.nextTick(() => child.emit('error', err));
    }
    return child;
  };
  return child;
}

describe('ffmpeg-resolver', () => {
  let resolver;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSpawn.mockReset();
    mockExecSync.mockReset();
    resolver = require('../src/ffmpeg-resolver');
  });

  describe('getFFmpegPath', () => {
    it('returns a string path', () => {
      const result = resolver.getFFmpegPath();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('caches the result on subsequent calls', () => {
      const first = resolver.getFFmpegPath();
      const second = resolver.getFFmpegPath();
      expect(first).toBe(second);
    });
  });

  describe('getFFprobePath', () => {
    it('returns a string path', () => {
      const result = resolver.getFFprobePath();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('caches the result on subsequent calls', () => {
      const first = resolver.getFFprobePath();
      const second = resolver.getFFprobePath();
      expect(first).toBe(second);
    });
  });

  describe('checkFFmpeg', () => {
    it('resolves with installed=true when bundled binaries succeed', async () => {
      // In the test env, getBundledBinaryPath returns ffmpeg-static / ffprobe-static paths,
      // so the bundled branch is taken. Mock three spawn calls: ffmpeg, ffprobe, brew.
      mockSpawn
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0, data: 'ffmpeg version 5.1.0 built' }))
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }))
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }));

      const result = await resolver.checkFFmpeg();

      expect(result.installed).toBe(true);
      expect(result.ffmpegFound).toBe(true);
      expect(result.ffprobeFound).toBe(true);
      expect(result.brewFound).toBe(true);
      expect(result.ffmpegVersion).toBe('5.1.0');
    });

    it('resolves with installed=false when ffmpeg binary fails', async () => {
      mockSpawn
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 }))
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }))
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }));

      const result = await resolver.checkFFmpeg();

      expect(result.installed).toBe(false);
      expect(result.ffmpegFound).toBe(false);
    });

    it('resolves with installed=false when ffprobe binary fails', async () => {
      mockSpawn
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0, data: 'ffmpeg version 5.1.0' }))
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 }))
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }));

      const result = await resolver.checkFFmpeg();

      expect(result.installed).toBe(false);
      expect(result.ffmpegFound).toBe(true);
      expect(result.ffprobeFound).toBe(false);
    });

    it('resolves when ffmpeg spawn emits an error', async () => {
      const errChild = new EventEmitter();
      errChild.stdout = new EventEmitter();
      errChild.kill = jest.fn();
      process.nextTick(() => errChild.emit('error', new Error('spawn ENOENT')));

      mockSpawn.mockImplementationOnce(() => errChild);

      const result = await resolver.checkFFmpeg();

      expect(result.installed).toBe(false);
      expect(result.ffmpegFound).toBe(false);
    });

    it('resolves when ffprobe spawn emits an error', async () => {
      mockSpawn
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0, data: 'ffmpeg version 5.1.0' }))
        .mockImplementationOnce(() => makeMockErrorChild());

      const result = await resolver.checkFFmpeg();

      expect(result.ffmpegFound).toBe(true);
      expect(result.ffprobeFound).toBe(false);
      expect(result.installed).toBe(false);
    });

    it('resolves when brew check emits an error event', async () => {
      mockSpawn
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0, data: 'ffmpeg version 5.1.0' }))
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }))
        .mockImplementationOnce(() => makeMockErrorChild());

      const result = await resolver.checkFFmpeg();

      expect(result.installed).toBe(true);
      expect(result.brewFound).toBe(false);
    });

    it('kills ffmpeg process when timeout fires', async () => {
      jest.useFakeTimers();

      const slowChild = new EventEmitter();
      slowChild.stdout = new EventEmitter();
      slowChild.kill = jest.fn(() => {
        process.nextTick(() => slowChild.emit('close', null));
      });
      // Never auto-emits close — relies on kill() from the timer

      mockSpawn.mockImplementationOnce(() => slowChild);

      const promise = resolver.checkFFmpeg();

      jest.advanceTimersByTime(5000);
      await promise;

      expect(slowChild.kill).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('with system binaries (no bundled ffmpeg)', () => {
    const localSpawnMock = jest.fn();
    const localExecSyncMock = jest.fn();

    beforeEach(() => {
      jest.resetModules();
      localSpawnMock.mockReset();
      localExecSyncMock.mockReset();
      // Mock ffmpeg-static and ffprobe-static to throw so getBundledBinaryPath returns null
      jest.doMock('ffmpeg-static', () => { throw new Error('not available'); });
      jest.doMock('ffprobe-static', () => { throw new Error('not available'); });
      jest.doMock('../src/logger', () => ({
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
      }));
      jest.doMock('child_process', () => ({
        spawn: (...args) => localSpawnMock(...args),
        execSync: (...args) => localExecSyncMock(...args)
      }));
    });

    it('getFFmpegPath falls back to system path', () => {
      localExecSyncMock.mockReturnValue('/usr/local/bin/ffmpeg\n');
      const localResolver = require('../src/ffmpeg-resolver');

      const result = localResolver.getFFmpegPath();
      expect(result).toBe('/usr/local/bin/ffmpeg');
    });

    it('getFFmpegPath returns "ffmpeg" string when not found anywhere', () => {
      localExecSyncMock.mockImplementation(() => { throw new Error('not found'); });
      const localResolver = require('../src/ffmpeg-resolver');

      const result = localResolver.getFFmpegPath();
      expect(result).toBe('ffmpeg');
    });

    it('getFFprobePath falls back to system path', () => {
      localExecSyncMock.mockReturnValue('/usr/local/bin/ffprobe\n');
      const localResolver = require('../src/ffmpeg-resolver');

      const result = localResolver.getFFprobePath();
      expect(result).toBe('/usr/local/bin/ffprobe');
    });

    it('checkFFmpeg resolves with system binaries (happy path)', async () => {
      localExecSyncMock.mockReturnValue('/usr/local/bin/ffmpeg\n');
      // Spawn order: which ffmpeg, which ffprobe, which brew, then ffmpeg -version (async)
      localSpawnMock
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 })) // which ffmpeg
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 })) // which ffprobe
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 })) // which brew
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0, data: 'ffmpeg version 6.0' })); // version check

      const localResolver = require('../src/ffmpeg-resolver');
      const result = await localResolver.checkFFmpeg();

      expect(result.ffmpegFound).toBe(true);
      expect(result.ffprobeFound).toBe(true);
      expect(result.ffmpegVersion).toBe('6.0');
      expect(result.brewFound).toBe(false);
      expect(result.installed).toBe(true);
    });

    it('checkFFmpeg resolves when which commands all fail', async () => {
      localExecSyncMock.mockImplementation(() => { throw new Error('not found'); });
      localSpawnMock
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 })) // which ffmpeg
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 })) // which ffprobe
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 })); // which brew

      const localResolver = require('../src/ffmpeg-resolver');
      const result = await localResolver.checkFFmpeg();

      expect(result.installed).toBe(false);
      expect(result.ffmpegFound).toBe(false);
      expect(result.ffprobeFound).toBe(false);
    });

    it('checkFFmpeg handles version check spawn error', async () => {
      localExecSyncMock.mockReturnValue('/usr/local/bin/ffmpeg\n');
      localSpawnMock
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 })) // which ffmpeg
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 })) // which ffprobe
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 })) // which brew
        .mockImplementationOnce(() => makeMockErrorChild()); // version check errors

      const localResolver = require('../src/ffmpeg-resolver');
      const result = await localResolver.checkFFmpeg();

      expect(result.ffmpegFound).toBe(true);
      expect(result.ffmpegVersion).toBeNull();
    });

    it('checkFFmpeg handles ffmpegCheck spawn error', async () => {
      localExecSyncMock.mockImplementation(() => { throw new Error('not found'); });
      const errChild = new EventEmitter();
      errChild.stdout = new EventEmitter();
      errChild.kill = jest.fn();
      process.nextTick(() => errChild.emit('error', new Error('spawn failed')));

      localSpawnMock
        .mockImplementationOnce(() => errChild)                          // which ffmpeg errors
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 }))   // which ffprobe
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }));  // which brew

      const localResolver = require('../src/ffmpeg-resolver');
      const result = await localResolver.checkFFmpeg();

      expect(result).toHaveProperty('installed');
      expect(result.ffmpegFound).toBe(false);
    });

    it('checkFFmpeg handles ffprobeCheck spawn error', async () => {
      localExecSyncMock.mockImplementation(() => { throw new Error('not found'); });
      const errChild = new EventEmitter();
      errChild.stdout = new EventEmitter();
      errChild.kill = jest.fn();
      process.nextTick(() => errChild.emit('error', new Error('spawn failed')));

      localSpawnMock
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 }))   // which ffmpeg
        .mockImplementationOnce(() => errChild)                          // which ffprobe errors
        .mockImplementationOnce(() => makeMockChild({ exitCode: 0 }));  // which brew

      const localResolver = require('../src/ffmpeg-resolver');
      const result = await localResolver.checkFFmpeg();

      expect(result).toHaveProperty('installed');
      expect(result.ffprobeFound).toBe(false);
    });

    it('checkFFmpeg handles brewCheck spawn error', async () => {
      localExecSyncMock.mockImplementation(() => { throw new Error('not found'); });
      const errChild = new EventEmitter();
      errChild.stdout = new EventEmitter();
      errChild.kill = jest.fn();
      process.nextTick(() => errChild.emit('error', new Error('spawn failed')));

      localSpawnMock
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 }))   // which ffmpeg
        .mockImplementationOnce(() => makeMockChild({ exitCode: 1 }))   // which ffprobe
        .mockImplementationOnce(() => errChild);                         // which brew errors

      const localResolver = require('../src/ffmpeg-resolver');
      const result = await localResolver.checkFFmpeg();

      expect(result).toHaveProperty('installed');
      expect(result.brewFound).toBe(false);
    });
  });
});
