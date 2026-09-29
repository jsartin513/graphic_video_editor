/**
 * Tests for src/youtube-upload.js
 */

jest.mock('../src/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() }
}));

jest.mock('../src/youtube-auth', () => ({
  getValidAccessToken: jest.fn().mockResolvedValue('access-token')
}));

const fs = require('fs').promises;
const {
  buildVideoMetadata,
  assertSupportedFormat,
  uploadVideoToYouTube,
  enqueueYouTubeUpload,
  resetYouTubeUploadStateForTests
} = require('../src/youtube-upload');

describe('youtube-upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetYouTubeUploadStateForTests();
    global.fetch = jest.fn();
  });

  describe('buildVideoMetadata', () => {
    it('sets privacy and madeForKids', () => {
      const meta = buildVideoMetadata({
        title: 'Test clip',
        description: 'Hello',
        privacyStatus: 'unlisted'
      });
      expect(meta.snippet.title).toBe('Test clip');
      expect(meta.status.privacyStatus).toBe('unlisted');
      expect(meta.status.selfDeclaredMadeForKids).toBe(false);
    });
  });

  describe('assertSupportedFormat', () => {
    it('allows mp4', () => {
      expect(() => assertSupportedFormat('/tmp/video.mp4')).not.toThrow();
    });
    it('rejects avi', () => {
      expect(() => assertSupportedFormat('/tmp/video.avi')).toThrow(/supports mp4/i);
    });
  });

  describe('uploadVideoToYouTube', () => {
    it('completes resumable upload and optional playlist', async () => {
      const statSpy = jest.spyOn(fs, 'stat').mockResolvedValue({ size: 4 });
      const openSpy = jest.spyOn(fs, 'open').mockResolvedValue({
        read: jest.fn(async (buf, _off, len, _pos) => ({ bytesRead: len })),
        close: jest.fn()
      });

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'https://upload.example/session' }
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'vid123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'playlistItem1' })
        });

      const progress = [];
      const result = await uploadVideoToYouTube(
        {
          filePath: '/tmp/out.mp4',
          title: 'My merge',
          privacyStatus: 'private',
          playlistId: 'PL123',
          uploadId: 'job-1'
        },
        (p) => progress.push(p)
      );

      expect(result.success).toBe(true);
      expect(result.videoId).toBe('vid123');
      expect(progress.some((p) => p.phase === 'complete')).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      statSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('succeeds when playlist insert fails after upload', async () => {
      const statSpy = jest.spyOn(fs, 'stat').mockResolvedValue({ size: 4 });
      const openSpy = jest.spyOn(fs, 'open').mockResolvedValue({
        read: jest.fn(async (buf, _off, len, _pos) => ({ bytesRead: len })),
        close: jest.fn()
      });

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'https://upload.example/session' }
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'vid456' })
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Forbidden',
          json: async () => ({ error: { message: 'playlist denied' } })
        });

      const result = await uploadVideoToYouTube({
        filePath: '/tmp/out.mp4',
        title: 'My merge',
        playlistId: 'PL123'
      });

      expect(result.success).toBe(true);
      expect(result.videoId).toBe('vid456');
      expect(result.playlistError).toMatch(/playlist denied/i);

      statSpy.mockRestore();
      openSpy.mockRestore();
    });
  });

  describe('enqueueYouTubeUpload', () => {
    it('rejects duplicate enqueue for the same file', async () => {
      const statSpy = jest.spyOn(fs, 'stat').mockResolvedValue({ size: 4 });
      const openSpy = jest.spyOn(fs, 'open').mockResolvedValue({
        read: jest.fn(async (buf, _off, len, _pos) => ({ bytesRead: len })),
        close: jest.fn()
      });

      global.fetch
        .mockResolvedValue({
          ok: true,
          headers: { get: () => 'https://upload.example/session' }
        })
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'vid1' })
        });

      const job = { filePath: '/tmp/dup.mp4', uploadId: '/tmp/dup.mp4', title: 't' };
      const first = enqueueYouTubeUpload(job);
      const second = await enqueueYouTubeUpload(job);
      expect(second.success).toBe(false);
      expect(second.error).toMatch(/already in progress/i);
      await first;

      statSpy.mockRestore();
      openSpy.mockRestore();
    });
  });
});
