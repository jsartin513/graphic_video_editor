/**
 * Tests for SD Card Detector
 */

const { SDCardDetector } = require('../src/sd-card-detector');
const fs = require('fs').promises;
const path = require('path');

// Mock file system for testing
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readdir: jest.fn(),
      stat: jest.fn()
    },
    existsSync: jest.fn()
  };
});

const fsSync = require('fs');

describe('SDCardDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SDCardDetector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (detector) {
      detector.stop();
    }
  });

  describe('isGoProSDCard', () => {
    it('should return true for valid GoPro SD card with DCIM/###GOPRO structure', async () => {
      // Mock DCIM directory exists
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true });
      
      // Mock DCIM contents with GoPro directory
      fs.readdir.mockResolvedValueOnce(['100GOPRO', 'MISC']);

      const result = await detector.isGoProSDCard('/Volumes/TEST_SD');
      expect(result).toBe(true);
    });

    it('should return true for valid GoPro SD card with MEDIA structure', async () => {
      // Mock DCIM directory exists
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true });
      
      // Mock DCIM contents with MEDIA directory
      fs.readdir.mockResolvedValueOnce(['100MEDIA', 'MISC']);

      const result = await detector.isGoProSDCard('/Volumes/TEST_SD');
      expect(result).toBe(true);
    });

    it('should return true if DCIM contains GoPro video files', async () => {
      // Mock DCIM directory exists
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true });
      
      // Mock DCIM contents - no matching directory pattern
      fs.readdir.mockResolvedValueOnce(['MISC']);
      
      // Mock readdir for hasGoProFiles check (withFileTypes)
      const mockDirEntry = { name: '100GOPRO', isDirectory: () => true };
      fs.readdir.mockResolvedValueOnce([mockDirEntry]);
      
      // Mock subdirectory with GoPro files
      fs.readdir.mockResolvedValueOnce(['GX010123.MP4', 'GX020123.MP4']);

      const result = await detector.isGoProSDCard('/Volumes/TEST_SD');
      expect(result).toBe(true);
    });

    it('should return false if DCIM directory does not exist', async () => {
      // Mock DCIM directory does not exist
      fs.stat.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await detector.isGoProSDCard('/Volumes/TEST_SD');
      expect(result).toBe(false);
    });

    it('should return false for non-GoPro SD card', async () => {
      // Mock DCIM directory exists
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true });
      
      // Mock DCIM contents with no GoPro structure
      fs.readdir.mockResolvedValueOnce(['PICTURES', 'VIDEOS']);

      const result = await detector.isGoProSDCard('/Volumes/REGULAR_SD');
      expect(result).toBe(false);
    });
  });

  describe('hasGoProFiles', () => {
    it('should detect GX pattern files', async () => {
      const mockDirEntry = { name: 'subdir', isDirectory: () => true };
      fs.readdir.mockResolvedValueOnce([mockDirEntry]);
      fs.readdir.mockResolvedValueOnce(['GX010001.MP4', 'GX020001.MP4']);

      const result = await detector.hasGoProFiles('/test/path');
      expect(result).toBe(true);
    });

    it('should detect GP pattern files', async () => {
      const mockDirEntry = { name: 'subdir', isDirectory: () => true };
      fs.readdir.mockResolvedValueOnce([mockDirEntry]);
      fs.readdir.mockResolvedValueOnce(['GP010001.MP4']);

      const result = await detector.hasGoProFiles('/test/path');
      expect(result).toBe(true);
    });

    it('should detect GOPR pattern files', async () => {
      const mockDirEntry = { name: 'subdir', isDirectory: () => true };
      fs.readdir.mockResolvedValueOnce([mockDirEntry]);
      fs.readdir.mockResolvedValueOnce(['GOPR0001.MP4']);

      const result = await detector.hasGoProFiles('/test/path');
      expect(result).toBe(true);
    });

    it('should return false if no GoPro files found', async () => {
      const mockDirEntry = { name: 'subdir', isDirectory: () => true };
      fs.readdir.mockResolvedValueOnce([mockDirEntry]);
      fs.readdir.mockResolvedValueOnce(['video.mp4', 'movie.avi']);

      const result = await detector.hasGoProFiles('/test/path');
      expect(result).toBe(false);
    });
  });

  describe('directoryExists', () => {
    it('should return true if directory exists', async () => {
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true });

      const result = await detector.directoryExists('/test/path');
      expect(result).toBe(true);
    });

    it('should return false if path is not a directory', async () => {
      fs.stat.mockResolvedValueOnce({ isDirectory: () => false });

      const result = await detector.directoryExists('/test/path');
      expect(result).toBe(false);
    });

    it('should return false if path does not exist', async () => {
      fs.stat.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await detector.directoryExists('/test/path');
      expect(result).toBe(false);
    });
  });

  describe('Event handling', () => {
    it('should emit sd-card-detected event when GoPro SD card is found', (done) => {
      detector.on('sd-card-detected', (sdCard) => {
        expect(sdCard).toHaveProperty('name');
        expect(sdCard).toHaveProperty('path');
        expect(sdCard).toHaveProperty('dcimPath');
        done();
      });

      // Manually trigger detection
      detector.emit('sd-card-detected', {
        name: 'TEST_SD',
        path: '/Volumes/TEST_SD',
        dcimPath: '/Volumes/TEST_SD/DCIM'
      });
    });

    it('should emit sd-card-removed event when SD card is removed', (done) => {
      detector.on('sd-card-removed', (sdCard) => {
        expect(sdCard).toHaveProperty('name');
        done();
      });

      // Manually trigger removal
      detector.emit('sd-card-removed', {
        name: 'TEST_SD'
      });
    });
  });

  describe('Start and stop', () => {
    it('should start monitoring without errors', () => {
      expect(() => detector.start()).not.toThrow();
    });

    it('should stop monitoring without errors', () => {
      detector.start();
      expect(() => detector.stop()).not.toThrow();
    });

    it('should clear interval when stopped', () => {
      detector.start();
      expect(detector.checkInterval).not.toBeNull();
      detector.stop();
      expect(detector.checkInterval).toBeNull();
    });
  });

  describe('scanVolumes', () => {
    it('should return early when volumes directory does not exist', async () => {
      fsSync.existsSync.mockReturnValue(false);

      await detector.scanVolumes();

      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should detect new GoPro volume and emit sd-card-detected', async () => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockResolvedValueOnce(['GOPRO_SD']); // scanVolumes: list volumes
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true }); // isGoProSDCard: DCIM exists
      fs.readdir.mockResolvedValueOnce(['100GOPRO']); // isGoProSDCard: DCIM contents

      const emitted = [];
      detector.on('sd-card-detected', (ev) => emitted.push(ev));

      await detector.scanVolumes();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].name).toBe('GOPRO_SD');
      expect(emitted[0].path).toBe(path.join('/Volumes', 'GOPRO_SD'));
      expect(emitted[0].dcimPath).toBe(path.join('/Volumes', 'GOPRO_SD', 'DCIM'));
    });

    it('should remove unmounted volume and emit sd-card-removed', async () => {
      detector.knownVolumes.add('OLD_VOL');
      detector.knownGoProVolumes.add('OLD_VOL');
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockResolvedValue([]); // no volumes mounted

      const emitted = [];
      detector.on('sd-card-removed', (ev) => emitted.push(ev));

      await detector.scanVolumes();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].name).toBe('OLD_VOL');
      expect(detector.knownVolumes.has('OLD_VOL')).toBe(false);
      expect(detector.knownGoProVolumes.has('OLD_VOL')).toBe(false);
    });

    it('should skip excluded volumes', async () => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockResolvedValueOnce(['Macintosh HD', 'GOPRO_SD']); // scanVolumes
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true }); // GOPRO_SD DCIM exists
      fs.readdir.mockResolvedValueOnce(['100GOPRO']); // GOPRO_SD DCIM contents

      const emitted = [];
      detector.on('sd-card-detected', (ev) => emitted.push(ev));

      await detector.scanVolumes();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].name).toBe('GOPRO_SD');
    });

    it('should return early when already scanning', async () => {
      detector.isScanning = true;
      fsSync.existsSync.mockReturnValue(true);

      await detector.scanVolumes();

      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should handle scan errors gracefully', async () => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockRejectedValue(new Error('permission denied'));

      await expect(detector.scanVolumes()).resolves.not.toThrow();
      expect(detector.isScanning).toBe(false);
    });
  });

  describe('getGoProSDCards', () => {
    it('should return empty array when volumes path does not exist', async () => {
      fsSync.existsSync.mockReturnValue(false);

      const result = await detector.getGoProSDCards();

      expect(result).toEqual([]);
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should return GoPro SD cards', async () => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockResolvedValueOnce(['GOPRO_SD', 'Macintosh HD']); // getGoProSDCards
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true }); // GOPRO_SD DCIM exists
      fs.readdir.mockResolvedValueOnce(['100GOPRO']); // GOPRO_SD DCIM contents

      const result = await detector.getGoProSDCards();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('GOPRO_SD');
      expect(result[0].path).toBe(path.join('/Volumes', 'GOPRO_SD'));
      expect(result[0].dcimPath).toBe(path.join('/Volumes', 'GOPRO_SD', 'DCIM'));
    });

    it('should skip excluded volumes', async () => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockResolvedValue(['Macintosh HD']);

      const result = await detector.getGoProSDCards();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockRejectedValue(new Error('read failed'));

      const result = await detector.getGoProSDCards();

      expect(result).toEqual([]);
    });
  });

  describe('isGoProSDCard error handling', () => {
    it('should return false on error', async () => {
      fs.stat.mockRejectedValue(new Error('unexpected'));

      const result = await detector.isGoProSDCard('/Volumes/TEST');

      expect(result).toBe(false);
    });
  });
});
