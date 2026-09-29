import { escapeHtml, escapeAttr, getFileName } from './utils.js';

const ACTIVE_PHASES = new Set(['queued', 'uploading', 'playlist']);

/**
 * YouTube upload controls on the merge results screen.
 */
export function attachYouTubeUploadToMergeResults({
  results,
  progressDetails,
  youtubeSettings,
  youtubeStatus
}) {
  if (!window.electronAPI?.youtubeUploadVideo) return () => {};

  const connected = Boolean(youtubeStatus?.connected);
  const autoUpload = Boolean(youtubeSettings?.autoUpload);
  const uploadStateByPath = new Map();
  let activeUploadPath = null;

  function renderUploadBlock(outputPath) {
    const state = uploadStateByPath.get(outputPath) || { phase: 'idle', percent: 0 };
    const filename = getFileName(outputPath);
    const showCancel =
      state.phase === 'queued' ||
      ((state.phase === 'uploading' || state.phase === 'playlist') &&
        activeUploadPath === outputPath);

    if (!connected) {
      return `<div class="youtube-upload-row" data-path="${escapeAttr(outputPath)}">
        <span class="youtube-upload-hint">Connect YouTube in Settings to upload</span>
      </div>`;
    }
    if (state.phase === 'complete' && state.videoId) {
      const playlistNote = state.playlistError
        ? `<span class="youtube-upload-hint"> (${escapeHtml(state.playlistError)})</span>`
        : '';
      return `<div class="youtube-upload-row success" data-path="${escapeAttr(outputPath)}">
        <span class="youtube-upload-status">Uploaded to YouTube${playlistNote}</span>
        <a href="#" class="youtube-open-link" data-video-id="${escapeAttr(state.videoId)}">Open video</a>
      </div>`;
    }
    if (state.phase === 'uploading' || state.phase === 'playlist') {
      const label = state.phase === 'playlist' ? 'Adding to playlist…' : 'Uploading…';
      return `<div class="youtube-upload-row uploading" data-path="${escapeAttr(outputPath)}">
        <span class="youtube-upload-status">${escapeHtml(label)} ${Math.round(state.percent || 0)}%</span>
        <div class="youtube-upload-bar"><div class="youtube-upload-bar-fill" style="width:${Math.round(state.percent || 0)}%"></div></div>
        ${showCancel ? `<button type="button" class="btn btn-text btn-small youtube-cancel-btn" data-path="${escapeAttr(outputPath)}">Cancel</button>` : ''}
      </div>`;
    }
    if (state.phase === 'queued') {
      return `<div class="youtube-upload-row" data-path="${escapeAttr(outputPath)}">
        <span class="youtube-upload-status">Queued for YouTube upload…</span>
        ${showCancel ? `<button type="button" class="btn btn-text btn-small youtube-cancel-btn" data-path="${escapeAttr(outputPath)}">Cancel</button>` : ''}
      </div>`;
    }
    if (state.phase === 'error') {
      return `<div class="youtube-upload-row error" data-path="${escapeAttr(outputPath)}">
        <span class="youtube-upload-status">${escapeHtml(state.error || 'Upload failed')}</span>
        <button type="button" class="btn btn-secondary btn-small youtube-retry-btn" data-path="${escapeAttr(outputPath)}">Retry</button>
      </div>`;
    }
    if (state.phase === 'cancelled') {
      return `<div class="youtube-upload-row" data-path="${escapeAttr(outputPath)}">
        <span class="youtube-upload-status">Upload cancelled</span>
        <button type="button" class="btn btn-secondary btn-small youtube-upload-btn" data-path="${escapeAttr(outputPath)}">Upload to YouTube</button>
      </div>`;
    }
    return `<div class="youtube-upload-row" data-path="${escapeAttr(outputPath)}">
      <button type="button" class="btn btn-secondary btn-small youtube-upload-btn" data-path="${escapeAttr(outputPath)}" data-filename="${escapeAttr(filename)}">Upload to YouTube</button>
    </div>`;
  }

  function findResultRow(outputPath) {
    return Array.from(progressDetails.querySelectorAll('.result-item.success')).find(
      (row) => row.getAttribute('data-output-path') === outputPath
    );
  }

  function updateRowDom(outputPath) {
    const row = findResultRow(outputPath);
    if (!row) return;
    const container = row.querySelector('.youtube-upload-slot');
    if (container) {
      container.innerHTML = renderUploadBlock(outputPath);
      wireRowButtons(container);
    }
  }

  function canStartUpload(outputPath) {
    const state = uploadStateByPath.get(outputPath);
    if (!state) return true;
    return !ACTIVE_PHASES.has(state.phase) && state.phase !== 'complete';
  }

  async function startUpload(outputPath) {
    if (!canStartUpload(outputPath)) return;

    uploadStateByPath.set(outputPath, { phase: 'queued', percent: 0 });
    updateRowDom(outputPath);

    const title = getFileName(outputPath).replace(/\.(mp4|mov|mkv|avi|m4v)$/i, '');
    try {
      const result = await window.electronAPI.youtubeUploadVideo({
        filePath: outputPath,
        uploadId: outputPath,
        title
      });
      if (result?.cancelled) {
        if (activeUploadPath === outputPath) activeUploadPath = null;
        uploadStateByPath.set(outputPath, { phase: 'cancelled', percent: 0 });
      } else if (result?.success && result.videoId) {
        if (activeUploadPath === outputPath) activeUploadPath = null;
        uploadStateByPath.set(outputPath, {
          phase: 'complete',
          percent: 100,
          videoId: result.videoId,
          playlistError: result.playlistError || null
        });
      } else if (uploadStateByPath.get(outputPath)?.phase !== 'complete') {
        if (activeUploadPath === outputPath) activeUploadPath = null;
        uploadStateByPath.set(outputPath, {
          phase: 'error',
          percent: 0,
          error: result?.error || 'Upload failed'
        });
      }
    } catch (error) {
      if (activeUploadPath === outputPath) activeUploadPath = null;
      uploadStateByPath.set(outputPath, {
        phase: 'error',
        percent: 0,
        error: error.message || 'Upload failed'
      });
    }
    updateRowDom(outputPath);
  }

  function wireRowButtons(container) {
    container.querySelectorAll('.youtube-upload-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        if (path) startUpload(path);
      });
    });
    container.querySelectorAll('.youtube-retry-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        if (path) startUpload(path);
      });
    });
    container.querySelectorAll('.youtube-cancel-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const path = btn.getAttribute('data-path');
        if (!path) return;
        try {
          const result = await window.electronAPI.youtubeCancelUpload(path);
          if (result?.success) {
            if (activeUploadPath === path) activeUploadPath = null;
            uploadStateByPath.set(path, { phase: 'cancelled', percent: 0 });
            updateRowDom(path);
          }
        } catch (error) {
          console.error('Cancel YouTube upload failed', error);
        }
      });
    });
    container.querySelectorAll('.youtube-open-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const videoId = link.getAttribute('data-video-id');
        if (videoId) {
          window.electronAPI.openExternal(`https://www.youtube.com/watch?v=${videoId}`);
        }
      });
    });
  }

  const progressHandler = (data) => {
    if (!data?.filePath && !data?.uploadId) return;
    const key = data.filePath || data.uploadId;
    const prev = uploadStateByPath.get(key) || {};
    if (prev.phase === 'complete') return;

    if (data.phase === 'uploading' || data.phase === 'playlist') {
      activeUploadPath = key;
    }
    if (data.phase === 'complete' || data.phase === 'cancelled' || data.phase === 'error') {
      if (activeUploadPath === key) activeUploadPath = null;
    }

    if (data.phase === 'complete' && data.videoId) {
      uploadStateByPath.set(key, {
        phase: 'complete',
        percent: 100,
        videoId: data.videoId,
        playlistError: data.playlistError || null
      });
      updateRowDom(key);
      return;
    }
    if (data.phase === 'error') {
      uploadStateByPath.set(key, { phase: 'error', percent: 0, error: data.error || 'Upload failed' });
      updateRowDom(key);
      return;
    }
    if (data.phase === 'cancelled') {
      uploadStateByPath.set(key, { phase: 'cancelled', percent: 0 });
      updateRowDom(key);
      return;
    }

    uploadStateByPath.set(key, {
      phase:
        data.phase === 'playlist'
          ? 'playlist'
          : data.phase === 'uploading'
            ? 'uploading'
            : data.phase === 'queued'
              ? 'queued'
              : data.phase,
      percent: data.percent ?? prev.percent ?? 0,
      error: data.error,
      videoId: data.videoId || prev.videoId
    });
    updateRowDom(key);
  };

  window.electronAPI.onYouTubeUploadProgress(progressHandler);

  progressDetails.querySelectorAll('.result-item.success').forEach((row) => {
    const path = row.getAttribute('data-output-path');
    if (!path) return;
    const slot = row.querySelector('.youtube-upload-slot');
    if (slot) {
      slot.innerHTML = renderUploadBlock(path);
      wireRowButtons(slot);
    }
  });

  const successfulPaths = results.filter((r) => r.success).map((r) => r.outputPath);
  if (connected && autoUpload) {
    (async () => {
      for (const outputPath of successfulPaths) {
        await startUpload(outputPath);
      }
    })();
  }

  return () => {
    window.electronAPI.removeYouTubeUploadProgressListener();
    window.electronAPI.youtubeCancelAllUploads?.().catch(() => {});
  };
}
