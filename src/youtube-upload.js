/**
 * Resumable YouTube video upload and optional playlist assignment.
 */

const fs = require('fs').promises;
const path = require('path');
const { getValidAccessToken } = require('./youtube-auth');
const { logger } = require('./logger');

const UPLOAD_INIT_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const PLAYLIST_ITEMS_URL = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet';
const CHUNK_SIZE = 8 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv']);

const MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska'
};

let currentAbortController = null;
let currentUploadId = null;
let uploadQueue = [];
let isProcessingQueue = false;

function jobKey(job) {
  return job.uploadId || job.filePath;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'video/mp4';
}

function assertSupportedFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`YouTube upload supports mp4, mov, and mkv only (got ${ext || 'unknown'})`);
  }
}

async function readApiError(res) {
  try {
    const body = await res.json();
    return body.error?.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function initResumableSession(accessToken, metadata, fileSize, mimeType) {
  const res = await fetch(UPLOAD_INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(fileSize)
    },
    body: JSON.stringify(metadata)
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const location = res.headers.get('Location');
  if (!location) {
    throw new Error('YouTube did not return an upload session URL');
  }
  return location;
}

async function uploadFileResumable(location, filePath, onProgress, signal) {
  const stat = await fs.stat(filePath);
  const total = stat.size;
  const handle = await fs.open(filePath, 'r');
  let offset = 0;

  try {
    while (offset < total) {
      if (signal?.aborted) {
        throw new Error('Upload cancelled');
      }
      const length = Math.min(CHUNK_SIZE, total - offset);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, offset);
      const end = offset + length - 1;
      const headers = {
        'Content-Length': String(length),
        'Content-Range': `bytes ${offset}-${end}/${total}`
      };
      const res = await fetch(location, {
        method: 'PUT',
        headers,
        body: buffer,
        signal
      });

      if (res.status === 308) {
        const range = res.headers.get('Range');
        if (range) {
          const match = /bytes=0-(\d+)/.exec(range);
          if (match) {
            offset = Number(match[1]) + 1;
          } else {
            offset = end + 1;
          }
        } else {
          offset = end + 1;
        }
        if (onProgress) onProgress(Math.min(100, (offset / total) * 100));
        continue;
      }

      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      const video = await res.json();
      if (onProgress) onProgress(100);
      return video;
    }
    throw new Error('Upload ended before the file was sent');
  } finally {
    await handle.close();
  }
}

async function addVideoToPlaylist(accessToken, playlistId, videoId) {
  const res = await fetch(PLAYLIST_ITEMS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId
        }
      }
    })
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

function buildVideoMetadata({ title, description, privacyStatus }) {
  return {
    snippet: {
      title: (title || 'Merged video').slice(0, 100),
      description: (description || '').slice(0, 5000)
    },
    status: {
      privacyStatus: privacyStatus || 'private',
      selfDeclaredMadeForKids: false
    }
  };
}

async function uploadVideoToYouTube(options, onProgress) {
  const { filePath, title, description, privacyStatus, playlistId, uploadId } = options;
  assertSupportedFormat(filePath);
  const accessToken = await getValidAccessToken();
  const stat = await fs.stat(filePath);
  const mimeType = getMimeType(filePath);
  const metadata = buildVideoMetadata({ title, description, privacyStatus });

  const emit = (phase, percent, extra = {}) => {
    if (onProgress) {
      onProgress({
        uploadId: uploadId || filePath,
        filePath,
        phase,
        percent,
        ...extra
      });
    }
  };

  const id = uploadId || filePath;
  if (!currentUploadId) {
    currentUploadId = id;
  }
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  try {
    emit('uploading', 0);
    const sessionUrl = await initResumableSession(accessToken, metadata, stat.size, mimeType);
    const video = await uploadFileResumable(
      sessionUrl,
      filePath,
      (pct) => emit('uploading', pct),
      signal
    );
    const videoId = video.id;
    if (!videoId) {
      throw new Error('Upload completed but no video id was returned');
    }

    let playlistError = null;
    if (playlistId) {
      emit('playlist', 100, { videoId });
      try {
        await addVideoToPlaylist(accessToken, playlistId, videoId);
      } catch (playlistErr) {
        playlistError = playlistErr?.message || String(playlistErr);
        logger.warn('YouTube playlist insert failed after upload', {
          error: playlistError,
          videoId,
          playlistId
        });
      }
    }

    emit('complete', 100, { videoId, playlistError });
    return { success: true, videoId, playlistError };
  } catch (error) {
    const message = error?.message || String(error);
    if (message.includes('cancelled') || message.includes('aborted')) {
      emit('cancelled', 0, { error: message });
      return { success: false, cancelled: true, error: message };
    }
    logger.error('YouTube upload failed', { error: message, filePath });
    emit('error', 0, { error: message });
    return { success: false, error: message };
  } finally {
    currentAbortController = null;
    currentUploadId = null;
  }
}

function cancelQueuedUpload(uploadId) {
  if (!uploadId) return null;
  const index = uploadQueue.findIndex((entry) => jobKey(entry.job) === uploadId);
  if (index < 0) return null;
  const [item] = uploadQueue.splice(index, 1);
  const result = { success: false, cancelled: true, uploadId };
  if (item.onProgress) {
    item.onProgress({
      uploadId,
      filePath: item.job.filePath,
      phase: 'cancelled',
      percent: 0
    });
  }
  item.resolve(result);
  return result;
}

function cancelYouTubeUpload(uploadId) {
  if (uploadId) {
    const queued = cancelQueuedUpload(uploadId);
    if (queued) {
      return { success: true, cancelled: true, uploadId, queued: true };
    }
    if (currentUploadId === uploadId && currentAbortController) {
      currentAbortController.abort();
      return { success: true, cancelled: true, uploadId };
    }
    if (currentUploadId && currentUploadId !== uploadId) {
      return { success: false, error: 'Another upload is in progress', uploadId };
    }
    return { success: false, error: 'No upload found for this file', uploadId };
  }
  return cancelAllYouTubeUploads();
}

function cancelAllYouTubeUploads() {
  const pending = [...uploadQueue];
  uploadQueue = [];
  for (const item of pending) {
    const uploadId = jobKey(item.job);
    if (item.onProgress) {
      item.onProgress({
        uploadId,
        filePath: item.job.filePath,
        phase: 'cancelled',
        percent: 0
      });
    }
    item.resolve({ success: false, cancelled: true, uploadId });
  }
  if (currentAbortController) {
    currentAbortController.abort();
  }
  return { success: true, cancelled: true };
}

function cancelCurrentYouTubeUpload(uploadId) {
  return cancelYouTubeUpload(uploadId);
}

function enqueueYouTubeUpload(job, onProgress) {
  const key = jobKey(job);
  const alreadyQueued = uploadQueue.some((entry) => jobKey(entry.job) === key);
  if (alreadyQueued || currentUploadId === key) {
    return Promise.resolve({
      success: false,
      error: 'Upload already in progress for this file',
      uploadId: key
    });
  }
  return new Promise((resolve, reject) => {
    uploadQueue.push({ job, onProgress, resolve, reject });
    if (onProgress) {
      onProgress({
        uploadId: key,
        filePath: job.filePath,
        phase: 'queued',
        percent: 0
      });
    }
    processUploadQueue();
  });
}

async function processUploadQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (uploadQueue.length > 0) {
    const { job, onProgress, resolve } = uploadQueue.shift();
    currentUploadId = jobKey(job);
    try {
      const result = await uploadVideoToYouTube(job, onProgress);
      resolve(result);
    } catch (error) {
      resolve({ success: false, error: error.message || String(error) });
    } finally {
      if (currentUploadId === jobKey(job)) {
        currentUploadId = null;
      }
    }
  }
  isProcessingQueue = false;
}

/** @internal test helper */
function resetYouTubeUploadStateForTests() {
  uploadQueue = [];
  isProcessingQueue = false;
  currentAbortController = null;
  currentUploadId = null;
}

module.exports = {
  uploadVideoToYouTube,
  enqueueYouTubeUpload,
  cancelYouTubeUpload,
  cancelAllYouTubeUploads,
  cancelCurrentYouTubeUpload,
  resetYouTubeUploadStateForTests,
  assertSupportedFormat,
  buildVideoMetadata,
  SUPPORTED_EXTENSIONS
};
