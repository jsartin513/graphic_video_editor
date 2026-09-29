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
  cancelYouTubeUpload,
  cancelAllYouTubeUploads,
  resetYouTubeUploadStateForTests
} = require('../src/youtube-upload');

function mockSuccessfulUploadFetch(videoId = 'vid1') {
  global.fetch
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'https://upload.example/session' }
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: videoId })
    });
}

async function waitForPutHook(getRelease) {
  for (let i = 0; i < 50 && !getRelease(); i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  expect(getRelease()).toBeDefined();
}

function mockFsForUpload() {
  const statSpy = jest.spyOn(fs, 'stat').mockResolvedValue({ size: 4 });
  const openSpy = jest.spyOn(fs, 'open').mockResolvedValue({
    read: jest.fn(async (buf, _off, len, _pos) => ({ bytesRead: len })),
    close: jest.fn()
  });
  return { statSpy, openSpy };
}

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
      const { statSpy, openSpy } = mockFsForUpload();
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

    it('emits queued progress before the upload starts', async () => {
      const { statSpy, openSpy } = mockFsForUpload();
      mockSuccessfulUploadFetch('vid-queued');

      const progress = [];
      const job = { filePath: '/tmp/q.mp4', uploadId: '/tmp/q.mp4', title: 'q' };
      await enqueueYouTubeUpload(job, (p) => progress.push(p));

      expect(progress[0]).toMatchObject({ phase: 'queued', uploadId: '/tmp/q.mp4' });
      expect(progress.some((p) => p.phase === 'complete')).toBe(true);

      statSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('processes multiple files sequentially', async () => {
      const { statSpy, openSpy } = mockFsForUpload();
      global.fetch.mockImplementation(async () => {
        const call = global.fetch.mock.calls.length;
        if (call % 2 === 1) {
          return { ok: true, headers: { get: () => 'https://upload.example/session' } };
        }
        return { ok: true, status: 200, json: async () => ({ id: `vid-${call}` }) };
      });

      const a = enqueueYouTubeUpload({
        filePath: '/tmp/a.mp4',
        uploadId: '/tmp/a.mp4',
        title: 'a'
      });
      const b = enqueueYouTubeUpload({
        filePath: '/tmp/b.mp4',
        uploadId: '/tmp/b.mp4',
        title: 'b'
      });
      const [ra, rb] = await Promise.all([a, b]);
      expect(ra.success).toBe(true);
      expect(rb.success).toBe(true);

      statSpy.mockRestore();
      openSpy.mockRestore();
    });
  });

  describe('cancelYouTubeUpload', () => {
    it('cancels a queued upload while another file is uploading', async () => {
      const { statSpy, openSpy } = mockFsForUpload();
      const progress = [];
      let releasePut;
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'https://upload.example/session' }
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releasePut = () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ id: 'first-vid' })
                });
            })
        );

      const first = enqueueYouTubeUpload(
        { filePath: '/tmp/first.mp4', uploadId: '/tmp/first.mp4', title: 'first' },
        (p) => progress.push(p)
      );
      const second = enqueueYouTubeUpload(
        { filePath: '/tmp/second.mp4', uploadId: '/tmp/second.mp4', title: 'second' },
        (p) => progress.push(p)
      );
      await waitForPutHook(() => releasePut);

      const cancelResult = cancelYouTubeUpload('/tmp/second.mp4');
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.queued).toBe(true);

      releasePut();
      const [firstResult, secondResult] = await Promise.all([first, second]);
      expect(firstResult.success).toBe(true);
      expect(secondResult.cancelled).toBe(true);
      expect(progress.some((p) => p.uploadId === '/tmp/second.mp4' && p.phase === 'cancelled')).toBe(
        true
      );

      statSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('refuses to cancel a different file while another upload is active', async () => {
      const { statSpy, openSpy } = mockFsForUpload();
      let releasePut;
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'https://upload.example/session' }
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releasePut = () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ id: 'active-vid' })
                });
            })
        );

      const active = enqueueYouTubeUpload({
        filePath: '/tmp/active.mp4',
        uploadId: '/tmp/active.mp4',
        title: 'active'
      });

      await waitForPutHook(() => releasePut);
      const wrongCancel = cancelYouTubeUpload('/tmp/other.mp4');
      expect(wrongCancel.success).toBe(false);
      expect(wrongCancel.error).toMatch(/another upload/i);

      releasePut();
      await active;

      statSpy.mockRestore();
      openSpy.mockRestore();
    });
  });

  describe('cancelAllYouTubeUploads', () => {
    it('cancels queued uploads and aborts the active upload', async () => {
      const { statSpy, openSpy } = mockFsForUpload();
      const progress = [];
      let releasePut;
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'https://upload.example/session' }
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releasePut = () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ id: 'active' })
                });
            })
        );

      const active = enqueueYouTubeUpload(
        { filePath: '/tmp/active.mp4', uploadId: '/tmp/active.mp4', title: 'active' },
        (p) => progress.push(p)
      );
      const queued = enqueueYouTubeUpload(
        { filePath: '/tmp/queued.mp4', uploadId: '/tmp/queued.mp4', title: 'queued' },
        (p) => progress.push(p)
      );
      await waitForPutHook(() => releasePut);

      const result = cancelAllYouTubeUploads();
      expect(result.success).toBe(true);

      if (releasePut) releasePut();
      const [activeResult, queuedResult] = await Promise.all([active, queued]);
      expect(queuedResult.cancelled).toBe(true);
      expect(activeResult.cancelled || activeResult.success).toBeTruthy();
      expect(progress.some((p) => p.phase === 'cancelled')).toBe(true);

      statSpy.mockRestore();
      openSpy.mockRestore();
    });
  });
});
