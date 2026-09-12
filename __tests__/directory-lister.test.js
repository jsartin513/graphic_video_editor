const path = require('path');

jest.mock('../src/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));

const fs = require('fs').promises;
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: jest.fn(),
      readdir: jest.fn()
    }
  };
});

const {
  isVideoFile,
  parentDirectory,
  getBrowserRoots,
  listVolumes,
  listDirectory
} = require('../src/directory-lister');

function dirent(name, { directory = false, symlink = false } = {}) {
  return {
    name,
    isDirectory: () => directory,
    isFile: () => !directory && !symlink,
    isSymbolicLink: () => symlink
  };
}

describe('directory-lister', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isVideoFile', () => {
    it('recognizes video extensions case-insensitively', () => {
      expect(isVideoFile('a.mp4')).toBe(true);
      expect(isVideoFile('a.MOV')).toBe(true);
      expect(isVideoFile('a.txt')).toBe(false);
    });
  });

  describe('parentDirectory', () => {
    it('returns null at filesystem root', () => {
      expect(parentDirectory('/')).toBeNull();
    });

    it('returns the parent path', () => {
      expect(parentDirectory('/Users/me/Videos')).toBe('/Users/me');
    });
  });

  describe('getBrowserRoots', () => {
    it('omits missing paths', () => {
      expect(getBrowserRoots({ home: '/Users/me', desktop: '' })).toEqual([
        { id: 'home', label: 'Home', path: '/Users/me' }
      ]);
    });
  });

  describe('listVolumes', () => {
    it('returns volume names under /Volumes', async () => {
      fs.readdir.mockResolvedValue(['Macintosh HD', 'GOPRO']);
      await expect(listVolumes('/Volumes')).resolves.toEqual([
        { name: 'Macintosh HD', path: path.join('/Volumes', 'Macintosh HD') },
        { name: 'GOPRO', path: path.join('/Volumes', 'GOPRO') }
      ]);
    });

    it('returns empty array when listing fails', async () => {
      fs.readdir.mockRejectedValue(new Error('nope'));
      await expect(listVolumes('/Volumes')).resolves.toEqual([]);
    });
  });

  describe('listDirectory', () => {
    it('rejects a missing path', async () => {
      await expect(listDirectory('')).rejects.toThrow('Directory path is required');
    });

    it('rejects a file path', async () => {
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      await expect(listDirectory('/tmp/a.mp4')).rejects.toThrow('Not a directory');
    });

    it('returns folders and video files, skipping other files', async () => {
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue([
        dirent('.DS_Store'),
        dirent('.hidden', { directory: true }),
        dirent('clips', { directory: true }),
        dirent('notes.txt'),
        dirent('game.MP4'),
        dirent('b.mov')
      ]);
      // hidden starts with . so skipped; .DS_Store skipped
      const listing = await listDirectory('/Users/me/Videos');
      expect(listing.path).toBe('/Users/me/Videos');
      expect(listing.parent).toBe('/Users/me');
      expect(listing.entries.map((e) => e.name)).toEqual(['clips', 'b.mov', 'game.MP4']);
      expect(listing.entries[0].isDirectory).toBe(true);
      expect(listing.entries[1].isVideo).toBe(true);
    });
  });
});
