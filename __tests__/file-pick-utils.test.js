const {
  getFilePath,
  getPathsFromFileList,
  getRootFolderFromFiles,
  fileUrlToPath,
  pathsFromUriList,
  isOsFileDrop,
  pathsFromDataTransfer
} = require('../src/file-pick-utils');

describe('file-pick-utils', () => {
  describe('getFilePath', () => {
    it('returns File.path when present', () => {
      expect(getFilePath({ path: '/tmp/a.mp4' })).toBe('/tmp/a.mp4');
    });

    it('returns empty string for missing or invalid files', () => {
      expect(getFilePath(null)).toBe('');
      expect(getFilePath({})).toBe('');
      expect(getFilePath({ path: 123 })).toBe('');
    });

    it('falls back to webUtils when File.path is missing', () => {
      const getPath = jest.fn(() => '/tmp/via-webutils.mp4');
      expect(getFilePath({ name: 'via-webutils.mp4' }, getPath)).toBe('/tmp/via-webutils.mp4');
      expect(getPath).toHaveBeenCalled();
    });
  });

  describe('getPathsFromFileList', () => {
    it('collects non-empty paths', () => {
      expect(getPathsFromFileList([
        { path: '/a.mp4' },
        { path: '' },
        { path: '/b.mov' }
      ])).toEqual(['/a.mp4', '/b.mov']);
    });
  });

  describe('getRootFolderFromFiles', () => {
    it('returns parent dir for a flat selection', () => {
      expect(getRootFolderFromFiles([
        { path: '/Users/me/Videos/a.mp4', webkitRelativePath: 'a.mp4' }
      ])).toBe('/Users/me/Videos');
    });

    it('returns root for a nested webkitdirectory selection', () => {
      expect(getRootFolderFromFiles([
        { path: '/Users/me/Videos/sub/a.mp4', webkitRelativePath: 'sub/a.mp4' }
      ])).toBe('/Users/me/Videos');
    });

    it('returns null for an empty list', () => {
      expect(getRootFolderFromFiles([])).toBeNull();
    });
  });

  describe('fileUrlToPath / pathsFromUriList', () => {
    it('converts file URLs and leaves POSIX paths', () => {
      expect(fileUrlToPath('file:///Users/me/clip.mp4')).toBe('/Users/me/clip.mp4');
      expect(fileUrlToPath('/Users/me/clip.mp4')).toBe('/Users/me/clip.mp4');
    });

    it('parses a uri-list', () => {
      expect(pathsFromUriList('#comment\nfile:///tmp/a.mp4\nfile:///tmp/b.mov\n')).toEqual([
        '/tmp/a.mp4',
        '/tmp/b.mov'
      ]);
    });
  });

  describe('isOsFileDrop / pathsFromDataTransfer', () => {
    it('detects Finder-style Files drops', () => {
      expect(isOsFileDrop({ types: ['Files'], files: [] })).toBe(true);
      expect(isOsFileDrop({ types: ['text/plain'], files: [] })).toBe(false);
    });

    it('uses File.path when present', () => {
      expect(pathsFromDataTransfer({
        files: [{ path: '/tmp/a.mp4' }],
        getData: () => ''
      })).toEqual(['/tmp/a.mp4']);
    });

    it('falls back to text/uri-list', () => {
      expect(pathsFromDataTransfer({
        files: [],
        getData: (type) => (type === 'text/uri-list' ? 'file:///tmp/a.mp4' : '')
      })).toEqual(['/tmp/a.mp4']);
    });
  });
});
