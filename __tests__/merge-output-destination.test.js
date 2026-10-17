const path = require('path');
const {
  isPathOnRemovableVolume,
  anySourceOnRemovableVolume,
  deriveRecordingDateFolderName,
  resolveUniqueDirectoryPath,
  buildDefaultMoviesFolderName,
  extractVolumeNameFromPath,
  sanitizeFolderName,
  shouldPersistLastOutputDestination
} = require('../src/merge-output-destination');

describe('merge-output-destination', () => {
  describe('isPathOnRemovableVolume', () => {
    it('detects paths under /Volumes on darwin', () => {
      expect(isPathOnRemovableVolume('/Volumes/GOPRO/DCIM/100GOPRO/GX010001.MP4', {
        platform: 'darwin'
      })).toBe(true);
      expect(isPathOnRemovableVolume('/Users/me/Movies/out.mp4', {
        platform: 'darwin'
      })).toBe(false);
    });

    it('honors known SD card roots from preferences', () => {
      expect(isPathOnRemovableVolume('/mnt/sdcard/clip.MP4', {
        platform: 'linux',
        knownRemovableRoots: ['/mnt/sdcard']
      })).toBe(true);
    });
  });

  describe('anySourceOnRemovableVolume', () => {
    it('returns true when any clip is on removable media', () => {
      const files = [
        '/Users/me/Movies/a.mp4',
        '/Volumes/CARD/DCIM/GX010001.MP4'
      ];
      expect(anySourceOnRemovableVolume(files, { platform: 'darwin' })).toBe(true);
      expect(anySourceOnRemovableVolume(['/Users/me/a.mp4'], { platform: 'darwin' })).toBe(false);
    });
  });

  describe('deriveRecordingDateFolderName', () => {
    it('uses the latest recording day', () => {
      const early = Date.parse('2026-10-15T10:00:00Z');
      const late = Date.parse('2026-10-17T18:00:00Z');
      expect(deriveRecordingDateFolderName([early, late], 'YYYY-MM-DD')).toBe('2026-10-17');
    });

    it('falls back to today when times are unknown', () => {
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(deriveRecordingDateFolderName([], 'YYYY-MM-DD')).toBe(expected);
    });
  });

  describe('resolveUniqueDirectoryPath', () => {
    it('appends a numeric suffix when the folder already exists', () => {
      const existing = new Set([
        path.join('/Movies', '2026-10-17'),
        path.join('/Movies', '2026-10-17-2')
      ]);
      const result = resolveUniqueDirectoryPath(
        '/Movies',
        '2026-10-17',
        (candidate) => existing.has(candidate)
      );
      expect(result.folderName).toBe('2026-10-17-3');
      expect(result.dirPath).toBe(path.join('/Movies', '2026-10-17-3'));
    });

    it('sanitizes invalid characters', () => {
      const result = resolveUniqueDirectoryPath('/Movies', 'bad/name', () => false);
      expect(result.folderName).toBe('bad_name');
    });
  });

  describe('buildDefaultMoviesFolderName', () => {
    it('includes volume name when provided', () => {
      expect(buildDefaultMoviesFolderName('2026-10-17', 'GOPRO')).toBe('2026-10-17 GOPRO');
    });
  });

  describe('extractVolumeNameFromPath', () => {
    it('reads the volume segment after /Volumes', () => {
      expect(extractVolumeNameFromPath('/Volumes/NO NAME/DCIM/x.MP4')).toBe('NO NAME');
    });
  });

  describe('sanitizeFolderName', () => {
    it('rejects empty names after sanitization', () => {
      expect(sanitizeFolderName('   ')).toBe('output');
    });
  });

  describe('shouldPersistLastOutputDestination', () => {
    it('persists only explicit Change folder / picker choices', () => {
      expect(shouldPersistLastOutputDestination('user-picker')).toBe(true);
      expect(shouldPersistLastOutputDestination('movies-modal')).toBe(false);
    });
  });
});
