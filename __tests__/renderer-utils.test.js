/**
 * Tests for src/renderer-utils.js - pure utility functions used by renderer
 */

const {
  getFileName,
  formatDuration,
  getDirectoryPath,
  getDirectoryName,
  debounce,
  formatBitrate,
  formatResolution,
  formatFrameRate,
  formatTimeForFFmpeg
} = require('../src/renderer-utils');

describe('renderer-utils', () => {
  describe('getFileName', () => {
    it('extracts filename from path', () => {
      expect(getFileName('/path/to/video.mp4')).toBe('video.mp4');
      expect(getFileName('C:\\Users\\videos\\clip.mov')).toBe('clip.mov');
      expect(getFileName('video.mp4')).toBe('video.mp4');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds as MM:SS', () => {
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(90)).toBe('1:30');
    });

    it('formats hours as HH:MM:SS', () => {
      expect(formatDuration(3661)).toBe('1:01:01');
      expect(formatDuration(3600)).toBe('1:00:00');
    });

    it('returns Unknown for invalid input', () => {
      expect(formatDuration(null)).toBe('Unknown');
      expect(formatDuration(undefined)).toBe('Unknown');
      expect(formatDuration(NaN)).toBe('Unknown');
      expect(formatDuration('')).toBe('Unknown');
      expect(formatDuration('  ')).toBe('Unknown');
    });
  });

  describe('getDirectoryPath', () => {
    it('returns directory from file path', () => {
      expect(getDirectoryPath('/path/to/video.mp4')).toBe('/path/to');
      expect(getDirectoryPath('video.mp4')).toBe('.');
      expect(getDirectoryPath('/video.mp4')).toBe('/');
    });

    it('handles Windows paths', () => {
      expect(getDirectoryPath('C:\\videos\\clip.mp4')).toBe('C:\\videos');
      expect(getDirectoryPath('C:/videos/clip.mp4')).toBe('C:/videos');
      expect(getDirectoryPath('C:\\clip.mp4')).toBe('C:\\');
    });

    it('returns . for empty or invalid', () => {
      expect(getDirectoryPath('')).toBe('.');
      expect(getDirectoryPath()).toBe('.');
    });
  });

  describe('getDirectoryName', () => {
    it('returns parent directory name', () => {
      expect(getDirectoryName('/path/to/videos')).toBe('to');
      expect(getDirectoryName('C:\\Users\\Documents')).toBe('Users');
    });

    it('returns root for shallow paths', () => {
      expect(getDirectoryName('/videos')).toBe('root');
      expect(getDirectoryName('')).toBe('root');
    });
  });

  describe('debounce', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('delays execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);
      debounced();
      expect(fn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('cancels previous call when invoked again', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);
      debounced();
      debounced();
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatBitrate', () => {
    it('formats in Kbps', () => {
      expect(formatBitrate(128000)).toBe('128 Kbps');
      expect(formatBitrate(192000)).toBe('192 Kbps');
    });

    it('formats in Mbps', () => {
      expect(formatBitrate(1500000)).toBe('1.50 Mbps');
      expect(formatBitrate(5000000)).toBe('5.00 Mbps');
    });

    it('returns Unknown for invalid', () => {
      expect(formatBitrate(null)).toBe('Unknown');
      expect(formatBitrate(NaN)).toBe('Unknown');
    });
  });

  describe('formatResolution', () => {
    it('formats width x height', () => {
      expect(formatResolution(1920, 1080)).toBe('1920x1080');
    });

    it('returns Unknown for missing values', () => {
      expect(formatResolution(null, 1080)).toBe('Unknown');
      expect(formatResolution(1920, null)).toBe('Unknown');
    });
  });

  describe('formatFrameRate', () => {
    it('formats fps', () => {
      expect(formatFrameRate(30)).toBe('30 fps');
      expect(formatFrameRate(29.97)).toBe('29.97 fps');
    });

    it('returns Unknown for invalid', () => {
      expect(formatFrameRate(null)).toBe('Unknown');
      expect(formatFrameRate(NaN)).toBe('Unknown');
    });
  });

  describe('formatTimeForFFmpeg', () => {
    it('formats as HH:MM:SS', () => {
      expect(formatTimeForFFmpeg(0)).toBe('00:00:00');
      expect(formatTimeForFFmpeg(65)).toBe('00:01:05');
      expect(formatTimeForFFmpeg(3661)).toBe('01:01:01');
    });
  });
});
