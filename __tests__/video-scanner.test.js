/**
 * Tests for video-scanner module
 */

jest.mock('../src/logger', () => ({ logger: { error: jest.fn() } }));

const fs = require('fs').promises;

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readdir: jest.fn()
    }
  };
});

const { scanDirectoryForVideos, VIDEO_EXTENSIONS } = require('../src/video-scanner');

describe('video-scanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('VIDEO_EXTENSIONS', () => {
    it('includes expected video extensions', () => {
      expect(VIDEO_EXTENSIONS).toContain('.mp4');
      expect(VIDEO_EXTENSIONS).toContain('.mov');
      expect(VIDEO_EXTENSIONS).not.toContain('.MP4');
    });
  });

  describe('scanDirectoryForVideos', () => {
    it('returns video files from directory', async () => {
      const dirEntry = { name: 'subdir', isDirectory: () => true, isFile: () => false };
      const fileEntry = { name: 'video.mp4', isDirectory: () => false, isFile: () => true };
      const subFileEntry = { name: 'GX010001.MP4', isDirectory: () => false, isFile: () => true };
      fs.readdir
        .mockResolvedValueOnce([dirEntry, fileEntry])
        .mockResolvedValueOnce([subFileEntry]);

      const result = await scanDirectoryForVideos('/path/to/videos');

      expect(result).toContain('/path/to/videos/subdir/GX010001.MP4');
      expect(result).toContain('/path/to/videos/video.mp4');
    });

    it('skips non-video files', async () => {
      fs.readdir.mockResolvedValueOnce([
        { name: 'video.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'readme.txt', isDirectory: () => false, isFile: () => true },
        { name: 'image.jpg', isDirectory: () => false, isFile: () => true }
      ]);

      const result = await scanDirectoryForVideos('/path');

      expect(result).toEqual(['/path/video.mp4']);
    });

    it('recursively scans subdirectories', async () => {
      const subdir = { name: 'nested', isDirectory: () => true };
      fs.readdir
        .mockResolvedValueOnce([subdir])
        .mockResolvedValueOnce([{ name: 'clip.mov', isDirectory: () => false, isFile: () => true }]);

      const result = await scanDirectoryForVideos('/root');

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('/root/nested/clip.mov');
    });

    it('returns empty array on readdir error', async () => {
      fs.readdir.mockRejectedValue(new Error('permission denied'));

      const result = await scanDirectoryForVideos('/path');

      expect(result).toEqual([]);
    });
  });
});
