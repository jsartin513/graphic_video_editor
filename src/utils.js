// CommonJS test helper: provides Node-compatible implementations of renderer/utils.js.
// Note: escapeHtml uses regex (not DOM) since tests run outside a browser context.
// This file is intentionally excluded from coverage metrics.

function getFileName(filePath) {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

function escapeHtml(text) {
  // Server-side implementation without DOM
  if (typeof text !== 'string') return text;
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function getDirectoryName(filePath) {
  // Handle non-string or empty paths with a meaningful default
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return 'root';
  }

  // Remove trailing slashes before processing
  const cleanPath = filePath.replace(/[/\\]+$/, '');
  
  // Split on both forward and back slashes and remove empty components
  const parts = cleanPath.split(/[/\\]/).filter(part => part.length > 0);

  // If there is no clear parent directory, return a sensible default
  if (parts.length < 2) {
    return 'root';
  }

  // Get parent directory name
  return parts[parts.length - 2];
}

module.exports = {
  getFileName,
  escapeHtml,
  formatDate,
  formatDuration,
  getDirectoryName
};
