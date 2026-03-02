/**
 * Pure utility functions used by the renderer (extracted for testability)
 */

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

module.exports = {
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
