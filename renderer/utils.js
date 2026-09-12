// Utility functions (browser ESM — no Node createRequire)

function formatBytes(bytes, options = {}) {
  if (!bytes || bytes === 0 || isNaN(bytes) || typeof bytes !== 'number' || bytes < 0) {
    return '0 Bytes';
  }
  if (bytes === 1 && options.singularByte) {
    return '1 Byte';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileName(filePath) {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || (typeof seconds === 'string' && seconds.trim() === '')) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getDirectoryPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return '.';
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

  if (lastSep < 0) {
    return '.';
  }

  if (lastSep === 0) {
    return '/';
  }

  if (lastSep === 2 && filePath[1] === ':') {
    return filePath.substring(0, lastSep + 1);
  }

  return filePath.substring(0, lastSep);
}

function getDirectoryName(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return 'root';
  }

  const cleanPath = filePath.replace(/[/\\]+$/, '');
  const parts = cleanPath.split(/[/\\]/).filter(part => part.length > 0);

  if (parts.length < 2) {
    return 'root';
  }

  return parts[parts.length - 2];
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatBitrate(bitrate) {
  if (!bitrate || isNaN(bitrate)) return 'Unknown';
  const kbps = bitrate / 1000;
  const mbps = kbps / 1000;

  if (mbps >= 1) {
    return `${mbps.toFixed(2)} Mbps`;
  }
  return `${kbps.toFixed(0)} Kbps`;
}

function formatResolution(width, height) {
  if (!width || !height) return 'Unknown';
  return `${width}x${height}`;
}

function formatFrameRate(fps) {
  if (!fps || isNaN(fps)) return 'Unknown';
  return `${fps} fps`;
}

function formatTimeForFFmpeg(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Remove characters invalid in filenames; preserve spaces. Matches src/filename-sanitize.js */
export function sanitizeFilenameForOutput(name) {
  if (!name || typeof name !== 'string') return '';
  const WINDOWS_RESERVED = new Set([
    'con', 'prn', 'aux', 'nul',
    'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
    'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
  ]);
  let result = name.replace(/[\u0000-\u001f\u007f]/g, '_');
  result = result.replace(/[/\\:*?"<>|]/g, '_');
  result = result.replace(/[.\s]+$/g, '').trim();
  if (!result) return 'output';
  const stem = result.includes('.') ? result.slice(0, result.lastIndexOf('.')) : result;
  if (WINDOWS_RESERVED.has(stem.toLowerCase())) {
    result = `_${result}`;
  }
  return result;
}

export {
  formatBytes,
  getFileName,
  formatDuration,
  getDirectoryPath,
  getDirectoryName,
  debounce,
  formatBitrate,
  formatResolution,
  formatFrameRate,
  formatTimeForFFmpeg
};

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeAttr(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;');
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
